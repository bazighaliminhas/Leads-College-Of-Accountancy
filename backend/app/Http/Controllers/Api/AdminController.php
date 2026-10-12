<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ContactMessage;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Inquiry;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Activity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function stats()
    {
        $months = collect(range(5, 0))->map(function ($i) {
            $d = now()->startOfMonth()->subMonths($i);
            return [
                'month' => $d->format('M Y'),
                'orders' => Order::whereBetween('created_at', [$d, $d->copy()->endOfMonth()])->count(),
                'revenue' => (float) Payment::where('status', 'verified')->whereBetween('verified_at', [$d, $d->copy()->endOfMonth()])->sum('amount'),
            ];
        });
        return response()->json([
            'counts' => [
                'students' => User::where('role', 'student')->count(),
                'teachers' => User::where('role', 'teacher')->count(),
                'courses' => Course::count(),
                'pending_courses' => Course::where('status', 'pending')->count(),
                'orders' => Order::count(),
                'awaiting_review' => Order::where('status', 'payment_submitted')->count(),
                'awaiting_payment' => Order::where('status', 'pending_payment')->count(),
                'pending_access' => Enrollment::where('status', 'pending')->count(),
                'active_enrollments' => Enrollment::where('status', 'active')->count(),
                'revenue' => (float) Payment::where('status', 'verified')->sum('amount'),
                'new_messages' => ContactMessage::where('status', 'new')->count(),
                'new_inquiries' => Inquiry::where('status', 'new')->count(),
            ],
            'months' => $months,
            'by_program' => DB::table('enrollments')->join('courses', 'courses.id', '=', 'enrollments.course_id')->join('programs', 'programs.id', '=', 'courses.program_id')
                ->where('enrollments.status', 'active')->groupBy('programs.name')->select('programs.name', DB::raw('count(*) as total'))->get(),
            'recent_orders' => Order::with('user:id,name')->latest()->limit(8)->get(),
            'recent_activity' => ActivityLog::with('user:id,name,role')->where('action', 'not like', 'api.%')->latest()->limit(12)->get(),
        ]);
    }

    /** Admin verifies the payment and (optionally) grants course access in one step. */
    public function approveOrder(Request $request, Order $order)
    {
        $data = $request->validate(['grant_access' => 'boolean', 'remarks' => 'nullable|string|max:2000', 'access_expires_on' => 'nullable|date']);
        DB::transaction(function () use ($order, $data, $request) {
            $order->payments()->where('status', 'submitted')->update(['status' => 'verified', 'verified_by' => $request->user()->id, 'verified_at' => now()]);
            $order->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'admin_remarks' => $data['remarks'] ?? $order->admin_remarks]);
            if ($data['grant_access'] ?? true) {
                foreach ($order->enrollments()->whereIn('status', ['pending', 'suspended'])->get() as $e) {
                    $e->update(['status' => 'active', 'granted_by' => $request->user()->id, 'granted_at' => now(), 'access_expires_on' => $data['access_expires_on'] ?? null]);
                    self::notifyEnrollment($e);
                }
            }
        });
        UserNotification::create(['user_id' => $order->user_id, 'type' => 'success', 'title' => 'Payment verified', 'body' => "Your payment for {$order->order_no} has been verified.", 'link' => '/student/orders']);
        Activity::log('admin.order.approve', "Approved {$order->order_no}", $order, $data);
        return response()->json($order->fresh(['items', 'payments', 'enrollments.course']));
    }

    public function rejectOrder(Request $request, Order $order)
    {
        $data = $request->validate(['remarks' => 'required|string|max:2000']);
        $order->payments()->where('status', 'submitted')->update(['status' => 'rejected', 'remarks' => $data['remarks'], 'verified_by' => $request->user()->id, 'verified_at' => now()]);
        $order->update(['status' => 'rejected', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'admin_remarks' => $data['remarks']]);
        UserNotification::create(['user_id' => $order->user_id, 'type' => 'error', 'title' => 'Payment not verified', 'body' => "{$order->order_no}: {$data['remarks']} — please upload a correct payment proof.", 'link' => '/student/orders']);
        Activity::log('admin.order.reject', "Rejected {$order->order_no}", $order, $data);
        return response()->json($order->fresh(['items', 'payments']));
    }

    /** Grant / revoke / suspend course access for a single enrollment. */
    public function setAccess(Request $request, Enrollment $enrollment)
    {
        $data = $request->validate(['status' => 'required|in:pending,active,suspended,completed,cancelled', 'access_expires_on' => 'nullable|date', 'remarks' => 'nullable|max:1000']);
        if ($data['status'] === 'active' && $enrollment->status !== 'active') { $data['granted_by'] = $request->user()->id; $data['granted_at'] = now(); }
        $old = $enrollment->status;
        $enrollment->update($data);
        if ($old !== $data['status']) self::notifyEnrollment($enrollment);
        Activity::log('admin.enrollment.access', "Enrollment #{$enrollment->id} {$old} → {$data['status']}", $enrollment, $data);
        return response()->json($enrollment->fresh(['user:id,name,email', 'course:id,code,title', 'granter:id,name']));
    }

    /** Admin enrols a student directly (e.g. paid in cash at campus) and grants access. */
    public function enrollStudent(Request $request)
    {
        $data = $request->validate(['user_id' => 'required|exists:users,id', 'course_ids' => 'required|array|min:1', 'course_ids.*' => 'exists:courses,id', 'status' => 'nullable|in:pending,active', 'exam_session_id' => 'nullable|exists:exam_sessions,id']);
        $status = $data['status'] ?? 'active';
        $out = [];
        foreach ($data['course_ids'] as $cid) {
            $e = Enrollment::updateOrCreate(['user_id' => $data['user_id'], 'course_id' => $cid], ['status' => $status, 'exam_session_id' => $data['exam_session_id'] ?? null] + ($status === 'active' ? ['granted_by' => $request->user()->id, 'granted_at' => now()] : []));
            self::notifyEnrollment($e);
            $out[] = $e;
        }
        Activity::log('admin.enrollment.manual', 'Manual enrolment', null, $data);
        return response()->json($out, 201);
    }

    public function assignTeachers(Request $request, Course $course)
    {
        $data = $request->validate(['teacher_ids' => 'present|array', 'teacher_ids.*' => 'exists:users,id']);
        $sync = collect($data['teacher_ids'])->mapWithKeys(fn ($id) => [$id => ['assigned_by' => $request->user()->id]]);
        $changes = $course->teachers()->sync($sync);
        foreach ($changes['attached'] as $tid) {
            UserNotification::create(['user_id' => $tid, 'title' => 'New course assigned', 'body' => "You have been assigned {$course->code} {$course->title}. You can now upload lectures.", 'link' => '/teacher/courses/'.$course->id]);
        }
        Activity::log('admin.course.teachers', "Teachers for {$course->code} updated", $course, $changes);
        return response()->json($course->load('teachers:id,name'));
    }

    public function settings()
    {
        return response()->json(Setting::orderBy('group')->orderBy('id')->get());
    }

    public function saveSettings(Request $request)
    {
        $data = $request->validate(['settings' => 'required|array']);
        foreach ($data['settings'] as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => is_array($value) ? json_encode($value) : $value]);
        }
        Activity::log('admin.settings.save', 'Settings updated', null, $data);
        return response()->json(Setting::orderBy('group')->get());
    }

    public function options()
    {
        return response()->json([
            'programs' => \App\Models\Program::orderBy('sort_order')->get(['id', 'name']),
            'levels' => \App\Models\Level::orderBy('program_id')->orderBy('sort_order')->get(['id', 'program_id', 'name']),
            'courses' => Course::orderBy('program_id')->orderBy('sort_order')->get(['id', 'program_id', 'code', 'title', 'status']),
            'teachers' => User::where('role', 'teacher')->orderBy('name')->get(['id', 'name', 'email']),
            'students' => User::where('role', 'student')->orderBy('name')->get(['id', 'name', 'email']),
            'sessions' => \App\Models\ExamSession::orderBy('program_id')->orderBy('sort_order')->get(['id', 'program_id', 'name']),
            'actions' => ActivityLog::select('action')->distinct()->orderBy('action')->pluck('action'),
        ]);
    }

    public static function notifyEnrollment(Enrollment $e): void
    {
        $e->loadMissing('course');
        $map = [
            'active' => ['success', 'Course access granted', "The admin has granted you access to {$e->course->code} {$e->course->title}. You can start learning now.", '/student/learn/'.$e->course->slug],
            'suspended' => ['error', 'Course access suspended', "Your access to {$e->course->code} has been suspended. Please contact the college.", '/student/courses'],
            'cancelled' => ['error', 'Enrolment cancelled', "Your enrolment in {$e->course->code} was cancelled.", '/student/courses'],
            'pending' => ['info', 'Enrolment pending', "Your enrolment in {$e->course->code} is awaiting admin permission.", '/student/courses'],
            'completed' => ['success', 'Course completed', "{$e->course->code} is marked as completed.", '/student/courses'],
        ];
        [$type, $title, $body, $link] = $map[$e->status] ?? $map['pending'];
        UserNotification::create(['user_id' => $e->user_id, 'type' => $type, 'title' => $title, 'body' => $body, 'link' => $link]);
    }
}
