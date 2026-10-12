<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ExamSession;
use App\Support\Activity;
use App\Support\Pricing;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Cart is stored in the database for guests (by token) and for logged-in users. */
class CartController extends Controller
{
    public static function resolve(Request $request, bool $create = true): ?Cart
    {
        $user = auth('sanctum')->user();
        $token = $request->header('X-Cart-Token');
        $cart = null;
        if ($user) $cart = Cart::where('user_id', $user->id)->where('status', 'active')->latest()->first();
        if (!$cart && $token) {
            $cart = Cart::where('token', $token)->where('status', 'active')->first();
            if ($cart && $user && !$cart->user_id) $cart->update(['user_id' => $user->id]);
            if ($cart && $user && $cart->user_id && $cart->user_id !== $user->id) $cart = null;
        }
        if (!$cart && $create) {
            $cart = Cart::create([
                'token' => $token && !Cart::where('token', $token)->exists() ? $token : (string) Str::uuid(),
                'user_id' => $user?->id,
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            ]);
        }
        return $cart;
    }

    public static function payload(Cart $cart)
    {
        $cart->load(['items.course.program', 'items.examSession']);
        return array_merge(['token' => $cart->token], Pricing::quote($cart->items, auth('sanctum')->user()));
    }

    public function show(Request $request)
    {
        return response()->json(self::payload(self::resolve($request)));
    }

    public function add(Request $request)
    {
        $data = $request->validate(['course_id' => 'required|exists:courses,id', 'exam_session_id' => 'nullable|exists:exam_sessions,id', 'replace' => 'boolean']);
        $course = Course::findOrFail($data['course_id']);
        if (!$course->canBeBought()) throw ValidationException::withMessages(['course_id' => 'This course is not open for online enrolment. Please contact admissions.']);
        if (!empty($data['exam_session_id']) && ExamSession::find($data['exam_session_id'])->program_id !== $course->program_id) {
            throw ValidationException::withMessages(['exam_session_id' => 'Invalid session for this course.']);
        }
        $user = auth('sanctum')->user();
        if ($user && Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->whereIn('status', ['pending', 'active'])->exists()) {
            throw ValidationException::withMessages(['course_id' => 'You are already enrolled in '.$course->code.'. Check your student dashboard.']);
        }
        $cart = self::resolve($request);
        $existing = $cart->items()->where('course_id', $course->id)->first();
        if ($existing && empty($data['replace'])) {
            return response()->json(['conflict' => true, 'message' => 'Course already in cart'] + self::payload($cart), 409);
        }
        if ($existing) $existing->delete();
        $item = $cart->items()->create(['course_id' => $course->id, 'exam_session_id' => $data['exam_session_id'] ?? null, 'price' => $course->fee]);
        $cart->touch();
        Activity::log('cart.add', "Added {$course->code} to cart", $item, $data);
        return response()->json(self::payload($cart));
    }

    public function remove(Request $request, int $item)
    {
        $cart = self::resolve($request);
        $row = $cart->items()->findOrFail($item);
        Activity::log('cart.remove', "Removed {$row->course?->code} from cart", $row);
        $row->delete();
        return response()->json(self::payload($cart));
    }

    public function clear(Request $request)
    {
        $cart = self::resolve($request);
        $cart->items()->delete();
        Activity::log('cart.clear', 'Cart cleared', $cart);
        return response()->json(self::payload($cart));
    }
}
