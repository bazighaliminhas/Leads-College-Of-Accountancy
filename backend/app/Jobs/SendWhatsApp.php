<?php

namespace App\Jobs;

use App\Models\MessageLog;
use App\Support\WhatsApp;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWhatsApp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $backoff = 60;

    public function __construct(public int $logId) {}

    public function handle(): void
    {
        $log = MessageLog::find($this->logId);
        if (!$log || $log->status === 'sent') return;
        $res = WhatsApp::send($log->recipient, (string) $log->body);
        $log->update([
            'status' => ($res['success'] ?? false) ? 'sent' : (($res['skipped'] ?? false) ? 'skipped' : 'failed'),
            'error' => ($res['success'] ?? false) ? null : ($res['error'] ?? 'Unknown error'),
            'sent_at' => ($res['success'] ?? false) ? now() : null,
        ]);
    }
}
