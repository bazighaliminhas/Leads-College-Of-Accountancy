<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Activity;
use App\Support\Pricing;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    /** Step 1: student details + terms -> creates the order (saved in DB) from the cart. */
    public function placeOrder(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:80',
            'last_name' => 'required|string|max:80',
            'email' => 'required|email',
            'phone' => 'required|string|max:30',
            'dob' => 'required|date|before:today',
            'cnic' => 'nullable|string|max:20',
            'city' => 'required|string|max:80',
            'country' => 'required|string|max:80',
            'address' => 'nullable|string|max:500',
            'registration_no' => 'nullable|string|max:50',
            'qualification' => 'nullable|string|max:150',
            'notes' => 'nullable|string|max:2000',
            'agree' => 'accepted',
        ]);
        $user = $request->user();
        $cart = CartController::resolve($request, false);
        if (!$cart || $cart->items()->count() === 0) throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
        $cart->load(['items.course.program', 'items.examSession']);
        foreach ($cart->items as $item) {
            if (Enrollment::where('user_id', $user->id)->where('course_id', $item->course_id)->whereIn('status', ['pending', 'active'])->exists()) {
                throw ValidationException::withMessages(['cart' => "You are already enrolled in {$item->course->code}. Please remove it from the cart."]);
            }
        }
        $quote = Pricing::quote($cart->items, $user);

        $order = DB::transaction(function () use ($data, $user, $cart, $quote, $request) {
            $order = Order::create([
                'order_no' => 'TMP-'.\Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'cart_id' => $cart->id,
                'subtotal' => $quote['subtotal'],
                'registration_fee' => $quote['registration_fee'],
                'total' => $quote['total'],
                'status' => 'pending_payment',
                'agreed_terms_at' => now(),
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            ] + collect($data)->except('agree')->all());
            $order->update(['order_no' => 'LCA-'.now()->format('ymd').'-'.str_pad((string) $order->id, 5, '0', STR_PAD_LEFT)]);
            foreach ($quote['items'] as $l) {
                $order->items()->create(['course_id' => $l['course_id'], 'exam_session_id' => $l['exam_session_id'], 'item_type' => 'course', 'code' => $l['code'], 'title' => $l['title'], 'session_name' => $l['session'], 'price' => $l['price']]);
                Enrollment::updateOrCreate(['user_id' => $user->id, 'course_id' => $l['course_id']], ['order_id' => $order->id, 'exam_session_id' => $l['exam_session_id'], 'status' => 'pending', 'granted_by' => null, 'granted_at' => null]);
            }
            foreach ($quote['registration'] as $r) {
                $slug = \App\Models\Program::find($r['program_id'])->slug;
                $order->items()->create(['item_type' => 'registration_fee', 'code' => 'REG-'.$slug, 'title' => $r['title'], 'price' => $r['price']]);
            }
            // keep the student profile up to date with what they entered
            $user->update(collect($data)->only(['first_name', 'last_name', 'phone', 'dob', 'cnic', 'city', 'country', 'address', 'registration_no', 'qualification'])->filter()->all() + ['name' => trim($data['first_name'].' '.$data['last_name'])]);
            $cart->update(['status' => 'converted']);
            return $order;
        });

        Activity::log('order.placed', "Order {$order->order_no} placed (PKR {$order->total})", $order, $data);
        Notify::orderPlaced($order);
        return response()->json(['order' => $order->load('items')], 201);
    }

    /** Step 2: upload the payment proof (any bank / app) with transaction details. */
    public function submitPayment(Request $request, Order $order)
    {
        abort_unless($order->user_id === $request->user()->id, 403);
        if (in_array($order->status, ['approved', 'cancelled'])) throw ValidationException::withMessages(['order' => 'This order can no longer accept payments.']);
        $data = $request->validate([
            'method' => 'required|string|max:60',
            'paid_from' => 'required|string|max:120',
            'account_title' => 'required|string|max:120',
            'account_number' => 'nullable|string|max:60',
            'paid_to' => 'nullable|string|max:160',
            'transaction_ref' => 'required|string|max:120',
            'amount' => 'required|numeric|min:1',
            'paid_on' => 'required|date|before_or_equal:today',
            'registration_no' => 'nullable|string|max:50',
            'note' => 'nullable|string|max:2000',
            'screenshot' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:8192',
        ]);
        $file = $request->file('screenshot');
        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $request->user()->id,
            'screenshot_path' => $file->store('payments', 'local'),
            'screenshot_name' => $file->getClientOriginalName(),
            'status' => 'submitted',
            'ip' => $request->ip(),
        ] + collect($data)->except(['screenshot', 'registration_no'])->all());
        $order->update(['status' => 'payment_submitted'] + ($request->filled('registration_no') ? ['registration_no' => $data['registration_no']] : []));
        if ($request->filled('registration_no')) $request->user()->update(['registration_no' => $data['registration_no']]);
        Activity::log('payment.submitted', "Payment proof for {$order->order_no}: {$data['method']} ref {$data['transaction_ref']} PKR {$data['amount']}", $payment, $data);
        Notify::paymentSubmitted($order, $payment);
        return response()->json(['order' => $order->fresh(['items', 'payments']), 'payment' => $payment], 201);
    }

    public function cancel(Request $request, Order $order)
    {
        abort_unless($order->user_id === $request->user()->id, 403);
        if ($order->status !== 'pending_payment') throw ValidationException::withMessages(['order' => 'Only unpaid orders can be cancelled.']);
        $order->update(['status' => 'cancelled']);
        $order->enrollments()->where('status', 'pending')->update(['status' => 'cancelled']);
        Activity::log('order.cancelled', "Student cancelled {$order->order_no}", $order);
        return response()->json(['order' => $order]);
    }

}
