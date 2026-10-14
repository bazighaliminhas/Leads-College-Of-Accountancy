<?php

namespace App\Jobs;

use App\Mail\LcaMail;
use App\Models\MessageLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $backoff = 60;

    public function __construct(public int $logId, public array $payload) {}

    public function handle(): void
    {
        $log = MessageLog::find($this->logId);
        if (!$log || $log->status === 'sent') return;
        try {
            Mail::to($log->recipient, $this->payload['name'] ?? null)->send(new LcaMail($this->payload));
            $log->update(['status' => 'sent', 'error' => null, 'sent_at' => now()]);
        } catch (\Throwable $e) {
            $log->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 1000)]);
            if ($this->attempts() < $this->tries) throw $e;
        }
    }
}
