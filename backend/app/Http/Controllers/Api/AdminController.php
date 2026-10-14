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
use App\Support\Ai;
use App\Support\GoogleCalendar;
use App\Support\Notify;
use App\Support\WhatsApp;
use App\Jobs\SyncLiveClassAttendees;
use App\Models\LiveClass;
use App\Models\MessageLog;
use App\Models\Quiz;
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
                'live_upcoming' => LiveClass::where('status', 'scheduled')->where('starts_at', '>=', now()->subHours(2))->count(),
                'quizzes' => Quiz::count(),
                'messages_failed' => MessageLog::where('status', 'failed')->where('created_at', '>=', now()->subDays(7))->count(),
                'messages_sent' => MessageLog::where('status', 'sent')->where('created_at', '>=', now()->subDays(7))->count(),
            ],
            'live' => LiveClass::with(['course:id,code,title', 'teacher:id,name'])->whereIn('status', ['scheduled', 'draft'])->where('starts_at', '>=', now()->subHours(2))->orderBy('starts_at')->limit(6)->get(),
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
        $granted = $data['grant_access'] ?? true;
        DB::transaction(function () use ($order, $data, $request) {
            $order->payments()->where('status', 'submitted')->update(['status' => 'verified', 'verified_by' => $request->user()->id, 'verified_at' => now()]);
            $order->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'admin_remarks' => $data['remarks'] ?? $order->admin_remarks]);
            if ($data['grant_access'] ?? true) {
                foreach ($order->enrollments()->whereIn('status', ['pending', 'suspended'])->get() as $e) {
                    $e->update(['status' => 'active', 'granted_by' => $request->user()->id, 'granted_at' => now(), 'access_expires_on' => $data['access_expires_on'] ?? null]);
                }
            }
        });
        Notify::orderApproved($order->fresh(), $granted);
        if ($granted) $order->enrollments()->pluck('course_id')->each(fn ($cid) => SyncLiveClassAttendees::dispatch($cid));
        Activity::log('admin.order.approve', "Approved {$order->order_no}", $order, $data);
        return response()->json($order->fresh(['items', 'payments', 'enrollments.course']));
    }

    public function rejectOrder(Request $request, Order $order)
    {
        $data = $request->validate(['remarks' => 'required|string|max:2000']);
        $order->payments()->where('status', 'submitted')->update(['status' => 'rejected', 'remarks' => $data['remarks'], 'verified_by' => $request->user()->id, 'verified_at' => now()]);
        $order->update(['status' => 'rejected', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'admin_remarks' => $data['remarks']]);
        Notify::orderRejected($order, $data['remarks']);
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
            if ($t = User::find($tid)) Notify::coursesAssigned($t, collect([$course]));
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
        PublicController::flushCache();
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
        Notify::enrollmentChanged($e);
        SyncLiveClassAttendees::dispatch($e->course_id);
    }

    /**
     * Send direct WhatsApp message to any student / number.
     */
    public function sendWhatsApp(Request $request)
    {
        $data = $request->validate([
            'phone' => 'nullable|string|max:40',
            'user_id' => 'nullable|exists:users,id',
            'message' => 'required|string|max:4000',
        ]);

        $phone = $data['phone'] ?? null;
        if (!$phone && !empty($data['user_id'])) {
            $user = User::find($data['user_id']);
            $phone = $user?->phone;
        }

        if (!$phone) {
            return response()->json(['message' => 'A valid phone number or user with a phone number is required.'], 422);
        }

        $res = WhatsApp::send($phone, $data['message']);
        if (!($res['success'] ?? false)) {
            return response()->json(['message' => $res['error'] ?? 'Failed to send WhatsApp message.', 'details' => $res], 400);
        }

        Activity::log('admin.whatsapp.send', "Admin sent WhatsApp to {$phone}", null, ['phone' => $phone, 'preview' => mb_substr($data['message'], 0, 100)]);
        return response()->json(['message' => 'WhatsApp message delivered successfully.', 'data' => $res]);
    }

    /**
     * Test Kapso WhatsApp connection to Admin number.
     */
    public function testWhatsApp(Request $request)
    {
        $adminPhone = $request->input('phone') ?: config('whatsapp.admin_phone');
        if (!$adminPhone) return response()->json(['message' => 'Set ADMIN_WHATSAPP_NUMBER in .env or enter a number.'], 422);
        $college = config('app.name', 'Leads College of Accountancy');
        $message = "🧪 *KAPSO WHATSAPP TEST*\n\n"
                 . "This is a test notification from *{$college}*.\n"
                 . "Kapso WhatsApp Cloud API is successfully connected and working!\n\n"
                 . "⏰ Time: " . now()->format('d M Y, h:i A') . "\n"
                 . "👤 Initiated by: " . $request->user()->name;

        $res = WhatsApp::send($adminPhone, $message);
        if (!($res['success'] ?? false)) {
            return response()->json(['message' => 'Test message failed to send: ' . ($res['error'] ?? 'Unknown error'), 'details' => $res], 400);
        }

        Activity::log('admin.whatsapp.test', "Admin tested WhatsApp connection to {$adminPhone}");
        return response()->json(['message' => "Test WhatsApp message sent to {$adminPhone}", 'data' => $res]);
    }

    /** Status of every outside service, shown in Admin → Integrations. */
    public function integrations(Request $request)
    {
        $mail = config('mail.default');
        return response()->json([
            'whatsapp' => ['enabled' => (bool) config('whatsapp.enabled'), 'configured' => WhatsApp::enabled(), 'admin_phone' => config('whatsapp.admin_phone'), 'template' => config('whatsapp.template_name')],
            'email' => ['mailer' => $mail, 'configured' => !in_array($mail, ['log', 'array']), 'host' => config("mail.mailers.$mail.host"), 'from' => config('mail.from.address'), 'admin_email' => config('whatsapp.admin_email')],
            'ai' => ['configured' => Ai::enabled(), 'provider' => Ai::provider()],
            'google' => ['configured' => (bool) GoogleCalendar::configured(), 'redirect_uri' => GoogleCalendar::redirectUri(), 'college' => \App\Models\GoogleAccount::whereNull('user_id')->first(['email', 'updated_at']), 'teachers' => \App\Models\GoogleAccount::whereNotNull('user_id')->with('user:id,name')->get(['id', 'user_id', 'email'])],
            'queue' => ['connection' => config('queue.default'), 'pending' => DB::table('jobs')->count(), 'failed' => DB::table('failed_jobs')->count()],
            'messages' => MessageLog::selectRaw('channel, status, count(*) as total')->where('created_at', '>=', now()->subDays(30))->groupBy('channel', 'status')->get(),
            'app_url' => config('app.url'),
        ]);
    }

    /** Sends a test email immediately (not queued) so SMTP problems show up straight away. */
    public function testEmail(Request $request)
    {
        $to = $request->input('email') ?: config('whatsapp.admin_email') ?: $request->user()->email;
        try {
            \Illuminate\Support\Facades\Mail::to($to)->send(new \App\Mail\LcaMail([
                'subject' => 'Test email — '.config('app.name'), 'title' => 'Email is working', 'eyebrow' => 'System test', 'tone' => 'success',
                'greeting' => 'Hello,', 'intro' => ['This is a test message from your Leads College website. Students and admins will receive admission, payment, course access and live class emails in this format.'],
                'details' => ['Sent by' => $request->user()->name, 'Time' => now()->format('d M Y, h:i A'), 'Mail server' => config('mail.mailers.'.config('mail.default').'.host') ?: config('mail.default')],
                'cta' => ['label' => 'Open admin panel', 'url' => url('/admin')],
            ]));
            MessageLog::create(['channel' => 'email', 'recipient' => $to, 'subject' => 'Test email', 'status' => 'sent', 'sent_at' => now()]);
            return response()->json(['message' => "Test email sent to {$to}. Check the inbox (and spam folder)."]);
        } catch (\Throwable $e) {
            MessageLog::create(['channel' => 'email', 'recipient' => $to, 'subject' => 'Test email', 'status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 1000)]);
            return response()->json(['message' => 'Email failed: '.mb_substr($e->getMessage(), 0, 300)], 400);
        }
    }

    /** Re-queue failed WhatsApp / email messages. */
    public function retryMessages()
    {
        $n = 0;
        MessageLog::where('status', 'failed')->where('created_at', '>=', now()->subDays(7))->where('subject', '!=', 'Test email')->limit(200)->get()->each(function ($log) use (&$n) {
            if ($log->channel !== 'whatsapp') return; // emails keep their full payload only inside the queued job
            $log->update(['status' => 'queued', 'error' => null]);
            \App\Jobs\SendWhatsApp::dispatch($log->id);
            $n++;
        });
        return response()->json(['message' => "{$n} WhatsApp message(s) queued again."]);
    }
}
