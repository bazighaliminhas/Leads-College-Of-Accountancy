<?php

namespace App\Support;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class Activity
{
    public const SECRET_KEYS = ['password', 'password_confirmation', 'current_password', 'new_password', 'token'];

    public static function log(string $action, ?string $description = null, $subject = null, array $payload = [], ?Request $request = null, ?int $userId = null): void
    {
        $request ??= request();
        try {
            ActivityLog::create([
                'user_id' => $userId ?? $request?->user()?->id ?? auth('sanctum')->id(),
                'visitor_id' => $request?->header('X-Visitor-Id'),
                'action' => $action,
                'description' => $description ? mb_substr($description, 0, 1000) : null,
                'subject_type' => $subject ? class_basename($subject) : null,
                'subject_id' => $subject?->id,
                'method' => $request?->method(),
                'url' => $request ? mb_substr($request->fullUrl(), 0, 1000) : null,
                'payload' => $payload ? self::clean($payload) : null,
                'ip' => $request?->ip(),
                'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 500) : null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public static function clean(array $data): array
    {
        $out = [];
        foreach ($data as $k => $v) {
            if (in_array($k, self::SECRET_KEYS, true)) { $out[$k] = '***'; continue; }
            if ($v instanceof UploadedFile) { $out[$k] = ['file' => $v->getClientOriginalName(), 'size' => $v->getSize()]; continue; }
            if (is_array($v)) { $out[$k] = self::clean($v); continue; }
            $out[$k] = is_string($v) ? mb_substr($v, 0, 500) : $v;
        }
        return $out;
    }
}
