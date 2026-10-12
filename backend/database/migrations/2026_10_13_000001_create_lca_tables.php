<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programs', function (Blueprint $t) {
            $t->id();
            $t->string('name');                 // ACCA / CA
            $t->string('slug')->unique();
            $t->string('full_name')->nullable();
            $t->string('awarding_body')->nullable();
            $t->string('tagline')->nullable();
            $t->text('description')->nullable();
            $t->json('overview')->nullable();   // intro paragraphs / pathway notes
            $t->decimal('registration_fee', 12, 2)->default(0);
            $t->decimal('registration_fee_scholarship', 12, 2)->nullable();
            $t->string('registration_no_label')->nullable();
            $t->string('image')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->string('status')->default('active');
            $t->timestamps();
        });

        Schema::create('levels', function (Blueprint $t) {
            $t->id();
            $t->foreignId('program_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->string('slug');
            $t->text('description')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('courses', function (Blueprint $t) {
            $t->id();
            $t->foreignId('program_id')->constrained()->cascadeOnDelete();
            $t->foreignId('level_id')->nullable()->constrained()->nullOnDelete();
            $t->string('code');
            $t->string('slug')->unique();
            $t->string('title');
            $t->string('short_description', 500)->nullable();
            $t->text('about')->nullable();
            $t->json('learn')->nullable();
            $t->json('structure')->nullable();
            $t->string('exam_duration')->nullable();
            $t->string('exam_format')->nullable();
            $t->string('pass_mark')->nullable();
            $t->decimal('fee', 12, 2)->nullable();
            $t->decimal('scholarship_fee', 12, 2)->nullable();
            $t->string('class_duration')->nullable();
            $t->string('language')->default('English / Urdu');
            $t->string('image')->nullable();
            $t->boolean('is_purchasable')->default(true);
            $t->boolean('is_featured')->default(false);
            $t->string('status')->default('published'); // published | draft | pending
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('course_teacher', function (Blueprint $t) {
            $t->id();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $t->boolean('can_upload')->default(true);
            $t->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['course_id', 'teacher_id']);
        });

        Schema::create('exam_sessions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('program_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->date('starts_on')->nullable();
            $t->string('status')->default('open'); // open | closed
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('lessons', function (Blueprint $t) {
            $t->id();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->string('chapter')->nullable();
            $t->string('title');
            $t->text('description')->nullable();
            $t->string('type')->default('video'); // video | document | text
            $t->string('video_path')->nullable();
            $t->string('video_url')->nullable();
            $t->string('attachment_path')->nullable();
            $t->string('attachment_name')->nullable();
            $t->longText('content')->nullable();
            $t->unsignedInteger('duration_minutes')->nullable();
            $t->unsignedBigInteger('file_size')->nullable();
            $t->unsignedInteger('sort_order')->default(0);
            $t->boolean('is_published')->default(true);
            $t->timestamps();
        });

        Schema::create('carts', function (Blueprint $t) {
            $t->id();
            $t->string('token')->unique();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('status')->default('active'); // active | converted
            $t->string('ip')->nullable();
            $t->string('user_agent', 500)->nullable();
            $t->timestamps();
        });

        Schema::create('cart_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('cart_id')->constrained()->cascadeOnDelete();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->foreignId('exam_session_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->string('order_no')->unique();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('cart_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('subtotal', 12, 2)->default(0);
            $t->decimal('registration_fee', 12, 2)->default(0);
            $t->decimal('total', 12, 2)->default(0);
            // pending_payment | payment_submitted | approved | rejected | cancelled
            $t->string('status')->default('pending_payment')->index();
            $t->string('first_name');
            $t->string('last_name')->nullable();
            $t->string('email');
            $t->string('phone');
            $t->date('dob')->nullable();
            $t->string('cnic')->nullable();
            $t->string('city')->nullable();
            $t->string('country')->nullable();
            $t->text('address')->nullable();
            $t->string('registration_no')->nullable();
            $t->string('qualification')->nullable();
            $t->text('notes')->nullable();
            $t->timestamp('agreed_terms_at')->nullable();
            $t->string('ip')->nullable();
            $t->string('user_agent', 500)->nullable();
            $t->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->text('admin_remarks')->nullable();
            $t->timestamps();
        });

        Schema::create('order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('exam_session_id')->nullable()->constrained()->nullOnDelete();
            $t->string('item_type')->default('course'); // course | registration_fee
            $t->string('code')->nullable();
            $t->string('title');
            $t->string('session_name')->nullable();
            $t->decimal('price', 12, 2)->default(0);
            $t->timestamps();
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('method');                 // Bank transfer / JazzCash / Easypaisa / ...
            $t->string('paid_from')->nullable();  // bank or app name the student paid from
            $t->string('account_title')->nullable();
            $t->string('account_number')->nullable();
            $t->string('paid_to')->nullable();    // which college account they paid into
            $t->string('transaction_ref');
            $t->decimal('amount', 12, 2);
            $t->date('paid_on')->nullable();
            $t->string('screenshot_path');
            $t->string('screenshot_name')->nullable();
            $t->text('note')->nullable();
            $t->string('status')->default('submitted')->index(); // submitted | verified | rejected
            $t->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('verified_at')->nullable();
            $t->text('remarks')->nullable();
            $t->string('ip')->nullable();
            $t->timestamps();
        });

        Schema::create('enrollments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('exam_session_id')->nullable()->constrained()->nullOnDelete();
            // pending (awaiting admin permission) | active (access granted) | suspended | completed | cancelled
            $t->string('status')->default('pending')->index();
            $t->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('granted_at')->nullable();
            $t->date('access_expires_on')->nullable();
            $t->unsignedTinyInteger('progress')->default(0);
            $t->text('remarks')->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'course_id']);
        });

        Schema::create('lesson_progress', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('views')->default(0);
            $t->unsignedInteger('last_position_seconds')->default(0);
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'lesson_id']);
        });

        Schema::create('announcements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('course_id')->nullable()->constrained()->cascadeOnDelete();
            $t->string('audience')->default('all'); // all | students | teachers | course
            $t->string('title');
            $t->text('body');
            $t->boolean('is_published')->default(true);
            $t->timestamps();
        });

        Schema::create('user_notifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('type')->default('info');
            $t->string('title');
            $t->text('body')->nullable();
            $t->string('link')->nullable();
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
        });

        Schema::create('contact_messages', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email');
            $t->string('phone')->nullable();
            $t->string('subject')->nullable();
            $t->text('message');
            $t->string('status')->default('new'); // new | read | replied
            $t->string('ip')->nullable();
            $t->timestamps();
        });

        Schema::create('inquiries', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('email');
            $t->string('phone');
            $t->string('program')->nullable();
            $t->string('qualification')->nullable();
            $t->string('city')->nullable();
            $t->text('message')->nullable();
            $t->string('status')->default('new'); // new | contacted | closed
            $t->string('ip')->nullable();
            $t->timestamps();
        });

        Schema::create('newsletter_subscribers', function (Blueprint $t) {
            $t->id();
            $t->string('email')->unique();
            $t->string('ip')->nullable();
            $t->timestamps();
        });

        Schema::create('payment_accounts', function (Blueprint $t) {
            $t->id();
            $t->string('type')->default('bank'); // bank | wallet
            $t->string('provider');              // bank / app name
            $t->string('account_title');
            $t->string('account_number');
            $t->string('iban')->nullable();
            $t->string('branch')->nullable();
            $t->text('instructions')->nullable();
            $t->boolean('is_active')->default(true);
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->text('value')->nullable();
            $t->string('group')->default('general');
            $t->string('label')->nullable();
            $t->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('visitor_id')->nullable()->index();
            $t->string('action')->index();
            $t->string('description', 1000)->nullable();
            $t->string('subject_type')->nullable();
            $t->unsignedBigInteger('subject_id')->nullable();
            $t->string('method', 10)->nullable();
            $t->string('url', 1000)->nullable();
            $t->unsignedSmallInteger('status_code')->nullable();
            $t->json('payload')->nullable();
            $t->string('ip')->nullable();
            $t->string('user_agent', 500)->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['activity_logs','settings','payment_accounts','newsletter_subscribers','inquiries','contact_messages',
            'user_notifications','announcements','lesson_progress','enrollments','payments','order_items','orders',
            'cart_items','carts','lessons','exam_sessions','course_teacher','courses','levels','programs'] as $tbl) {
            Schema::dropIfExists($tbl);
        }
    }
};
