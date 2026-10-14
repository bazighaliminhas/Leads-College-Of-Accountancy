<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Support\Activity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

class StudentController extends Controller
{
    public function dashboard(Request $request)
    {
        $u = $request->user();
        $enrollments = $u->enrollments()->with(['course.program:id,name,slug', 'course.teachers:id,name', 'examSession'])->latest()->get();
        return response()->json([
            'stats' => [
                'active' => $enrollments->where('status', 'active')->count(),
                'pending' => $enrollments->where('status', 'pending')->count(),
                'orders' => $u->orders()->count(),
                'paid' => (float) $u->payments()->where('status', 'verified')->sum('amount'),
            ],
            'enrollments' => $enrollments,
            'orders' => $u->orders()->with('items')->latest()->limit(5)->get(),
            'announcements' => $this->announcementsFor($u)->limit(5)->get(),
            'live' => \App\Models\LiveClass::with(['course:id,code,title,slug', 'teacher:id,name'])->whereIn('course_id', $enrollments->filter->hasAccess()->pluck('course_id'))
                ->where('status', 'scheduled')->where('starts_at', '>=', now()->subHours(3))->orderBy('starts_at')->limit(6)->get()
                ->map(fn ($lc) => collect($lc->toArray())->except(['google_event_id', 'google_account_id', 'google_event_link'])->all() + ['ics_url' => URL::temporarySignedRoute('files.live-ics', now()->addDays(60), ['liveClass' => $lc->id])]),
            'quiz_stats' => ['taken' => \App\Models\QuizAttempt::where('user_id', $u->id)->whereNotNull('submitted_at')->distinct('quiz_id')->count('quiz_id'), 'average' => (int) round(\App\Models\QuizAttempt::where('user_id', $u->id)->whereNotNull('submitted_at')->avg('percentage') ?? 0)],
        ]);
    }

    public function enrollments(Request $request)
    {
        return response()->json($request->user()->enrollments()->with(['course.program:id,name,slug', 'course.level:id,name', 'course.teachers:id,name', 'examSession', 'order:id,order_no,status'])
            ->withCount([])->latest()->get()->map(function ($e) use ($request) {
                $total = $e->course->lessons()->where('is_published', true)->count();
                $done = LessonProgress::where('user_id', $request->user()->id)->where('course_id', $e->course_id)->whereNotNull('completed_at')->count();
                $e->lessons_total = $total; $e->lessons_done = $done; $e->has_access = $e->hasAccess();
                return $e;
            }));
    }

    /** Course content — only after admin has granted access. */
    public function learn(Request $request, string $slug)
    {
        $course = Course::where('slug', $slug)->with(['program:id,name,slug', 'level:id,name', 'teachers:id,name,designation,avatar'])->firstOrFail();
        $enrollment = Enrollment::where('user_id', $request->user()->id)->where('course_id', $course->id)->first();
        if (!$enrollment || !$enrollment->hasAccess()) {
            Activity::log('learn.denied', "Access denied to {$course->code}", $course);
            return response()->json(['message' => $enrollment ? 'Admin has not granted access to this course yet.' : 'You are not enrolled in this course.', 'status' => $enrollment?->status], 403);
        }
        $progress = LessonProgress::where('user_id', $request->user()->id)->where('course_id', $course->id)->get()->keyBy('lesson_id');
        $lessons = $course->lessons()->where('is_published', true)->get()->map(fn ($l) => $this->lessonPayload($l, $progress->get($l->id)));
        $attempts = \App\Models\QuizAttempt::where('user_id', $request->user()->id)->whereNotNull('submitted_at')->get()->groupBy('quiz_id');
        $quizzes = \App\Models\Quiz::where('course_id', $course->id)->where('is_published', true)->withCount('questions')->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn ($q) => $q->only(['id', 'lesson_id', 'title', 'description', 'kind', 'time_limit_minutes', 'pass_percentage', 'max_attempts', 'questions_count']) + [
                'attempts' => $attempts->get($q->id)?->count() ?? 0,
                'best' => $attempts->get($q->id)?->max('percentage'),
                'passed' => (bool) $attempts->get($q->id)?->contains('passed', true),
            ]);
        $live = \App\Models\LiveClass::with('teacher:id,name')->where('course_id', $course->id)->where('status', 'scheduled')->where('starts_at', '>=', now()->subHours(3))->orderBy('starts_at')->limit(5)->get()
            ->map(fn ($lc) => collect($lc->toArray())->except(['google_event_id', 'google_account_id', 'google_event_link'])->all() + ['ics_url' => URL::temporarySignedRoute('files.live-ics', now()->addDays(60), ['liveClass' => $lc->id])]);
        Activity::log('learn.open', "Opened course {$course->code}", $course);
        return response()->json(['course' => $course, 'enrollment' => $enrollment, 'lessons' => $lessons, 'quizzes' => $quizzes, 'live' => $live, 'announcements' => Announcement::where('course_id', $course->id)->where('is_published', true)->latest()->get()]);
    }

    public static function lessonPayload(Lesson $l, $p = null): array
    {
        $exp = now()->addHours(4);
        return $l->only(['id', 'course_id', 'chapter', 'title', 'description', 'type', 'video_url', 'content', 'study_material', 'objectives', 'ai_generated', 'duration_minutes', 'attachment_name', 'sort_order', 'is_published']) + [
            'video_src' => $l->video_path ? URL::temporarySignedRoute('files.lesson', $exp, ['lesson' => $l->id, 'kind' => 'video']) : null,
            'attachment_src' => $l->attachment_path ? URL::temporarySignedRoute('files.lesson', $exp, ['lesson' => $l->id, 'kind' => 'attachment']) : null,
            'completed' => (bool) $p?->completed_at,
            'views' => $p?->views ?? 0,
        ];
    }

    public function progress(Request $request, Lesson $lesson)
    {
        $data = $request->validate(['completed' => 'boolean', 'position' => 'nullable|integer|min:0']);
        $enrollment = Enrollment::where('user_id', $request->user()->id)->where('course_id', $lesson->course_id)->first();
        abort_unless($enrollment && $enrollment->hasAccess(), 403);
        $p = LessonProgress::firstOrCreate(['user_id' => $request->user()->id, 'lesson_id' => $lesson->id], ['course_id' => $lesson->course_id]);
        $p->views += $request->has('completed') ? 0 : 1;
        if (isset($data['position'])) $p->last_position_seconds = $data['position'];
        if ($request->has('completed')) $p->completed_at = $data['completed'] ? now() : null;
        $p->save();
        $total = Lesson::where('course_id', $lesson->course_id)->where('is_published', true)->count();
        $done = LessonProgress::where('user_id', $request->user()->id)->where('course_id', $lesson->course_id)->whereNotNull('completed_at')->count();
        $enrollment->update(['progress' => $total ? (int) round($done * 100 / $total) : 0]);
        Activity::log($request->has('completed') ? 'lesson.complete' : 'lesson.view', "Lesson {$lesson->title}", $lesson, $data);
        return response()->json(['progress' => $enrollment->progress, 'lesson' => $p]);
    }

    public function orders(Request $request)
    {
        return response()->json($request->user()->orders()->with(['items', 'payments'])->latest()->get());
    }

    public function order(Request $request, \App\Models\Order $order)
    {
        abort_unless($order->user_id === $request->user()->id, 403);
        return response()->json($order->load(['items', 'payments']));
    }

    public function announcements(Request $request)
    {
        return response()->json($this->announcementsFor($request->user())->get());
    }

    protected function announcementsFor($u)
    {
        $courseIds = $u->enrollments()->where('status', 'active')->pluck('course_id');
        return Announcement::with(['author:id,name,role', 'course:id,code,title'])->where('is_published', true)
            ->where(fn ($q) => $q->whereIn('audience', ['all', 'students'])->orWhereIn('course_id', $courseIds))->latest();
    }

    public function notifications(Request $request)
    {
        return response()->json($request->user()->userNotifications()->latest()->limit(100)->get());
    }

    public function readNotifications(Request $request)
    {
        $request->user()->userNotifications()->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }
}
