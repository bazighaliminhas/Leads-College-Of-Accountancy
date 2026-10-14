<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class LiveClass extends Model
{
    protected $guarded = ['id'];
    protected $casts = ['starts_at' => 'datetime', 'notified_at' => 'datetime', 'reminder_sent_at' => 'datetime'];
    protected $appends = ['ends_at', 'is_live', 'calendar_url', 'phase'];

    public function course() { return $this->belongsTo(Course::class); }
    public function teacher() { return $this->belongsTo(User::class, 'teacher_id'); }
    public function lesson() { return $this->belongsTo(Lesson::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function googleAccount() { return $this->belongsTo(GoogleAccount::class); }

    public function getEndsAtAttribute(): ?Carbon { return $this->starts_at?->copy()->addMinutes($this->duration_minutes ?: 60); }

    /** Students can join from 15 minutes before the start until the end. */
    public function getIsLiveAttribute(): bool
    {
        if ($this->status !== 'scheduled' || !$this->starts_at) return false;
        return now()->between($this->starts_at->copy()->subMinutes(15), $this->ends_at);
    }

    public function getPhaseAttribute(): string
    {
        if (in_array($this->status, ['draft', 'cancelled'])) return $this->status;
        if ($this->status === 'completed' || ($this->ends_at && $this->ends_at->isPast())) return 'past';
        return $this->is_live ? 'live' : 'upcoming';
    }

    /** "Add to Google Calendar" link — works for any student without any API setup. */
    public function getCalendarUrlAttribute(): ?string
    {
        if (!$this->starts_at) return null;
        $fmt = fn (Carbon $d) => $d->copy()->utc()->format('Ymd\THis\Z');
        $details = trim(($this->description ? $this->description."\n\n" : '').($this->meet_link ? "Join Google Meet: {$this->meet_link}\n" : '')."Portal: ".url('/student/live'));
        return 'https://calendar.google.com/calendar/render?'.http_build_query([
            'action' => 'TEMPLATE',
            'text' => ($this->course?->code ? $this->course->code.' — ' : '').$this->title,
            'dates' => $fmt($this->starts_at).'/'.$fmt($this->ends_at),
            'details' => $details,
            'location' => $this->meet_link ?: url('/student/live'),
        ]);
    }

    /** iCalendar file (attached to emails, downloadable from the portal) with a 30-min alarm. */
    public function ics(): string
    {
        $fmt = fn (Carbon $d) => $d->copy()->utc()->format('Ymd\THis\Z');
        $esc = fn ($s) => str_replace(["\\", ";", ",", "\r\n", "\n"], ["\\\\", "\;", "\\,", "\\n", "\\n"], (string) $s);
        $title = ($this->course?->code ? $this->course->code.' — ' : '').$this->title;
        $desc = ($this->description ? $this->description."\n\n" : '').($this->meet_link ? "Join: {$this->meet_link}" : '');
        $lines = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Leads College of Accountancy//Live Classes//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:live-class-'.$this->id.'@'.parse_url(config('app.url'), PHP_URL_HOST),
            'DTSTAMP:'.$fmt(now()),
            'DTSTART:'.$fmt($this->starts_at),
            'DTEND:'.$fmt($this->ends_at),
            'SUMMARY:'.$esc($title),
            'DESCRIPTION:'.$esc($desc),
            'LOCATION:'.$esc($this->meet_link ?: url('/student/live')),
            $this->meet_link ? 'URL:'.$this->meet_link : null,
            'STATUS:'.($this->status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
            'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:'.$esc($title.' starts in 30 minutes'), 'END:VALARM',
            'BEGIN:VALARM', 'TRIGGER:-PT1440M', 'ACTION:DISPLAY', 'DESCRIPTION:'.$esc($title.' is tomorrow'), 'END:VALARM',
            'END:VEVENT', 'END:VCALENDAR',
        ];
        return implode("\r\n", array_filter($lines))."\r\n";
    }
}
