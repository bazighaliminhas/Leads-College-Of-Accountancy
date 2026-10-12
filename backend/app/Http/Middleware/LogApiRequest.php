<?php

namespace App\Http\Middleware;

use App\Models\ActivityLog;
use App\Support\Activity;
use Closure;
use Illuminate\Http\Request;

/** Records every API call (who, what, when, from where) in activity_logs. */
class LogApiRequest
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        if ($request->is('api/track')) return $response; // page views are logged by the track endpoint itself
        try {
            ActivityLog::create([
                'user_id' => auth('sanctum')->id(),
                'visitor_id' => $request->header('X-Visitor-Id'),
                'action' => 'api.'.strtolower($request->method()),
                'description' => $request->method().' /'.$request->path(),
                'method' => $request->method(),
                'url' => mb_substr($request->fullUrl(), 0, 1000),
                'status_code' => $response->getStatusCode(),
                'payload' => $request->isMethod('get') ? ($request->query() ?: null) : Activity::clean($request->all()),
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
        return $response;
    }
}
