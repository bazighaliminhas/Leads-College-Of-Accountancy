<?php

namespace App\Jobs;

use App\Models\LiveClass;
use App\Support\GoogleCalendar;
use App\Support\Notify;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** When a student gains access, add them to the course's upcoming Google Calendar live-class events (Google emails them the invite). */
class SyncLiveClassAttendees implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $courseId) {}

    public function handle(): void
    {
        $classes = LiveClass::with(['course', 'teacher', 'googleAccount'])->where('course_id', $this->courseId)->where('status', 'scheduled')
            ->whereNotNull('google_event_id')->where('starts_at', '>=', now())->get();
        if ($classes->isEmpty()) return;
        $emails = Notify::courseStudents($this->courseId)->pluck('email');
        foreach ($classes as $lc) {
            try { GoogleCalendar::update($lc, $emails->push($lc->teacher?->email)->filter()->all(), true); } catch (\Throwable $e) { report($e); }
        }
    }
}
