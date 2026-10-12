<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Course;
use App\Models\ExamSession;
use App\Models\Lesson;
use App\Models\Level;
use App\Models\PaymentAccount;
use App\Models\Program;
use App\Models\Setting;
use App\Models\User;
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
    }
}
