<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'You do not have permission to access this area.'], 403);
        }
        if ($user->status !== 'active') {
            return response()->json(['message' => 'Your account is blocked. Please contact the college.'], 403);
        }
        return $next($request);
    }
}
