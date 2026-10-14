<?php

namespace App\Console\Commands;

use App\Models\LiveClass;
use App\Support\Notify;
use Illuminate\Console\Command;

/** Re-sends the Google Meet link ~30 minutes before every live class (WhatsApp + email + dashboard). */
class LiveClassReminders extends Command
{
    protected $signature = 'lca:live-reminders {--minutes=30}';
    protected $description = 'Send live class reminders with the Google Meet link to students and teachers';

    public function handle(): int
    {
        $soon = now()->addMinutes((int) $this->option('minutes') + 5);
        $list = LiveClass::with(['course', 'teacher'])->where('status', 'scheduled')->whereNull('reminder_sent_at')
            ->where('starts_at', '>', now())->where('starts_at', '<=', $soon)->get();
        foreach ($list as $lc) {
            $lc->update(['reminder_sent_at' => now()]);
            Notify::liveClassScheduled($lc, 'reminder');
            $this->info("Reminder sent: #{$lc->id} {$lc->title}");
        }
        // Mark classes that ended more than 3 hours ago as completed
        LiveClass::where('status', 'scheduled')->where('starts_at', '<', now()->subHours(3))->get()
            ->filter(fn ($lc) => $lc->ends_at->lt(now()->subHours(2)))->each->update(['status' => 'completed']);
        return self::SUCCESS;
    }
}
