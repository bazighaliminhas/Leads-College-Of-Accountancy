<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\ExamSession;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Level;
use App\Models\LiveClass;
use App\Models\MessageLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\PaymentAccount;
use App\Models\Program;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ---------- Users (change these passwords after first login) ----------
        $admin = User::updateOrCreate(['email' => 'admin@leads.edu.pk'], ['name' => 'LCA Administrator', 'first_name' => 'LCA', 'last_name' => 'Administrator', 'username' => 'admin', 'role' => 'admin', 'status' => 'active', 'password' => 'Admin@123', 'phone' => '+92 42 111 532 371']);
        $accaT = User::updateOrCreate(['email' => 'acca.teacher@leads.edu.pk'], ['name' => 'ACCA Teacher', 'first_name' => 'ACCA', 'last_name' => 'Teacher', 'username' => 'acca.teacher', 'role' => 'teacher', 'status' => 'active', 'password' => 'Teacher@123', 'designation' => 'ACCA Faculty', 'specialization' => 'Financial Reporting, Audit & Assurance', 'bio' => 'Demo teacher account — the admin can update this profile, name and photo from the Admin dashboard.', 'created_by' => $admin->id]);
        $caT = User::updateOrCreate(['email' => 'ca.teacher@leads.edu.pk'], ['name' => 'CA Teacher', 'first_name' => 'CA', 'last_name' => 'Teacher', 'username' => 'ca.teacher', 'role' => 'teacher', 'status' => 'active', 'password' => 'Teacher@123', 'designation' => 'CA Faculty', 'specialization' => 'PRC & CAF', 'bio' => 'Demo teacher account — the admin can update this profile, name and photo from the Admin dashboard.', 'created_by' => $admin->id]);
        User::updateOrCreate(['email' => 'student@leads.edu.pk'], ['name' => 'Demo Student', 'first_name' => 'Demo', 'last_name' => 'Student', 'username' => 'student', 'role' => 'student', 'status' => 'active', 'password' => 'Student@123', 'phone' => '03000000000', 'city' => 'Lahore', 'country' => 'Pakistan']);

        // ---------- Programmes, levels and courses (from the ACCA & CA content + fee structures) ----------
        $seed = json_decode(file_get_contents(__DIR__.'/data/seed.json'), true);
        foreach ($seed['programs'] as $pi => $p) {
            $program = Program::updateOrCreate(['slug' => $p['slug']], [
                'name' => $p['name'], 'full_name' => $p['full_name'], 'awarding_body' => $p['awarding_body'], 'tagline' => $p['tagline'],
                'description' => $p['description'], 'overview' => $p['overview'], 'registration_fee' => $p['registration_fee'],
                'registration_fee_scholarship' => $p['registration_fee_scholarship'], 'registration_no_label' => $p['registration_no_label'],
                'sort_order' => $pi, 'status' => 'active',
            ]);
            $teacher = $p['slug'] === 'acca' ? $accaT : $caT;
            foreach ($p['levels'] as $l) {
                $level = Level::updateOrCreate(['program_id' => $program->id, 'slug' => $l['slug']], ['name' => $l['name'], 'description' => $l['description'], 'sort_order' => $l['sort']]);
                foreach ($l['courses'] as $c) {
                    $pass = $c['pass_mark'] ?? (str_starts_with($c['code'], 'PRC') ? '50%' : null);
                    $course = Course::updateOrCreate(['slug' => Str::slug($p['slug'].'-'.$c['code'])], [
                        'program_id' => $program->id, 'level_id' => $level->id, 'code' => $c['code'], 'title' => $c['title'],
                        'short_description' => $c['short'], 'about' => $c['about'], 'learn' => $c['learn'], 'structure' => $c['structure'],
                        'exam_duration' => $c['exam_duration'], 'pass_mark' => $pass, 'exam_format' => $c['exam_format'],
                        'fee' => $c['fee'], 'scholarship_fee' => $c['scholarship_fee'], 'is_purchasable' => $c['fee'] !== null,
                        'is_featured' => in_array($c['code'], ['FA1', 'MA1', 'FR', 'AA', 'SBR', 'PRC-01', 'CAF-1', 'CAF-2']),
                        'status' => 'published', 'sort_order' => $c['sort'], 'language' => 'English / Urdu',
                    ]);
                    $course->teachers()->syncWithoutDetaching([$teacher->id => ['assigned_by' => $admin->id]]);
                    if (!$course->lessons()->exists()) {
                        $html = '<p>'.e($c['about']).'</p>';
                        if ($c['learn']) $html .= '<h4>What you will learn</h4><ul>'.collect($c['learn'])->map(fn ($x) => '<li>'.e($x).'</li>')->join('').'</ul>';
                        if ($c['structure']) $html .= '<h4>Exam structure</h4><ul>'.collect($c['structure'])->map(fn ($x) => '<li>'.e($x).'</li>')->join('').'</ul>';
                        Lesson::create(['course_id' => $course->id, 'uploaded_by' => $teacher->id, 'chapter' => 'Getting started', 'title' => 'Course overview — '.$c['code'].' '.$c['title'], 'type' => 'text', 'content' => $html, 'sort_order' => 1, 'is_published' => true]);
                    }
                }
            }
        }

        // ---------- Exam sessions / attempts (admin can edit) ----------
        $acca = Program::where('slug', 'acca')->first();
        $ca = Program::where('slug', 'ca')->first();
        foreach (['December 2026', 'March 2027', 'June 2027', 'September 2027'] as $i => $n) ExamSession::updateOrCreate(['program_id' => $acca->id, 'name' => $n], ['sort_order' => $i, 'status' => 'open']);
        foreach (['Spring 2027', 'Autumn 2027'] as $i => $n) ExamSession::updateOrCreate(['program_id' => $ca->id, 'name' => $n], ['sort_order' => $i, 'status' => 'open']);

        // ---------- Where students pay (PLACEHOLDERS — update in Admin → Payment Accounts) ----------
        if (!PaymentAccount::exists()) {
            PaymentAccount::create(['type' => 'bank', 'provider' => 'Bank name (update in admin)', 'account_title' => 'Leads College of Accountancy', 'account_number' => '0000-0000000000', 'iban' => 'PK00XXXX0000000000000000', 'branch' => 'Branch name', 'instructions' => 'Transfer the total amount and keep the receipt / screenshot.', 'sort_order' => 1]);
            PaymentAccount::create(['type' => 'wallet', 'provider' => 'JazzCash / Easypaisa (update in admin)', 'account_title' => 'Leads College of Accountancy', 'account_number' => '0300-0000000', 'instructions' => 'Send money from any mobile wallet and take a screenshot of the confirmation.', 'sort_order' => 2]);
        }

        // ---------- Site settings ----------
        $settings = [
            ['general', 'site_name', 'Site name', 'Leads College of Accountancy'],
            ['general', 'site_tagline', 'Tagline', 'Learn • Lead • Achieve'],
            ['general', 'promo_text', 'Top promo bar text', 'Admissions open for ACCA & CA (ICAP) — enrol online in minutes'],
            ['general', 'hero_title', 'Hero title', 'Online Admissions — ACCA & CA (ICAP)'],
            ['general', 'hero_subtitle', 'Hero subtitle', 'Choose your papers, add them to your cart, pay through any bank or mobile wallet and upload the payment proof. Your learning portal opens as soon as the admin grants access.'],
            ['contact', 'contact_phone', 'Phone / UAN', '+92 (42) 111-532-371'],
            ['contact', 'contact_whatsapp', 'WhatsApp', '+92 300 0000000'],
            ['contact', 'contact_email', 'Email', 'admissions@leads.edu.pk'],
            ['contact', 'contact_address', 'Campus address', 'Lahore Leads University, Tipu Block, New Garden Town, Lahore'],
            ['contact', 'office_hours', 'Office hours', 'Mon – Sat, 9:00 AM – 6:00 PM'],
            ['social', 'social_facebook', 'Facebook URL', 'https://facebook.com'],
            ['social', 'social_instagram', 'Instagram URL', 'https://instagram.com'],
            ['social', 'social_linkedin', 'LinkedIn URL', 'https://linkedin.com'],
            ['social', 'social_youtube', 'YouTube URL', 'https://youtube.com'],
            ['fees', 'fee_notes', 'Fee notes (one per line)', "Scholarships are applicable on the Net Fee Payable, and a student may avail only one scholarship at a time.\nNeed Based Scholarships are subject to verification of the required supporting documents, while Merit Based Scholarships apply to the academic marks of 80% and above.\nFees once paid are non-refundable and non-transferable.\nThe packages can be paid in two installments."],
            ['fees', 'payment_instructions', 'Payment instructions', 'Pay the total amount from any bank account or mobile app (JazzCash, Easypaisa, internet banking, ATM or over the counter). Then upload the screenshot / receipt with the transaction ID. The admin verifies the payment and grants access to your courses.'],
            ['legal', 'terms', 'Terms & conditions', "Admission is confirmed only after the payment is verified by the college administration.\nCourse access is granted by the admin and is personal to the registered student — sharing login details is not allowed.\nRecorded lectures are streamed through the student portal and may not be downloaded, copied or redistributed.\nFees once paid are non-refundable and non-transferable.\nStudents must keep at least 80% attendance in live classes, or the college may cancel the admission.\nScholarships are subject to verification and a student may avail only one scholarship at a time.\nAll communication about admissions and fees must be made in writing through official college channels.\nExam registration with ACCA or ICAP and their exam fees are the student's own responsibility."],
            ['legal', 'privacy', 'Privacy policy', "We collect the information you enter (name, contact details, date of birth, registration numbers and payment proofs) only to process your admission and run your classes.\nPayment screenshots are stored privately and are visible only to the college administration.\nWe do not sell or share your personal data with third parties, except ACCA / ICAP where required for your studies.\nYou can ask the college to correct your data at any time."],
        ];
        foreach ($settings as [$g, $k, $label, $v]) Setting::updateOrCreate(['key' => $k], ['group' => $g, 'label' => $label, 'value' => $v]);

        if (!Announcement::exists()) {
            Announcement::create(['user_id' => $admin->id, 'audience' => 'all', 'title' => 'Welcome to the LCA learning portal', 'body' => 'Your courses appear under "My Courses" once the admin grants access after verifying your payment.', 'is_published' => true]);
        }

        // ---------- Demo Student Enrolment, Order & Payment (ACCA FA1) ----------
        $student = User::where('email', 'student@leads.edu.pk')->first();
        $fa1 = Course::where('code', 'FA1')->first();
        $accaSession = ExamSession::where('program_id', $acca->id)->first();

        if ($student && $fa1) {
            $order = Order::firstOrCreate(['order_no' => 'LCA-DEMO-00001'], [
                'user_id' => $student->id,
                'subtotal' => $fa1->fee ?? 15000,
                'registration_fee' => 15000,
                'total' => ($fa1->fee ?? 15000) + 15000,
                'status' => 'approved',
                'first_name' => 'Demo',
                'last_name' => 'Student',
                'email' => 'student@leads.edu.pk',
                'phone' => '+923000000000',
                'dob' => '2002-05-15',
                'cnic' => '35201-1234567-1',
                'city' => 'Lahore',
                'country' => 'Pakistan',
                'address' => 'Model Town, Lahore',
                'registration_no' => 'ACCA-9876543',
                'qualification' => 'Intermediate / A Levels',
                'agreed_terms_at' => now(),
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'admin_remarks' => 'Verified by Admissions Office',
            ]);

            OrderItem::firstOrCreate(['order_id' => $order->id, 'item_type' => 'course'], [
                'course_id' => $fa1->id,
                'exam_session_id' => $accaSession?->id,
                'code' => $fa1->code,
                'title' => $fa1->title,
                'session_name' => $accaSession?->name,
                'price' => $fa1->fee ?? 15000,
            ]);

            OrderItem::firstOrCreate(['order_id' => $order->id, 'item_type' => 'registration_fee'], [
                'code' => 'REG-ACCA',
                'title' => 'ACCA Admission Registration Fee',
                'price' => 15000,
            ]);

            Payment::firstOrCreate(['order_id' => $order->id], [
                'user_id' => $student->id,
                'method' => 'Bank transfer',
                'paid_from' => 'HBL',
                'account_title' => 'Demo Student',
                'account_number' => '0123456789',
                'paid_to' => 'Leads College of Accountancy',
                'transaction_ref' => 'HBL-TXN-998877',
                'amount' => $order->total,
                'paid_on' => now()->toDateString(),
                'screenshot_path' => 'payments/demo-receipt.png',
                'screenshot_name' => 'receipt.png',
                'status' => 'verified',
                'verified_by' => $admin->id,
                'verified_at' => now(),
                'remarks' => 'Bank transfer verified.',
            ]);

            Enrollment::updateOrCreate(['user_id' => $student->id, 'course_id' => $fa1->id], [
                'order_id' => $order->id,
                'exam_session_id' => $accaSession?->id,
                'status' => 'active',
                'granted_by' => $admin->id,
                'granted_at' => now(),
                'access_expires_on' => now()->addYear(),
                'progress' => 50,
            ]);

            $lesson = $fa1->lessons()->first();
            if ($lesson) {
                $lesson->update([
                    'chapter' => 'Chapter 1 — Introduction to Financial Accounting',
                    'title' => 'Lecture 1 — The Fundamentals of Accounting & Double Entry',
                    'duration_minutes' => 45,
                    'ai_generated' => true,
                    'objectives' => [
                        'Understand the purpose of financial records in business',
                        'State and explain the fundamental accounting equation',
                        'Apply the rules of debit and credit to simple transactions',
                        'Differentiate between assets, liabilities, income, and expenses',
                    ],
                    'study_material' => "## Overview\n\nFinancial accounting is the process of identifying, measuring, recording, and communicating economic information about an entity to external decision-makers such as investors, lenders, tax authorities, and regulators.\n\n## The Accounting Equation\n\nThe fundamental accounting equation forms the foundation of all double-entry bookkeeping:\n\n$$\\text{Assets} = \\text{Liabilities} + \\text{Capital (Equity)}$$\n\n- **Assets**: Economic resources owned or controlled by the business that generate future economic benefits (e.g. cash, inventory, receivables, equipment).\n- **Liabilities**: Present obligations resulting from past events, the settlement of which is expected to result in an outflow of resources (e.g. bank loans, trade payables).\n- **Capital**: The owner's residual interest in the business after deducting all liabilities.\n\n## Double Entry Rules (D.E.A.D. C.L.I.C.)\n\n- **Debit increases**: **D**rawings, **E**xpenses, **A**ssets\n- **Credit increases**: **C**apital, **L**iabilities, **I**ncome\n\n## Worked Example\n\n**Scenario:**\nMr. Ali starts a business on 1 January with PKR 500,000 cash and purchases inventory on credit for PKR 120,000 from Supplier XYZ.\n\n| Transaction | Debit Account | Credit Account | Amount (PKR) |\n|---|---|---|---|\n| Introduce initial capital | Cash (Asset +) | Capital (Equity +) | 500,000 |\n| Purchase inventory on credit | Inventory (Asset +) | Trade Payables (Liability +) | 120,000 |\n\n## Common Mistakes\n1. Treating purchases of goods for resale as an immediate reduction in capital instead of recording inventory or purchases.\n2. Confusing trade receivables (assets) with trade payables (liabilities).\n\n## Quick Recap\n- Every transaction has a dual effect.\n- Total debits must always equal total credits in a trial balance.\n- Assets = Liabilities + Capital.\n",
                ]);

                \App\Models\LessonProgress::updateOrCreate(['user_id' => $student->id, 'lesson_id' => $lesson->id], [
                    'course_id' => $fa1->id,
                    'views' => 3,
                    'last_position_seconds' => 1200,
                    'completed_at' => now(),
                ]);
            }

            // ---------- Live Class (Google Meet) ----------
            LiveClass::firstOrCreate(['course_id' => $fa1->id, 'title' => 'Live Class: Mastering Trial Balance & Suspense Accounts'], [
                'teacher_id' => $accaT->id,
                'description' => 'Interactive revision on identifying errors not affecting the trial balance, posting journal entries, and clearing suspense accounts before exam sessions.',
                'starts_at' => now()->addDays(2)->setTime(18, 0, 0),
                'duration_minutes' => 60,
                'meet_link' => 'https://meet.google.com/abc-defg-hij',
                'link_source' => 'manual',
                'status' => 'scheduled',
                'created_by' => $accaT->id,
                'notified_at' => now(),
            ]);

            // ---------- Quiz (MCQs + Short Answer) ----------
            $quiz = Quiz::firstOrCreate(['course_id' => $fa1->id, 'title' => 'FA1 Chapter 1 Practice Assessment'], [
                'lesson_id' => $lesson?->id,
                'kind' => 'mixed',
                'description' => 'Test your understanding of the accounting equation, asset classifications, and double entry fundamentals.',
                'time_limit_minutes' => 15,
                'pass_percentage' => 50,
                'max_attempts' => 3,
                'difficulty' => 'exam',
                'is_published' => true,
                'ai_generated' => true,
                'sort_order' => 1,
                'created_by' => $accaT->id,
            ]);

            $questions = [
                [
                    'type' => 'mcq',
                    'question' => 'Which of the following is classified as a non-current asset for a retailer?',
                    'options' => ['Inventory held for sale', 'Trade receivables', 'Delivery van used for goods delivery', 'Bank overdraft balance'],
                    'correct_index' => 2,
                    'explanation' => 'Delivery van is a tangible long-term asset expected to be used for more than one operating cycle.',
                    'marks' => 1,
                ],
                [
                    'type' => 'mcq',
                    'question' => 'If total assets are PKR 800,000 and total liabilities are PKR 350,000, what is the value of capital (equity)?',
                    'options' => ['PKR 450,000', 'PKR 1,150,000', 'PKR 350,000', 'PKR 500,000'],
                    'correct_index' => 0,
                    'explanation' => 'Capital = Assets - Liabilities = 800,000 - 350,000 = PKR 450,000.',
                    'marks' => 1,
                ],
                [
                    'type' => 'mcq',
                    'question' => 'A business receives PKR 25,000 cash from a trade receivable. What is the double entry?',
                    'options' => [
                        'Debit Trade Payables, Credit Cash',
                        'Debit Cash, Credit Trade Receivables',
                        'Debit Trade Receivables, Credit Sales',
                        'Debit Cash, Credit Capital'
                    ],
                    'correct_index' => 1,
                    'explanation' => 'Cash increases (debit asset) and Trade Receivables decreases (credit asset).',
                    'marks' => 1,
                ],
                [
                    'type' => 'short',
                    'question' => 'Explain why the purchase of office equipment is classified as capital expenditure rather than revenue expenditure.',
                    'options' => null,
                    'correct_index' => null,
                    'answer' => 'Capital expenditure provides economic benefits to the business over multiple accounting periods (longer than 12 months) and results in the recognition of a non-current asset on the Statement of Financial Position, whereas revenue expenditure is consumed within the current period to maintain day-to-day operations.',
                    'explanation' => 'Award up to 3 marks: 1 mark for long-term benefit (>12 months), 1 mark for asset recognition, 1 mark for contrast with current-period consumption.',
                    'marks' => 3,
                ],
            ];

            foreach ($questions as $qi => $q) {
                \App\Models\QuizQuestion::firstOrCreate(['quiz_id' => $quiz->id, 'question' => $q['question']], [
                    'type' => $q['type'],
                    'options' => $q['options'],
                    'correct_index' => $q['correct_index'],
                    'answer' => $q['answer'] ?? null,
                    'explanation' => $q['explanation'],
                    'marks' => $q['marks'],
                    'sort_order' => $qi + 1,
                ]);
            }

            // Sample Quiz Attempt
            \App\Models\QuizAttempt::firstOrCreate(['quiz_id' => $quiz->id, 'user_id' => $student->id], [
                'answers' => [1 => 2, 2 => 0, 3 => 1, 4 => 'Capital expenditure benefits the business over multiple years and increases non-current assets.'],
                'results' => [
                    1 => ['correct' => true, 'marks' => 1],
                    2 => ['correct' => true, 'marks' => 1],
                    3 => ['correct' => true, 'marks' => 1],
                    4 => ['score' => 3, 'feedback' => 'Clear and accurate explanation distinguishing multi-period benefits.'],
                ],
                'score' => 6,
                'total' => 6,
                'percentage' => 100,
                'passed' => true,
                'started_at' => now()->subDay(),
                'submitted_at' => now()->subDay()->addMinutes(12),
            ]);

            // Sample Notification
            \App\Models\UserNotification::firstOrCreate(['user_id' => $student->id, 'title' => 'Admission Confirmed — FA1 Access Granted'], [
                'type' => 'success',
                'body' => 'Your payment for Order LCA-DEMO-00001 has been verified and course access is granted. Welcome to Leads College of Accountancy!',
                'link' => '/student/courses',
                'read_at' => null,
            ]);

            // Sample Message Log (WhatsApp & Email)
            \App\Models\MessageLog::firstOrCreate(['recipient' => '+923000000000', 'channel' => 'whatsapp'], [
                'user_id' => $student->id,
                'subject' => 'Admission Confirmed',
                'body' => "Dear Demo Student,\nYour admission for FA1 is approved! Access your dashboard at http://127.0.0.1:8000/student",
                'status' => 'sent',
                'sent_at' => now(),
            ]);

            \App\Models\MessageLog::firstOrCreate(['recipient' => 'student@leads.edu.pk', 'channel' => 'email'], [
                'user_id' => $student->id,
                'subject' => 'Course Access Granted — Leads College of Accountancy',
                'body' => 'Your payment has been verified. You can now access your lectures, quizzes and live classes.',
                'status' => 'sent',
                'sent_at' => now(),
            ]);
        }

        // ---------- CA Teacher Sample Live Class & Quiz (CAF-1) ----------
        $caf1 = Course::where('code', 'CAF-1')->first() ?? Course::where('code', 'PRC-01')->first();
        if ($caf1 && $caT) {
            LiveClass::firstOrCreate(['course_id' => $caf1->id, 'title' => 'CAF-1: Revenue Recognition & IFRS 15 Principles'], [
                'teacher_id' => $caT->id,
                'description' => 'Five-step model for revenue recognition under IFRS 15 with ICAP exam-standard past paper questions.',
                'starts_at' => now()->addDays(3)->setTime(19, 0, 0),
                'duration_minutes' => 75,
                'meet_link' => 'https://meet.google.com/xyz-uvwx-rst',
                'link_source' => 'manual',
                'status' => 'scheduled',
                'created_by' => $caT->id,
                'notified_at' => now(),
            ]);

            $caQuiz = Quiz::firstOrCreate(['course_id' => $caf1->id, 'title' => 'CAF-1 Accounting Standards Checkpoint'], [
                'kind' => 'mcq',
                'description' => 'Comprehensive checkpoint on IAS 16 Property, Plant and Equipment and IAS 2 Inventories.',
                'time_limit_minutes' => 20,
                'pass_percentage' => 50,
                'max_attempts' => 3,
                'difficulty' => 'exam',
                'is_published' => true,
                'ai_generated' => true,
                'sort_order' => 1,
                'created_by' => $caT->id,
            ]);

            $caQuestions = [
                [
                    'type' => 'mcq',
                    'question' => 'Under IAS 2, how should inventories be measured?',
                    'options' => [
                        'At cost',
                        'At net realizable value (NRV)',
                        'At the lower of cost and net realizable value (NRV)',
                        'At replacement value'
                    ],
                    'correct_index' => 2,
                    'explanation' => 'IAS 2 requires inventories to be measured at the lower of cost and net realizable value.',
                    'marks' => 2,
                ],
                [
                    'type' => 'mcq',
                    'question' => 'Which of the following costs is NOT capitalized under IAS 16 as part of Property, Plant and Equipment?',
                    'options' => [
                        'Site preparation costs',
                        'Initial delivery and handling costs',
                        'Professional fees directly related to the acquisition',
                        'Costs of opening a new facility or advertising'
                    ],
                    'correct_index' => 3,
                    'explanation' => 'Costs of opening a new facility and advertising are recognized in profit or loss when incurred.',
                    'marks' => 2,
                ]
            ];

            foreach ($caQuestions as $qi => $q) {
                \App\Models\QuizQuestion::firstOrCreate(['quiz_id' => $caQuiz->id, 'question' => $q['question']], [
                    'type' => $q['type'],
                    'options' => $q['options'],
                    'correct_index' => $q['correct_index'],
                    'explanation' => $q['explanation'],
                    'marks' => $q['marks'],
                    'sort_order' => $qi + 1,
                ]);
            }
        }
    }
}
