<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * v3 — live classes (Google Meet), quizzes / MCQs / short questions, AI study material,
 * Google Calendar connections and an email + WhatsApp delivery log.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $t) {
            $t->longText('study_material')->nullable()->after('content');   // markdown notes (AI or teacher)
            $t->json('objectives')->nullable()->after('study_material');
            $t->boolean('ai_generated')->default(false)->after('objectives');
        });

        Schema::create('google_accounts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->unique()->constrained()->cascadeOnDelete(); // null = college account
            $t->string('email')->nullable();
            $t->text('access_token')->nullable();
            $t->text('refresh_token')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->string('scopes', 1000)->nullable();
            $t->timestamps();
        });

        Schema::create('live_classes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();  // recording saved as a lecture
            $t->string('title');
            $t->text('description')->nullable();
            $t->dateTime('starts_at');
            $t->unsignedInteger('duration_minutes')->default(60);
            $t->string('meet_link', 500)->nullable();
            $t->string('link_source', 20)->default('manual');       // google | manual
            $t->string('google_event_id')->nullable();
            $t->string('google_event_link', 500)->nullable();
            $t->foreignId('google_account_id')->nullable()->constrained('google_accounts')->nullOnDelete();
            $t->string('status', 20)->default('draft');              // draft | scheduled | completed | cancelled
            $t->string('recording_url', 500)->nullable();
            $t->timestamp('notified_at')->nullable();
            $t->timestamp('reminder_sent_at')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['status', 'starts_at']);
        });

        Schema::create('quizzes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('course_id')->constrained()->cascadeOnDelete();
            $t->foreignId('lesson_id')->nullable()->constrained()->nullOnDelete();
            $t->string('title');
            $t->string('kind', 20)->default('mcq');                  // mcq | short | mixed
            $t->text('description')->nullable();
            $t->unsignedInteger('time_limit_minutes')->nullable();
            $t->unsignedInteger('pass_percentage')->default(50);
            $t->unsignedInteger('max_attempts')->nullable();
            $t->string('difficulty', 20)->nullable();
            $t->boolean('is_published')->default(false);
            $t->boolean('ai_generated')->default(false);
            $t->unsignedInteger('sort_order')->default(0);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('quiz_questions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $t->string('type', 10)->default('mcq');                  // mcq | short
            $t->text('question');
            $t->json('options')->nullable();                         // ["A", "B", "C", "D"]
            $t->unsignedTinyInteger('correct_index')->nullable();
            $t->text('answer')->nullable();                          // model answer for short questions
            $t->text('explanation')->nullable();
            $t->unsignedInteger('marks')->default(1);
            $t->unsignedInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('quiz_attempts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->json('answers')->nullable();
            $t->json('results')->nullable();                         // per question: correct, marks, feedback
            $t->decimal('score', 8, 2)->default(0);
            $t->decimal('total', 8, 2)->default(0);
            $t->unsignedInteger('percentage')->default(0);
            $t->boolean('passed')->default(false);
            $t->timestamp('started_at')->nullable();
            $t->timestamp('submitted_at')->nullable();
            $t->timestamps();
        });

        Schema::create('message_logs', function (Blueprint $t) {
            $t->id();
            $t->string('channel', 20);                               // email | whatsapp
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('recipient');
            $t->string('subject')->nullable();
            $t->text('body')->nullable();
            $t->string('status', 20)->default('queued');            // queued | sent | failed | skipped
            $t->text('error')->nullable();
            $t->timestamp('sent_at')->nullable();
            $t->timestamps();
            $t->index(['channel', 'status']);
        });
    }

    public function down(): void
    {
        foreach (['message_logs', 'quiz_attempts', 'quiz_questions', 'quizzes', 'live_classes', 'google_accounts'] as $tbl) Schema::dropIfExists($tbl);
        Schema::table('lessons', fn (Blueprint $t) => $t->dropColumn(['study_material', 'objectives', 'ai_generated']));
    }
};
