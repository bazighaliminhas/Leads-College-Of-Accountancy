<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\Payment;
use Illuminate\Support\Facades\Storage;

/** Private files are only reachable through short-lived signed URLs. */
class FileController extends Controller
{
    public function lesson(Lesson $lesson, string $kind)
    {
        $path = $kind === 'video' ? $lesson->video_path : $lesson->attachment_path;
        abort_unless($path && Storage::disk('local')->exists($path), 404);
        $full = Storage::disk('local')->path($path);
        if ($kind === 'video') return response()->file($full, ['Content-Disposition' => 'inline', 'Cache-Control' => 'private, max-age=3600']);
        return response()->download($full, $lesson->attachment_name ?: basename($path));
    }

    public function payment(Payment $payment)
    {
        abort_unless($payment->screenshot_path && Storage::disk('local')->exists($payment->screenshot_path), 404);
        return response()->file(Storage::disk('local')->path($payment->screenshot_path));
    }
}
