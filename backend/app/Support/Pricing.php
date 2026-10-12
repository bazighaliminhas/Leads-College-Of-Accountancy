<?php

namespace App\Support;

use App\Models\Enrollment;
use App\Models\OrderItem;
use App\Models\Program;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Fee calculation. No discounts are applied: total = course fees + one-time
 * college registration fee per programme (only for a student's first admission in that programme).
 */
class Pricing
{
    public static function quote(Collection $items, ?User $user): array
    {
        $lines = [];
        $subtotal = 0;
        foreach ($items as $item) {
            $course = $item->course;
            $price = (float) ($course->fee ?? 0);
            $subtotal += $price;
            $lines[] = [
                'id' => $item->id,
                'course_id' => $course->id,
                'program_id' => $course->program_id,
                'code' => $course->code,
                'title' => $course->title,
                'slug' => $course->slug,
                'program' => $course->program?->name,
                'session' => $item->examSession?->name,
                'exam_session_id' => $item->exam_session_id,
                'price' => $price,
            ];
        }

        $regLines = [];
        $programIds = collect($lines)->pluck('program_id')->unique();
        foreach ($programIds as $pid) {
            $program = Program::find($pid);
            if (!$program || $program->registration_fee <= 0) continue;
            if ($user && self::alreadyRegistered($user, $program)) continue;
            $regLines[] = ['program_id' => $program->id, 'program' => $program->name, 'title' => $program->name.' College Registration Fee', 'price' => (float) $program->registration_fee];
        }
        $registration = array_sum(array_column($regLines, 'price'));

        return [
            'items' => $lines,
            'registration' => $regLines,
            'subtotal' => $subtotal,
            'registration_fee' => $registration,
            'total' => $subtotal + $registration,
            'count' => count($lines),
        ];
    }

    public static function alreadyRegistered(User $user, Program $program): bool
    {
        $paidReg = OrderItem::where('item_type', 'registration_fee')->where('code', 'REG-'.$program->slug)
            ->whereHas('order', fn ($q) => $q->where('user_id', $user->id)->whereIn('status', ['payment_submitted', 'approved']))->exists();
        if ($paidReg) return true;
        return Enrollment::where('user_id', $user->id)->whereIn('status', ['active', 'completed'])
            ->whereHas('course', fn ($q) => $q->where('program_id', $program->id))->exists();
    }
}
