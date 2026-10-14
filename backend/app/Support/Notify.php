<?php

namespace App\Support;

use App\Jobs\SendEmail;
use App\Jobs\SendWhatsApp;
use App\Models\Announcement;
use App\Models\ContactMessage;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Inquiry;
use App\Models\Lesson;
use App\Models\LiveClass;
use App\Models\MessageLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Quiz;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * One place for every message the college sends.
 * Each event goes to three channels: the portal (dashboard bell), WhatsApp (Kapso) and email (SMTP).
 * WhatsApp + email are queued (jobs table) so pages stay fast — run `php artisan queue:work`
 * (or the scheduler, see README) to deliver them.
 */
class Notify
{
    // ------------------------------------------------------------------ core

    /**
     * @param array{title:string, body?:string, link?:string, type?:string, details?:array, cta?:string,
     *              email?:array|false, whatsapp?:string|false, dashboard?:bool} $m
     */
    public static function user(User $user, array $m): void
    {
        try {
            if ($m['dashboard'] ?? true) {
                UserNotification::create(['user_id' => $user->id, 'type' => $m['type'] ?? 'info', 'title' => mb_substr($m['title'], 0, 200), 'body' => $m['body'] ?? null, 'link' => $m['link'] ?? null]);
            }
            $first = $user->first_name ?: $user->name;
            if (($m['whatsapp'] ?? null) !== false && $user->phone) {
                self::whatsapp($user->phone, is_string($m['whatsapp'] ?? null) ? $m['whatsapp'] : self::waText($m, $first), $user->id);
            }
            if (($m['email'] ?? null) !== false && $user->email) {
                self::email($user->email, $user->name, self::emailPayload($m, $first), $user->id);
            }
        } catch (\Throwable $e) {
            Log::error('[Notify] '.$e->getMessage());
        }
    }

    /** Portal notification for every admin + one WhatsApp to ADMIN_WHATSAPP_NUMBER + one email to ADMIN_EMAIL. */
    public static function admins(array $m): void
    {
        try {
            User::where('role', 'admin')->where('status', 'active')->get()->each(fn ($a) => UserNotification::create(['user_id' => $a->id, 'type' => 'admin', 'title' => mb_substr($m['title'], 0, 200), 'body' => $m['body'] ?? null, 'link' => $m['link'] ?? null]));
            $m['eyebrow'] ??= 'Admin alert';
            if ($phone = config('whatsapp.admin_phone')) self::whatsapp($phone, is_string($m['whatsapp'] ?? null) ? $m['whatsapp'] : self::waText($m, null, '🔔 '));
            if ($email = config('whatsapp.admin_email')) self::email($email, 'Admin', self::emailPayload($m, 'Admin'));
        } catch (\Throwable $e) {
            Log::error('[Notify admins] '.$e->getMessage());
        }
    }

    /** Every student with active access to a course. */
    public static function courseStudents(int $courseId): Collection
    {
        return User::whereIn('id', Enrollment::where('course_id', $courseId)->where('status', 'active')->pluck('user_id'))->where('status', 'active')->get();
    }

    public static function whatsapp(string $phone, string $text, ?int $userId = null): void
    {
        $log = MessageLog::create(['channel' => 'whatsapp', 'user_id' => $userId, 'recipient' => $phone, 'subject' => mb_substr(strtok($text, "\n") ?: '', 0, 250), 'body' => $text, 'status' => 'queued']);
        SendWhatsApp::dispatch($log->id);
    }

    public static function email(string $to, ?string $name, array $payload, ?int $userId = null): void
    {
        $payload['name'] = $name;
        $log = MessageLog::create(['channel' => 'email', 'user_id' => $userId, 'recipient' => $to, 'subject' => mb_substr($payload['subject'] ?? '', 0, 250), 'body' => implode("\n", (array) ($payload['intro'] ?? [])), 'status' => 'queued']);
        SendEmail::dispatch($log->id, $payload);
    }

    protected static function url(?string $path): string
    {
        if (!$path) return rtrim(config('app.url'), '/');
        return preg_match('#^https?://#', $path) ? $path : rtrim(config('app.url'), '/').'/'.ltrim($path, '/');
    }

    protected static function waText(array $m, ?string $first, string $icon = ''): string
    {
        $t = ($m['wa_icon'] ?? $icon).'*'.mb_strtoupper($m['title']).'*'."\n_".config('app.name')."_\n\n";
        if ($first) $t .= "Dear *{$first}*,\n";
        if (!empty($m['body'])) $t .= $m['body']."\n";
        foreach ($m['details'] ?? [] as $k => $v) if ($v !== null && $v !== '') $t .= "\n• *{$k}:* {$v}";
        if (!empty($m['link'])) $t .= "\n\n🔗 ".self::url($m['link']);
        return trim($t);
    }

    protected static function emailPayload(array $m, ?string $first): array
    {
        $e = is_array($m['email'] ?? null) ? $m['email'] : [];
        return $e + [
            'subject' => $m['title'].' — '.config('app.name'),
            'title' => $m['title'],
            'eyebrow' => $m['eyebrow'] ?? null,
            'greeting' => $first ? "Dear {$first}," : null,
            'intro' => array_values(array_filter([$m['body'] ?? null])),
            'details' => array_filter($m['details'] ?? [], fn ($v) => $v !== null && $v !== ''),
            'cta' => !empty($m['link']) ? ['label' => $m['cta'] ?? 'Open your portal', 'url' => self::url($m['link'])] : null,
            'tone' => $m['tone'] ?? 'info',
        ];
    }

    protected static function pkr($n): string { return 'PKR '.number_format((float) $n); }

    // ------------------------------------------------------------------ admissions

    public static function orderPlaced(Order $order): void
    {
        $order->loadMissing(['items', 'user']);
        $papers = $order->items->where('item_type', 'course')->pluck('code')->join(', ');
        $details = ['Order no.' => $order->order_no, 'Papers' => $papers, 'Total payable' => self::pkr($order->total)];
        if ($order->user) self::user($order->user, [
            'title' => 'Admission order received', 'type' => 'info', 'eyebrow' => 'Step 1 of 3 · Order placed', 'wa_icon' => '🧾 ',
            'body' => "Your admission order {$order->order_no} has been created. Please pay through any bank or mobile wallet and upload the payment screenshot with the transaction ID.",
            'details' => $details, 'link' => '/student/orders', 'cta' => 'Upload payment proof',
            'email' => ['outro' => ['Your courses unlock as soon as the admin verifies your payment. You will receive a confirmation on WhatsApp and email.']],
        ]);
        self::admins(['title' => 'New admission order', 'wa_icon' => '🛒 ', 'body' => "{$order->first_name} {$order->last_name} placed order {$order->order_no}.",
            'details' => $details + ['Phone' => $order->phone, 'Email' => $order->email], 'link' => '/admin/orders', 'cta' => 'Review order']);
    }

    public static function paymentSubmitted(Order $order, Payment $payment): void
    {
        $order->loadMissing('user');
        $details = ['Order no.' => $order->order_no, 'Amount' => self::pkr($payment->amount), 'Method' => trim($payment->method.' '.($payment->paid_from ? "({$payment->paid_from})" : '')), 'Transaction ID' => $payment->transaction_ref];
        if ($order->user) self::user($order->user, [
            'title' => 'Payment proof received', 'type' => 'info', 'eyebrow' => 'Step 2 of 3 · Under review', 'wa_icon' => '✅ ',
            'body' => 'We have received your payment proof. Our accounts team is verifying it — your course access will be activated right after verification.',
            'details' => $details, 'link' => '/student/orders', 'cta' => 'Track your order',
        ]);
        self::admins(['title' => 'Payment proof submitted', 'wa_icon' => '💳 ', 'body' => "{$order->first_name} {$order->last_name} uploaded a payment proof. Please verify the screenshot and grant course access.",
            'details' => $details, 'link' => '/admin/orders', 'cta' => 'Verify payment']);
    }

    public static function orderApproved(Order $order, bool $granted): void
    {
        $order->loadMissing(['user', 'enrollments.course']);
        if (!$order->user) return;
        $courses = $order->enrollments->where('status', 'active')->map(fn ($e) => $e->course?->code.' — '.$e->course?->title)->filter()->values();
        self::user($order->user, [
            'title' => $granted ? 'You are enrolled — course access granted' : 'Payment verified', 'type' => 'success', 'tone' => 'success', 'wa_icon' => '🎉 ',
            'eyebrow' => $granted ? 'Step 3 of 3 · Enrolled' : 'Payment verified',
            'body' => $granted ? "Your payment for {$order->order_no} has been verified and the admin has granted you access. Your lectures, study material, quizzes and live classes are now open in your student portal." : "Your payment for {$order->order_no} has been verified. Course access will be granted shortly.",
            'details' => ['Order no.' => $order->order_no] + ($courses->isNotEmpty() ? ['Courses' => $courses->join(', ')] : []),
            'link' => $granted ? '/student/courses' : '/student/orders', 'cta' => $granted ? 'Start learning' : 'View order',
            'email' => $granted ? ['outro' => ['Live classes are held on Google Meet — you will receive the link here, on WhatsApp and in your dashboard before every class.', 'We wish you every success in your exams.']] : [],
        ]);
    }

    public static function orderRejected(Order $order, string $remarks): void
    {
        $order->loadMissing('user');
        if (!$order->user) return;
        self::user($order->user, [
            'title' => 'Payment could not be verified', 'type' => 'error', 'tone' => 'danger', 'wa_icon' => '⚠️ ', 'eyebrow' => 'Action needed',
            'body' => "We could not verify the payment proof for {$order->order_no}. Please check the reason below and upload a clear screenshot of the correct transaction.",
            'details' => ['Order no.' => $order->order_no, 'Reason' => $remarks], 'link' => '/student/orders', 'cta' => 'Upload new proof',
        ]);
    }

    public static function enrollmentChanged(Enrollment $e): void
    {
        $e->loadMissing(['user', 'course']);
        if (!$e->user || !$e->course) return;
        $c = "{$e->course->code} — {$e->course->title}";
        $map = [
            'active' => ['Course access granted', 'success', 'success', "You now have access to {$c}. Lectures, study material, quizzes and live classes are open in your portal.", '/student/learn/'.$e->course->slug, 'Start learning', '🎓 '],
            'suspended' => ['Course access suspended', 'error', 'danger', "Your access to {$c} has been suspended. Please contact the college for help.", '/student/courses', 'View my courses', '⚠️ '],
            'cancelled' => ['Enrolment cancelled', 'error', 'danger', "Your enrolment in {$c} was cancelled.", '/student/courses', 'View my courses', '⚠️ '],
            'completed' => ['Course completed', 'success', 'success', "{$c} is marked as completed. Well done!", '/student/courses', 'View my courses', '🏆 '],
            'pending' => ['Enrolment awaiting permission', 'info', 'info', "Your enrolment in {$c} is awaiting admin permission.", '/student/courses', 'View my courses', '⏳ '],
        ];
        [$title, $type, $tone, $body, $link, $cta, $icon] = $map[$e->status] ?? $map['pending'];
        self::user($e->user, compact('title', 'type', 'tone', 'body', 'link', 'cta') + ['wa_icon' => $icon, 'details' => ['Course' => $c] + ($e->access_expires_on ? ['Access until' => $e->access_expires_on->format('d M Y')] : [])]);
    }

    // ------------------------------------------------------------------ website enquiries

    public static function inquiry(Inquiry $i): void
    {
        self::admins(['title' => 'New admission inquiry', 'wa_icon' => '🎓 ', 'body' => "{$i->name} requested a call back.",
            'details' => ['Name' => $i->name, 'Phone' => $i->phone, 'Email' => $i->email, 'Programme' => $i->program, 'Qualification' => $i->qualification, 'City' => $i->city, 'Message' => $i->message ? mb_substr($i->message, 0, 300) : null],
            'link' => '/admin/inquiries', 'cta' => 'Open inquiries']);
        $first = strtok($i->name, ' ');
        $m = ['title' => 'We received your inquiry', 'wa_icon' => '👋 ', 'eyebrow' => 'Admissions', 'body' => 'Thank you for your interest'.($i->program ? " in {$i->program}" : '').'. An admissions counsellor will call you shortly.', 'link' => '/', 'cta' => 'Visit our website',
            'details' => array_filter(['Helpline' => config('whatsapp.admin_phone')])];
        if ($i->phone) self::whatsapp($i->phone, self::waText($m, $first));
        if ($i->email) self::email($i->email, $i->name, self::emailPayload($m, $first));
    }

    public static function contact(ContactMessage $msg): void
    {
        self::admins(['title' => 'New contact message', 'wa_icon' => '💬 ', 'body' => "{$msg->name} sent a message from the website.",
            'details' => ['From' => $msg->name, 'Email' => $msg->email, 'Phone' => $msg->phone, 'Subject' => $msg->subject ?: 'General', 'Message' => mb_substr($msg->message, 0, 500)],
            'link' => '/admin/messages', 'cta' => 'Reply in admin']);
        $first = strtok($msg->name, ' ');
        self::email($msg->email, $msg->name, self::emailPayload(['title' => 'Thank you for contacting us', 'body' => 'We have received your message and our team will get back to you shortly.', 'details' => ['Subject' => $msg->subject ?: 'General enquiry'], 'link' => '/', 'cta' => 'Visit our website'], $first));
    }

    // ------------------------------------------------------------------ teaching

    public static function liveClassScheduled(LiveClass $lc, string $kind = 'scheduled'): void
    {
        $lc->loadMissing(['course', 'teacher']);
        $when = $lc->starts_at->timezone(config('app.timezone'));
        $details = ['Course' => "{$lc->course->code} — {$lc->course->title}", 'Topic' => $lc->title, 'Date' => $when->format('l, d F Y'), 'Time' => $when->format('h:i A').' – '.$lc->ends_at->timezone(config('app.timezone'))->format('h:i A').' (PKT)', 'Teacher' => $lc->teacher?->name, 'Google Meet' => $lc->meet_link];
        $titles = ['scheduled' => 'Live class scheduled', 'updated' => 'Live class updated', 'reminder' => 'Your live class starts soon', 'cancelled' => 'Live class cancelled'];
        $bodies = [
            'scheduled' => "{$lc->teacher?->name} has scheduled a live class on Google Meet. Add it to your calendar so your phone reminds you before it starts.",
            'updated' => 'The details of your live class have changed. Please check the new date, time and link below.',
            'reminder' => 'Your live class starts in about 30 minutes. Join on time using the Google Meet link below.',
            'cancelled' => 'This live class has been cancelled. Your teacher will share a new date soon.',
        ];
        $icons = ['scheduled' => '📅 ', 'updated' => '🔄 ', 'reminder' => '⏰ ', 'cancelled' => '❌ '];
        $isCancel = $kind === 'cancelled';
        $base = [
            'title' => $titles[$kind] ?? $titles['scheduled'], 'type' => $isCancel ? 'error' : 'live', 'tone' => $isCancel ? 'danger' : 'live', 'wa_icon' => $icons[$kind] ?? '📅 ',
            'eyebrow' => $isCancel ? 'Cancelled' : 'Live class · Google Meet', 'body' => $bodies[$kind] ?? $bodies['scheduled'], 'details' => $details,
        ];
        $ics = $isCancel ? null : $lc->ics();
        foreach (self::courseStudents($lc->course_id) as $s) {
            self::user($s, $base + [
                'link' => $isCancel ? '/student/live' : ($lc->meet_link ?: '/student/live'), 'cta' => 'Join Google Meet',
                'email' => $isCancel ? [] : ['cta' => ['label' => 'Join Google Meet', 'url' => $lc->meet_link ?: self::url('/student/live')], 'cta2' => ['label' => '+ Add to Google Calendar', 'url' => $lc->calendar_url], 'ics' => $ics, 'ics_name' => 'live-class-'.$lc->id.'.ics',
                    'outro' => ['The calendar invite is attached — open it to save the class to your phone’s calendar with automatic reminders.']],
                'whatsapp' => $isCancel ? null : self::waText($base + ['link' => $lc->meet_link ?: '/student/live'], $s->first_name ?: $s->name)."\n📅 Add to calendar: ".$lc->calendar_url,
            ]);
        }
        if ($lc->teacher && in_array($kind, ['scheduled', 'reminder'])) {
            self::user($lc->teacher, $base + ['title' => $kind === 'reminder' ? 'Your live class starts soon' : 'Live class published', 'body' => $kind === 'reminder' ? 'Your live class starts in about 30 minutes.' : 'Your students have been notified on WhatsApp, email and their dashboard.',
                'link' => $lc->meet_link ?: '/teacher/live', 'cta' => 'Open Google Meet', 'email' => ['ics' => $ics, 'ics_name' => 'live-class-'.$lc->id.'.ics', 'cta2' => ['label' => '+ Add to Google Calendar', 'url' => $lc->calendar_url]]]);
        }
    }

    public static function lessonPublished(Lesson $lesson): void
    {
        $lesson->loadMissing('course');
        foreach (self::courseStudents($lesson->course_id) as $s) {
            self::user($s, ['title' => "New lecture in {$lesson->course->code}", 'type' => 'info', 'wa_icon' => '🎬 ', 'eyebrow' => 'New lecture',
                'body' => "“{$lesson->title}” has been added to {$lesson->course->code} — {$lesson->course->title}.", 'link' => '/student/learn/'.$lesson->course->slug.'?lesson='.$lesson->id, 'cta' => 'Watch now']);
        }
    }

    public static function quizPublished(Quiz $quiz): void
    {
        $quiz->loadMissing('course');
        foreach (self::courseStudents($quiz->course_id) as $s) {
            self::user($s, ['title' => "New quiz in {$quiz->course->code}", 'type' => 'info', 'wa_icon' => '📝 ', 'eyebrow' => 'Practice quiz',
                'body' => "“{$quiz->title}” is now available. Test yourself and see instant results.", 'details' => ['Questions' => $quiz->questions()->count(), 'Pass mark' => $quiz->pass_percentage.'%'],
                'link' => '/student/learn/'.$quiz->course->slug.'?quiz='.$quiz->id, 'cta' => 'Take the quiz']);
        }
    }

    public static function announcement(Announcement $a, Course $course): void
    {
        foreach (self::courseStudents($course->id) as $s) {
            self::user($s, ['title' => "Announcement: {$a->title}", 'type' => 'info', 'wa_icon' => '📣 ', 'eyebrow' => $course->code.' announcement', 'body' => mb_substr($a->body, 0, 1500), 'link' => '/student/learn/'.$course->slug, 'cta' => 'Open course']);
        }
    }

    public static function teacherWelcome(User $teacher, ?string $password = null): void
    {
        $courses = $teacher->teachingCourses()->get()->map(fn ($c) => "{$c->code} — {$c->title}")->join(', ');
        self::user($teacher, ['title' => 'Your teacher account is ready', 'type' => 'success', 'tone' => 'success', 'wa_icon' => '👩‍🏫 ', 'eyebrow' => 'Teacher portal',
            'body' => 'Your Leads College teacher portal is ready. Log in to upload lectures, generate AI study material and quizzes, and schedule live classes on Google Meet.',
            'details' => array_filter(['Username' => $teacher->username, 'Email' => $teacher->email, 'Password' => $password, 'Courses you teach' => $courses ?: 'Will be assigned by the admin']),
            'link' => '/login', 'cta' => 'Log in to the teacher portal',
            'email' => $password ? ['outro' => ['For your security, please change this password after your first login (Profile & password).']] : [],
        ]);
    }

    public static function coursesAssigned(User $teacher, Collection $courses): void
    {
        if ($courses->isEmpty()) return;
        self::user($teacher, ['title' => 'New course'.($courses->count() > 1 ? 's' : '').' assigned to you', 'type' => 'info', 'wa_icon' => '📚 ', 'eyebrow' => 'Teaching assignment',
            'body' => 'The admin has assigned you to teach: '.$courses->map(fn ($c) => "{$c->code} — {$c->title}")->join(', ').'. You can now upload lectures, quizzes and schedule live classes for '.($courses->count() > 1 ? 'these courses.' : 'this course.'),
            'link' => '/teacher/courses', 'cta' => 'Open my courses']);
    }
}
