<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesCourses;
use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\LiveClass;
use App\Models\User;
use App\Support\Activity;
use App\Support\GoogleCalendar;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

/**
 * Live classes on Google Meet.
 * 1) Teacher picks course, date & time → "Generate Google Meet link" creates the Calendar event + Meet link (draft).
 *    (Or pastes any Meet link manually.)
 * 2) Teacher reviews the link and presses "Publish to students" → every enrolled student gets the link
 *    on WhatsApp, email (with calendar invite) and in their dashboard; Google Calendar sends them the invite
 *    and phone reminders. A reminder with the link is sent again ~30 min before the class.
 * Admins can do everything teachers can, for every course.
 */
class LiveClassController extends Controller
{
    use ManagesCourses;

    protected function with() { return ['course:id,code,title,slug,program_id', 'course.program:id,name', 'teacher:id,name,email', 'lesson:id,title', 'googleAccount:id,email,user_id']; }

    public function index(Request $request)
    {
        $q = LiveClass::with($this->with())->whereIn('course_id', $this->myCourseIds($request->user()));
        if ($request->filled('course_id')) $q->where('course_id', $request->course_id);
        if ($request->input('when') === 'upcoming') $q->where('starts_at', '>=', now()->subHours(3))->whereIn('status', ['draft', 'scheduled']);
        if ($request->input('when') === 'past') $q->where(fn ($w) => $w->where('starts_at', '<', now()->subHours(3))->orWhereIn('status', ['completed', 'cancelled']));
        $list = $q->orderBy($request->input('when') === 'past' ? 'starts_at' : 'starts_at', $request->input('when') === 'past' ? 'desc' : 'asc')->limit(300)->get();
        return response()->json($list->map(fn ($lc) => $this->present($lc)));
    }

    protected function present(LiveClass $lc): array
    {
        return $lc->toArray() + [
            'ics_url' => URL::temporarySignedRoute('files.live-ics', now()->addDays(60), ['liveClass' => $lc->id]),
            'students_count' => Notify::courseStudents($lc->course_id)->count(),
        ];
    }

    protected function rules(bool $creating): array
    {
        return [
            'course_id' => ($creating ? 'required' : 'sometimes').'|exists:courses,id',
            'teacher_id' => 'nullable|exists:users,id',
            'title' => ($creating ? 'required' : 'sometimes').'|string|max:200',
            'description' => 'nullable|string|max:3000',
            'starts_at' => ($creating ? 'required' : 'sometimes').'|date',
            'duration_minutes' => 'nullable|integer|min:10|max:600',
            'link_mode' => 'nullable|in:google,manual',
            'meet_link' => 'nullable|url|max:500',
            'publish' => 'nullable|boolean',
        ];
    }

    protected function teacherFor(Request $request, LiveClass $lc): ?User
    {
        if ($request->user()->role === 'teacher') return $request->user();
        if ($request->filled('teacher_id')) return User::where('role', 'teacher')->find($request->teacher_id);
        return $lc->teacher ?: $lc->course?->teachers()->first();
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules(true));
        $course = $this->ownCourse($request, (int) $data['course_id']);
        $mode = $data['link_mode'] ?? ($request->filled('meet_link') ? 'manual' : 'google');
        if ($mode === 'manual' && empty($data['meet_link'])) throw ValidationException::withMessages(['meet_link' => 'Paste the Google Meet link, or choose "Generate automatically".']);

        $lc = new LiveClass([
            'course_id' => $course->id, 'title' => $data['title'], 'description' => $data['description'] ?? null,
            'starts_at' => Carbon::parse($data['starts_at'], config('app.timezone'))->setTimezone(config('app.timezone')), 'duration_minutes' => $data['duration_minutes'] ?? 60,
            'meet_link' => $mode === 'manual' ? $data['meet_link'] : null, 'link_source' => $mode, 'status' => 'draft', 'created_by' => $request->user()->id,
        ]);
        $lc->setRelation('course', $course);
        $teacher = $this->teacherFor($request, $lc);
        $lc->teacher_id = $teacher?->id;
        $lc->save();

        if ($mode === 'google') {
            try { $this->createGoogleEvent($lc, $teacher); }
            catch (\Throwable $e) { $lc->delete(); throw ValidationException::withMessages(['link_mode' => $e->getMessage()]); }
        }
        Activity::log('live.create', "Live class '{$lc->title}' created for {$course->code}", $lc, $data);
        if ($request->boolean('publish')) return $this->publish($request, $lc);
        return response()->json($this->present($lc->fresh($this->with())), 201);
    }

    protected function createGoogleEvent(LiveClass $lc, ?User $teacher): void
    {
        $acc = GoogleCalendar::accountFor($teacher);
        if (!GoogleCalendar::configured()) throw new \RuntimeException('Automatic Google Meet links are not set up yet (GOOGLE_CLIENT_ID missing). Paste a Meet link instead, or ask the admin to complete the Google setup.');
        if (!$acc) throw new \RuntimeException('Connect your Google account first (Live classes → Connect Google), or ask the admin to connect the college Google account. You can also paste a Meet link manually.');
        $ev = GoogleCalendar::create($lc, $acc);
        $lc->update(['google_event_id' => $ev['id'], 'google_event_link' => $ev['html_link'], 'meet_link' => $ev['meet'], 'google_account_id' => $acc->id, 'link_source' => 'google']);
    }

    /** Generate (or regenerate) a Meet link for an existing class. */
    public function generateLink(Request $request, LiveClass $liveClass)
    {
        $this->ownCourse($request, $liveClass->course_id);
        if ($liveClass->google_event_id) GoogleCalendar::delete($liveClass, false);
        try { $this->createGoogleEvent($liveClass, $liveClass->teacher ?: $request->user()); }
        catch (\Throwable $e) { throw ValidationException::withMessages(['link_mode' => $e->getMessage()]); }
        if ($liveClass->status === 'scheduled') $this->syncAttendees($liveClass->fresh(), true);
        return response()->json($this->present($liveClass->fresh($this->with())));
    }

    public function update(Request $request, LiveClass $liveClass)
    {
        $this->ownCourse($request, $liveClass->course_id);
        $data = $request->validate($this->rules(false));
        if (isset($data['course_id'])) $this->ownCourse($request, (int) $data['course_id']);
        $before = $liveClass->only(['starts_at', 'duration_minutes', 'meet_link', 'title']);
        $fill = collect($data)->only(['course_id', 'title', 'description', 'duration_minutes'])->all();
        if (isset($data['starts_at'])) $fill['starts_at'] = Carbon::parse($data['starts_at'], config('app.timezone'))->setTimezone(config('app.timezone'));
        if (($data['link_mode'] ?? null) === 'manual' && !empty($data['meet_link'])) $fill += ['meet_link' => $data['meet_link'], 'link_source' => 'manual'];
        if ($request->user()->role === 'admin' && $request->filled('teacher_id')) $fill['teacher_id'] = $data['teacher_id'];
        $liveClass->update($fill);
        if (isset($fill['starts_at'])) $liveClass->reminder_sent_at = null;
        $liveClass->save();

        $changed = $before['starts_at']?->ne($liveClass->starts_at) || $before['duration_minutes'] != $liveClass->duration_minutes || $before['meet_link'] !== $liveClass->meet_link || $before['title'] !== $liveClass->title;
        if ($liveClass->status === 'scheduled' && $changed) {
            $this->syncAttendees($liveClass, true);
            Notify::liveClassScheduled($liveClass->fresh(), 'updated');
        } elseif ($liveClass->google_event_id) {
            try { GoogleCalendar::update($liveClass, [], false); } catch (\Throwable $e) { report($e); }
        }
        Activity::log('live.update', "Live class #{$liveClass->id} updated", $liveClass, $data);
        return response()->json($this->present($liveClass->fresh($this->with())));
    }

    /** Send the class to every enrolled student: WhatsApp + email (+ .ics) + dashboard + Google Calendar invite. */
    public function publish(Request $request, LiveClass $liveClass)
    {
        $this->ownCourse($request, $liveClass->course_id);
        if (!$liveClass->meet_link) throw ValidationException::withMessages(['meet_link' => 'Generate or paste the Google Meet link before publishing.']);
        if ($liveClass->status === 'cancelled') throw ValidationException::withMessages(['status' => 'This class was cancelled.']);
        $first = $liveClass->status !== 'scheduled';
        $liveClass->update(['status' => 'scheduled', 'notified_at' => now()]);
        $this->syncAttendees($liveClass, true);
        Notify::liveClassScheduled($liveClass->fresh(), $first ? 'scheduled' : 'updated');
        Activity::log('live.publish', "Live class #{$liveClass->id} published to students", $liveClass);
        return response()->json($this->present($liveClass->fresh($this->with())) + ['message' => 'Published — '.Notify::courseStudents($liveClass->course_id)->count().' student(s) notified on WhatsApp, email and dashboard.']);
    }

    protected function syncAttendees(LiveClass $lc, bool $notify): void
    {
        if (!$lc->google_event_id) return;
        $emails = Notify::courseStudents($lc->course_id)->pluck('email')->push($lc->teacher?->email)->filter()->all();
        try { GoogleCalendar::update($lc, $emails, $notify); } catch (\Throwable $e) { report($e); }
    }

    public function cancel(Request $request, LiveClass $liveClass)
    {
        $this->ownCourse($request, $liveClass->course_id);
        $wasScheduled = $liveClass->status === 'scheduled';
        try { GoogleCalendar::delete($liveClass, $wasScheduled); } catch (\Throwable $e) { report($e); }
        $liveClass->update(['status' => 'cancelled', 'google_event_id' => null]);
        if ($wasScheduled) Notify::liveClassScheduled($liveClass, 'cancelled');
        Activity::log('live.cancel', "Live class #{$liveClass->id} cancelled", $liveClass);
        return response()->json($this->present($liveClass->fresh($this->with())));
    }

    /** After the class: mark completed and (optionally) publish the recording as a lecture. */
    public function complete(Request $request, LiveClass $liveClass)
    {
        $course = $this->ownCourse($request, $liveClass->course_id);
        $data = $request->validate(['recording_url' => 'nullable|url|max:500', 'save_as_lecture' => 'nullable|boolean']);
        $liveClass->update(['status' => 'completed', 'recording_url' => $data['recording_url'] ?? $liveClass->recording_url]);
        if (!empty($data['recording_url']) && $request->boolean('save_as_lecture')) {
            $lesson = $liveClass->lesson ?: new Lesson(['course_id' => $course->id, 'uploaded_by' => $request->user()->id, 'sort_order' => (int) Lesson::where('course_id', $course->id)->max('sort_order') + 1]);
            $lesson->fill(['chapter' => 'Live class recordings', 'title' => $liveClass->title.' (recording)', 'description' => $liveClass->description, 'type' => 'video', 'video_url' => $data['recording_url'], 'duration_minutes' => $liveClass->duration_minutes, 'is_published' => true])->save();
            $liveClass->update(['lesson_id' => $lesson->id]);
            Notify::lessonPublished($lesson);
        }
        Activity::log('live.complete', "Live class #{$liveClass->id} completed", $liveClass, $data);
        return response()->json($this->present($liveClass->fresh($this->with())));
    }

    public function destroy(Request $request, LiveClass $liveClass)
    {
        $this->ownCourse($request, $liveClass->course_id);
        if ($liveClass->status === 'scheduled' && $liveClass->starts_at->isFuture()) {
            try { GoogleCalendar::delete($liveClass, true); } catch (\Throwable $e) { report($e); }
            Notify::liveClassScheduled($liveClass, 'cancelled');
        } else {
            try { GoogleCalendar::delete($liveClass, false); } catch (\Throwable $e) { report($e); }
        }
        Activity::log('live.delete', "Live class #{$liveClass->id} deleted", $liveClass, $liveClass->toArray());
        $liveClass->delete();
        return response()->json(['ok' => true]);
    }

    // ---------------------------------------------------------------- students

    public function studentIndex(Request $request)
    {
        $courseIds = $request->user()->enrollments()->get()->filter->hasAccess()->pluck('course_id');
        $list = LiveClass::with(['course:id,code,title,slug', 'teacher:id,name', 'lesson:id,title'])->whereIn('course_id', $courseIds)
            ->whereIn('status', ['scheduled', 'completed', 'cancelled'])
            ->where('starts_at', '>=', now()->subDays(120))
            ->orderBy('starts_at')->get()
            ->map(fn ($lc) => collect($lc->toArray())->except(['google_event_id', 'google_account_id', 'google_event_link', 'created_by'])->all()
                + ['ics_url' => URL::temporarySignedRoute('files.live-ics', now()->addDays(60), ['liveClass' => $lc->id])]);
        return response()->json($list->values());
    }

    public function ics(LiveClass $liveClass)
    {
        $liveClass->loadMissing('course');
        return response($liveClass->ics(), 200, ['Content-Type' => 'text/calendar; charset=utf-8', 'Content-Disposition' => 'attachment; filename="live-class-'.$liveClass->id.'.ics"']);
    }
}
