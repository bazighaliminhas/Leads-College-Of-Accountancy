<?php

use Illuminate\Support\Facades\Schedule;

/*
| One cron entry runs everything:   * * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
| Locally you can instead keep `php artisan schedule:work` (or `php artisan queue:work`) running.
*/

// Deliver queued WhatsApp + email messages (works on shared hosting without a permanent worker)
Schedule::command('queue:work --stop-when-empty --tries=2 --max-time=55')->everyMinute()->withoutOverlapping()->runInBackground();

// Live class reminders with the Google Meet link, ~30 minutes before start
Schedule::command('lca:live-reminders')->everyFiveMinutes()->withoutOverlapping();

// Housekeeping
Schedule::command('queue:prune-failed --hours=720')->daily();
