<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** One branded HTML email template for every notification the college sends. */
class LcaMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public array $p) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->p['subject'] ?? config('app.name'));
    }

    public function content(): Content
    {
        return new Content(html: 'emails.lca', text: 'emails.lca-text', with: ['p' => $this->p, 'college' => config('app.name'), 'site' => rtrim(config('app.url'), '/')]);
    }

    public function attachments(): array
    {
        if (empty($this->p['ics'])) return [];
        $ics = $this->p['ics'];
        return [Attachment::fromData(fn () => $ics, $this->p['ics_name'] ?? 'live-class.ics')->withMime('text/calendar; charset=utf-8; method=PUBLISH')];
    }
}
