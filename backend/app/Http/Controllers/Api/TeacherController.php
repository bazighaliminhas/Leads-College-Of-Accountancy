<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesCourses;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Level;
use App\Models\LessonProgress;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Activity;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TeacherController extends Controller
{
    use ManagesCourses;

    public function dashboard(Request $request)
    {
        $ids = $this->myCourseIds($request->user());
        return response()->json([
            'stats' => [
                'courses' => $ids->count(),
                'lessons' => Lesson::whereIn('course_id', $ids)->count(),
                'students' => Enrollment::whereIn('course_id', $ids)->where('status', 'active')->distinct('user_id')->count('user_id'),
                'pending_courses' => Course::whereIn('id', $ids)->where('status', 'pending')->count(),
                'live_upcoming' => \App\Models\LiveClass::whereIn('course_id', $ids)->where('status', 'scheduled')->where('starts_at', '>=', now()->subHours(2))->count(),
                'quizzes' => \App\Models\Quiz::whereIn('course_id', $ids)->count(),
            ],
            'live' => \App\Models\LiveClass::with('course:id,code,title')->whereIn('course_id', $ids)->whereIn('status', ['scheduled', 'draft'])->where('starts_at', '>=', now()->subHours(2))->orderBy('starts_at')->limit(5)->get(),
            'courses' => $this->coursesQuery($ids)->get(),
            'announcements' => Announcement::where('is_published', true)->whereIn('audience', ['all', 'teachers'])->latest()->limit(5)->get(),
        ]);
    }

    protected function coursesQuery($ids)
    {
        return Course::whereIn('id', $ids)->with(['program:id,name,slug', 'level:id,name'])
            ->withCount(['lessons', 'quizzes', 'liveClasses', 'enrollments as students_count' => fn ($q) => $q->where('status', 'active')])->orderBy('program_id')->orderBy(Level::select('sort_order')->whereColumn('levels.id', 'courses.level_id'))->orderBy('sort_order');
    }

    public function courses(Request $request)
    {
        return response()->json($this->coursesQuery($this->myCourseIds($request->user()))->get());
    }

    public function course(Request $request, Course $course)
    {
        $this->ownCourse($request, $course);
        $course->load(['program', 'level', 'teachers:id,name']);
        $lessons = $course->lessons()->with('uploader:id,name')->withCount('quizzes')->get()->map(fn ($l) => StudentController::lessonPayload($l) + ['uploader' => $l->uploader?->name, 'file_size' => $l->file_size, 'created_at' => $l->created_at, 'quizzes_count' => $l->quizzes_count]);
        return response()->json(['course' => $course, 'lessons' => $lessons, 'students' => Notify::courseStudents($course->id)->count()]);
    }

    protected function courseRules(): array
    {
        return [
            'program_id' => 'required|exists:programs,id',
            'level_id' => 'nullable|exists:levels,id',
            'code' => 'required|string|max:20',
            'title' => 'required|string|max:200',
            'short_description' => 'nullable|string|max:500',
            'about' => 'nullable|string',
            'learn' => 'nullable|array', 'learn.*' => 'string|max:500',
            'structure' => 'nullable|array', 'structure.*' => 'string|max:500',
            'exam_duration' => 'nullable|string|max:60',
            'exam_format' => 'nullable|string|max:255',
            'pass_mark' => 'nullable|string|max:20',
            'fee' => 'nullable|numeric|min:0',
            'class_duration' => 'nullable|string|max:100',
            'language' => 'nullable|string|max:60',
            'image' => 'nullable|image|max:4096',
        ];
    }

    /** Teacher proposes a new course: it is saved as "pending" until the admin publishes it. */
    public function storeCourse(Request $request)
    {
        $data = $request->validate($this->courseRules());
        if ($request->hasFile('image')) $data['image'] = $request->file('image')->store('courses', 'public');
        $data['slug'] = Str::slug($data['code'].'-'.$data['title']).'-'.Str::lower(Str::random(4));
        $data['status'] = 'pending';
        $data['created_by'] = $request->user()->id;
        $course = Course::create($data);
        $course->teachers()->attach($request->user()->id, ['assigned_by' => $request->user()->id]);
        Activity::log('teacher.course.create', "Teacher created course {$course->code} (pending approval)", $course, $data);
        Notify::admins(['title' => 'Course awaiting approval', 'wa_icon' => '📘 ', 'body' => "{$request->user()->name} added {$course->code} {$course->title} and it is waiting for your approval.", 'link' => '/admin/courses', 'cta' => 'Review course']);
        return response()->json($course, 201);
    }

    public function updateCourse(Request $request, Course $course)
    {
        $this->ownCourse($request, $course);
        $rules = $this->courseRules();
        // teachers may edit academic content; price/programme of a published course is controlled by admin
        if ($course->status === 'published') { unset($rules['fee'], $rules['program_id'], $rules['code']); $rules['level_id'] = 'sometimes|nullable|exists:levels,id'; }
        $data = $request->validate($rules);
        if ($request->hasFile('image')) $data['image'] = $request->file('image')->store('courses', 'public'); else unset($data['image']);
        $course->update($data);
        Activity::log('teacher.course.update', "Teacher updated course {$course->code}", $course, $data);
        return response()->json($course->fresh());
    }

    public function storeLesson(Request $request, Course $course)
    {
        $this->ownCourse($request, $course);
        $data = $this->validateLesson($request, true);
        $lesson = new Lesson(['course_id' => $course->id, 'uploaded_by' => $request->user()->id]);
        $this->fillLesson($request, $lesson, $data);
        Activity::log('lesson.create', "Lesson '{$lesson->title}' added to {$course->code}", $lesson, $data);
        if ($lesson->is_published) Notify::lessonPublished($lesson);
        return response()->json(StudentController::lessonPayload($lesson), 201);
    }

    public function updateLesson(Request $request, Lesson $lesson)
    {
        $this->ownCourse($request, $lesson->course);
        $data = $this->validateLesson($request, false);
        $wasPublished = (bool) $lesson->is_published;
        $this->fillLesson($request, $lesson, $data);
        if (!$wasPublished && $lesson->is_published) Notify::lessonPublished($lesson);
        Activity::log('lesson.update', "Lesson '{$lesson->title}' updated", $lesson, $data);
        return response()->json(StudentController::lessonPayload($lesson));
    }

    public function destroyLesson(Request $request, Lesson $lesson)
    {
        $this->ownCourse($request, $lesson->course);
        Activity::log('lesson.delete', "Lesson '{$lesson->title}' deleted", $lesson, $lesson->toArray());
        self::deleteLessonFiles($lesson);
        $lesson->delete();
        return response()->json(['ok' => true]);
    }

    public static function validateLesson(Request $request, bool $creating): array
    {
        return $request->validate([
            'chapter' => 'nullable|string|max:150',
            'title' => ($creating ? 'required' : 'sometimes').'|string|max:200',
            'description' => 'nullable|string|max:5000',
            'type' => 'nullable|in:video,document,text',
            'video_url' => 'nullable|url|max:500',
            'content' => 'nullable|string',
            'study_material' => 'nullable|string|max:200000',
            'objectives' => 'nullable|array',
            'objectives.*' => 'nullable|string|max:500',
            'ai_generated' => 'nullable|boolean',
            'duration_minutes' => 'nullable|integer|min:0',
            'sort_order' => 'nullable|integer',
            'is_published' => 'nullable|boolean',
            'video' => 'nullable|file|mimetypes:video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska|max:2097152',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx,ppt,pptx,xls,xlsx,zip,jpg,jpeg,png|max:51200',
        ]);
    }

    public static function fillLesson(Request $request, Lesson $lesson, array $data): void
    {
        unset($data['video'], $data['attachment']);
        if (array_key_exists('objectives', $data)) $data['objectives'] = array_values(array_filter((array) $data['objectives']));
        $lesson->fill($data);
        if ($request->hasFile('video')) {
            if ($lesson->video_path) Storage::disk('local')->delete($lesson->video_path);
            $f = $request->file('video');
            $lesson->video_path = $f->store('lessons/videos', 'local');
            $lesson->file_size = $f->getSize();
            $lesson->type = 'video';
        }
        if ($request->hasFile('attachment')) {
            if ($lesson->attachment_path) Storage::disk('local')->delete($lesson->attachment_path);
            $f = $request->file('attachment');
            $lesson->attachment_path = $f->store('lessons/files', 'local');
            $lesson->attachment_name = $f->getClientOriginalName();
            if (!$lesson->video_path && !$lesson->video_url) $lesson->type = 'document';
        }
        if ($request->boolean('remove_video') && $lesson->video_path) { Storage::disk('local')->delete($lesson->video_path); $lesson->video_path = null; }
        if ($request->boolean('remove_attachment') && $lesson->attachment_path) { Storage::disk('local')->delete($lesson->attachment_path); $lesson->attachment_path = null; $lesson->attachment_name = null; }
        if (!$lesson->sort_order) $lesson->sort_order = (int) Lesson::where('course_id', $lesson->course_id)->max('sort_order') + 1;
        $lesson->type ??= 'video';
        $lesson->save();
    }

    public static function deleteLessonFiles(Lesson $l): void
    {
        foreach ([$l->video_path, $l->attachment_path] as $p) if ($p) Storage::disk('local')->delete($p);
    }

    public function students(Request $request)
    {
        $ids = $this->myCourseIds($request->user());
        $q = Enrollment::whereIn('course_id', $ids)->where('status', 'active')->with(['user:id,name,email,phone,city,registration_no', 'course:id,code,title', 'examSession:id,name']);
        if ($request->course_id) $q->where('course_id', $request->course_id);
        return response()->json($q->latest()->get()->map(function ($e) {
            $e->lessons_done = LessonProgress::where('user_id', $e->user_id)->where('course_id', $e->course_id)->whereNotNull('completed_at')->count();
            return $e;
        }));
    }

    public function announcements(Request $request)
    {
        return response()->json(Announcement::with('course:id,code,title')->where('user_id', $request->user()->id)->latest()->get());
    }

    public function storeAnnouncement(Request $request)
    {
        $data = $request->validate(['course_id' => 'required|exists:courses,id', 'title' => 'required|max:200', 'body' => 'required|max:5000']);
        $course = $this->ownCourse($request, Course::findOrFail($data['course_id']));
        $a = Announcement::create($data + ['user_id' => $request->user()->id, 'audience' => 'course', 'is_published' => true]);
        Notify::announcement($a, $course);
        Activity::log('announcement.create', "Teacher announcement for {$course->code}", $a, $data);
        return response()->json($a, 201);
    }

    public function destroyAnnouncement(Request $request, Announcement $announcement)
    {
        abort_unless($announcement->user_id === $request->user()->id, 403);
        Activity::log('announcement.delete', "Deleted announcement {$announcement->title}", $announcement, $announcement->toArray());
        $announcement->delete();
        return response()->json(['ok' => true]);
    }
}
