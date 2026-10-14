<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GoogleAccount;
use App\Support\Activity;
use App\Support\GoogleCalendar;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Connect a Google account so live classes get automatic Google Meet links and Calendar invites. */
class GoogleController extends Controller
{
    public function status(Request $request)
    {
        $mine = GoogleAccount::where('user_id', $request->user()->id)->first();
        $college = GoogleAccount::whereNull('user_id')->first();
        return response()->json([
            'configured' => (bool) GoogleCalendar::configured(),
            'redirect_uri' => GoogleCalendar::redirectUri(),
            'mine' => $mine ? ['email' => $mine->email, 'connected_at' => $mine->updated_at] : null,
            'college' => $college ? ['email' => $college->email, 'connected_at' => $college->updated_at] : null,
        ]);
    }

    public function connect(Request $request)
    {
        $data = $request->validate(['scope' => 'nullable|in:me,college', 'return' => 'nullable|string|max:200']);
        $college = ($data['scope'] ?? 'me') === 'college';
        if ($college && $request->user()->role !== 'admin') abort(403);
        $return = $data['return'] ?? '/'.$request->user()->role.'/live';
        if (!str_starts_with($return, '/') || str_starts_with($return, '//')) $return = '/'.$request->user()->role.'/live';
        try {
            $url = GoogleCalendar::authUrl($college ? null : $request->user(), $request->user(), $return);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['google' => $e->getMessage()]);
        }
        return response()->json(['url' => $url]);
    }

    public function disconnect(Request $request)
    {
        $college = $request->input('scope') === 'college';
        if ($college && $request->user()->role !== 'admin') abort(403);
        GoogleAccount::where('user_id', $college ? null : $request->user()->id)->delete();
        Activity::log('google.disconnect', 'Google account disconnected ('.($college ? 'college' : 'personal').')');
        return response()->json(['ok' => true]);
    }

    /** Web route: Google redirects here after the user approves. */
    public function callback(Request $request)
    {
        if ($request->filled('error')) return redirect('/?google=denied');
        try {
            [$acc, $return] = GoogleCalendar::handleCallback((string) $request->code, (string) $request->state);
            Activity::log('google.connect', "Google account connected: {$acc->email}", $acc, [], $request, null);
            return redirect($return.(str_contains($return, '?') ? '&' : '?').'google=connected');
        } catch (\Throwable $e) {
            report($e);
            return redirect('/?google=error&message='.urlencode(mb_substr($e->getMessage(), 0, 200)));
        }
    }
}
