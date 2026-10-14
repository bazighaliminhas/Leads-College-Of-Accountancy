<?php

namespace App\Support;

use App\Models\GoogleAccount;
use App\Models\LiveClass;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Google Calendar + Meet via OAuth 2.0 (no extra packages).
 * A teacher connects their own Google account (they become the Meet host); if they have not,
 * the college Google account connected by the admin is used.
 * Creating an event with conferenceData generates the Meet link; adding students as attendees
 * makes Google send them the invite and the phone reminders from Google Calendar.
 */
class GoogleCalendar
{
    const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';
    const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    public static function configured(): bool
    {
        return config('services.google.client_id') && config('services.google.client_secret');
    }

    public static function redirectUri(): string
    {
        return config('services.google.redirect') ?: rtrim(config('app.url'), '/').'/google/callback';
    }

    /** $owner = null connects the college-wide account. */
    public static function authUrl(?User $owner, User $actor, string $return): string
    {
        if (!self::configured()) throw new RuntimeException('Google is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.');
        $state = Crypt::encryptString(json_encode(['owner' => $owner?->id, 'actor' => $actor->id, 'return' => $return, 'exp' => now()->addMinutes(20)->timestamp]));
        return 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => self::redirectUri(),
            'response_type' => 'code',
            'scope' => self::SCOPES,
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state,
        ]);
    }

    /** Handles the OAuth callback; returns [GoogleAccount, return path]. */
    public static function handleCallback(string $code, string $state): array
    {
        $s = json_decode(Crypt::decryptString($state), true);
        if (!$s || ($s['exp'] ?? 0) < time()) throw new RuntimeException('The Google sign-in link expired. Please try again.');
        $tok = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'code' => $code, 'client_id' => config('services.google.client_id'), 'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => self::redirectUri(), 'grant_type' => 'authorization_code',
        ])->throw()->json();
        $email = null;
        if (!empty($tok['id_token'])) {
            $parts = explode('.', $tok['id_token']);
            $claims = json_decode(base64_decode(strtr($parts[1] ?? '', '-_', '+/')), true);
            $email = $claims['email'] ?? null;
        }
        $acc = GoogleAccount::firstOrNew(['user_id' => $s['owner']]);
        $acc->fill([
            'email' => $email ?: $acc->email,
            'access_token' => $tok['access_token'],
            'refresh_token' => $tok['refresh_token'] ?? $acc->refresh_token,
            'expires_at' => now()->addSeconds(($tok['expires_in'] ?? 3600) - 60),
            'scopes' => $tok['scope'] ?? self::SCOPES,
        ])->save();
        return [$acc, $s['return'] ?? '/'];
    }

    public static function accountFor(?User $teacher): ?GoogleAccount
    {
        if ($teacher && ($a = GoogleAccount::where('user_id', $teacher->id)->whereNotNull('refresh_token')->first())) return $a;
        return GoogleAccount::whereNull('user_id')->whereNotNull('refresh_token')->first();
    }

    protected static function token(GoogleAccount $acc): string
    {
        if ($acc->access_token && $acc->expires_at && $acc->expires_at->isFuture()) return $acc->access_token;
        $res = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id' => config('services.google.client_id'), 'client_secret' => config('services.google.client_secret'),
            'refresh_token' => $acc->refresh_token, 'grant_type' => 'refresh_token',
        ]);
        if (!$res->successful()) throw new RuntimeException('Google access was revoked or expired — please reconnect the Google account. ('.$res->status().')');
        $acc->update(['access_token' => $res->json('access_token'), 'expires_at' => now()->addSeconds(($res->json('expires_in') ?? 3600) - 60)]);
        return $acc->access_token;
    }

    protected static function body(LiveClass $lc, array $attendees): array
    {
        $lc->loadMissing(['course', 'teacher']);
        $tz = config('app.timezone', 'Asia/Karachi');
        $body = [
            'summary' => "{$lc->course->code} — {$lc->title}",
            'description' => trim(($lc->description ? $lc->description."\n\n" : '')."Live class for {$lc->course->code} {$lc->course->title}\nTeacher: {$lc->teacher?->name}\nStudent portal: ".url('/student/live')."\n\n".config('app.name')),
            'start' => ['dateTime' => $lc->starts_at->copy()->timezone($tz)->toRfc3339String(), 'timeZone' => $tz],
            'end' => ['dateTime' => $lc->ends_at->copy()->timezone($tz)->toRfc3339String(), 'timeZone' => $tz],
            'reminders' => ['useDefault' => false, 'overrides' => [['method' => 'popup', 'minutes' => 30], ['method' => 'popup', 'minutes' => 10], ['method' => 'email', 'minutes' => 120]]],
            'guestsCanInviteOthers' => false,
            'guestsCanSeeOtherGuests' => false,
        ];
        if ($attendees) $body['attendees'] = array_values(array_map(fn ($e) => ['email' => $e], array_unique(array_filter($attendees, fn ($e) => filter_var($e, FILTER_VALIDATE_EMAIL)))));
        return $body;
    }

    /** Creates the calendar event and Meet link. Students are added later on publish. */
    public static function create(LiveClass $lc, GoogleAccount $acc, array $attendees = [], bool $notify = false): array
    {
        $body = self::body($lc, $attendees) + ['conferenceData' => ['createRequest' => ['requestId' => 'lca-'.$lc->id.'-'.Str::random(8), 'conferenceSolutionKey' => ['type' => 'hangoutsMeet']]]];
        $res = Http::withToken(self::token($acc))->post(self::API.'?'.http_build_query(['conferenceDataVersion' => 1, 'sendUpdates' => $notify ? 'all' : 'none']), $body);
        if (!$res->successful()) throw new RuntimeException('Google Calendar refused the request: '.($res->json('error.message') ?? $res->status()));
        $ev = $res->json();
        $meet = $ev['hangoutLink'] ?? collect($ev['conferenceData']['entryPoints'] ?? [])->firstWhere('entryPointType', 'video')['uri'] ?? null;
        return ['id' => $ev['id'], 'html_link' => $ev['htmlLink'] ?? null, 'meet' => $meet];
    }

    public static function update(LiveClass $lc, array $attendees, bool $notify = true): void
    {
        if (!$lc->google_event_id || !($acc = $lc->googleAccount)) return;
        $res = Http::withToken(self::token($acc))->patch(self::API.'/'.urlencode($lc->google_event_id).'?'.http_build_query(['conferenceDataVersion' => 1, 'sendUpdates' => $notify ? 'all' : 'none']), self::body($lc, $attendees));
        if (!$res->successful()) throw new RuntimeException('Could not update the Google Calendar event: '.($res->json('error.message') ?? $res->status()));
    }

    public static function delete(LiveClass $lc, bool $notify = true): void
    {
        if (!$lc->google_event_id || !($acc = $lc->googleAccount)) return;
        Http::withToken(self::token($acc))->delete(self::API.'/'.urlencode($lc->google_event_id).'?sendUpdates='.($notify ? 'all' : 'none'));
    }
}
