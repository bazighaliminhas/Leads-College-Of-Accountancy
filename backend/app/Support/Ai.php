<?php

namespace App\Support;

use App\Models\Course;
use App\Models\Lesson;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * AI generation for teachers: curriculum (lecture plan), study material, quizzes / MCQs / short questions,
 * and marking of students' short answers. Works with Google Gemini, OpenAI or Anthropic Claude —
 * set AI_PROVIDER, AI_API_KEY (and optionally AI_MODEL) in .env.
 * Everything AI produces is saved as a DRAFT that the teacher reviews before students see it.
 */
class Ai
{
    public static function enabled(): bool
    {
        return (bool) config('services.ai.key');
    }

    public static function provider(): string
    {
        return strtolower((string) config('services.ai.provider', 'gemini'));
    }

    protected static function model(): string
    {
        return config('services.ai.model') ?: match (self::provider()) {
            'openai' => 'gpt-4o-mini',
            'anthropic', 'claude' => 'claude-sonnet-5-5',
            default => 'gemini-2.5-flash',
        };
    }

    protected const SYSTEM = 'You are a senior ACCA and ICAP (Chartered Accountants of Pakistan) tutor and examiner at Leads College of Accountancy, Lahore. '
        .'You write accurate, exam-focused teaching material aligned with the current ACCA / ICAP syllabus and examiner approach. '
        .'Use clear British English suitable for Pakistani students, practical examples in PKR where helpful, and correct accounting standards (IFRS/IAS, ISA, Pakistani tax law for tax papers). '
        .'Always reply with ONE valid JSON object only — no markdown fences, no commentary.';

    /** Send a prompt and return the decoded JSON object. */
    public static function json(string $prompt, int $maxTokens = 8000): array
    {
        if (!self::enabled()) throw new RuntimeException('AI is not configured. Add AI_PROVIDER and AI_API_KEY to the .env file.');
        $key = config('services.ai.key');
        $model = self::model();

        $req = Http::timeout(150)->acceptJson();
        $text = match (self::provider()) {
            'openai' => $req->withToken($key)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model, 'temperature' => 0.5, 'response_format' => ['type' => 'json_object'],
                'messages' => [['role' => 'system', 'content' => self::SYSTEM], ['role' => 'user', 'content' => $prompt]],
            ])->throw()->json('choices.0.message.content'),
            'anthropic', 'claude' => $req->withHeaders(['x-api-key' => $key, 'anthropic-version' => '2023-06-01'])->post('https://api.anthropic.com/v1/messages', [
                'model' => $model, 'max_tokens' => $maxTokens, 'system' => self::SYSTEM,
                'messages' => [['role' => 'user', 'content' => $prompt]],
            ])->throw()->json('content.0.text'),
            default => $req->withHeaders(['x-goog-api-key' => $key])->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                'systemInstruction' => ['parts' => [['text' => self::SYSTEM]]],
                'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                'generationConfig' => ['temperature' => 0.5, 'responseMimeType' => 'application/json', 'maxOutputTokens' => $maxTokens],
            ])->throw()->json('candidates.0.content.parts.0.text'),
        };

        return self::decode((string) $text);
    }

    public static function decode(string $text): array
    {
        $text = trim(preg_replace('/^```(?:json)?|```$/m', '', trim($text)));
        $data = json_decode($text, true);
        if (!is_array($data) && preg_match('/\{.*\}/s', $text, $m)) $data = json_decode($m[0], true);
        if (!is_array($data)) throw new RuntimeException('The AI returned an unexpected answer. Please try again.');
        return $data;
    }

    protected static function courseContext(Course $c): string
    {
        $c->loadMissing(['program', 'level']);
        return "Programme: {$c->program?->name} ({$c->program?->full_name})\nLevel: {$c->level?->name}\nPaper: {$c->code} — {$c->title}\n"
            .($c->about ? "About: ".mb_substr(strip_tags($c->about), 0, 1500)."\n" : '')
            .($c->learn ? "Learning outcomes: ".implode('; ', (array) $c->learn)."\n" : '')
            .($c->structure ? "Exam structure: ".implode('; ', (array) $c->structure)."\n" : '')
            .($c->exam_format ? "Exam format: {$c->exam_format}\n" : '');
    }

    /** A full lecture plan for a paper. */
    public static function curriculum(Course $course, int $count = 12, ?string $notes = null): array
    {
        $count = max(3, min(40, $count));
        $out = self::json(self::courseContext($course).($notes ? "Teacher's notes: {$notes}\n" : '')."\n"
            ."Design a complete teaching curriculum of exactly {$count} lectures that covers the whole syllabus of this paper in a logical order, grouped into chapters that follow the official syllabus areas. "
            ."Return JSON: {\"overview\": string (2-3 sentences), \"lectures\": [{\"chapter\": string (e.g. 'Chapter 1 — The context and purpose of financial reporting'), \"title\": string (e.g. 'Lecture 1 — …'), "
            ."\"description\": string (2-3 sentences), \"objectives\": [3-5 short strings], \"duration_minutes\": integer 45-120}]}");
        $out['lectures'] = array_values(array_filter($out['lectures'] ?? [], fn ($l) => !empty($l['title'])));
        return $out;
    }

    /** Detailed study notes for one lecture (markdown). */
    public static function studyMaterial(Lesson $lesson, ?string $notes = null): array
    {
        $lesson->loadMissing('course');
        return self::json(self::courseContext($lesson->course)."\nLecture: {$lesson->title}\n".($lesson->chapter ? "Chapter: {$lesson->chapter}\n" : '')
            .($lesson->description ? "Lecture description: {$lesson->description}\n" : '').($lesson->objectives ? 'Objectives: '.implode('; ', (array) $lesson->objectives)."\n" : '')
            .($notes ? "Teacher's instructions: {$notes}\n" : '')
            ."\nWrite complete study material for this lecture that a student can revise from. Use Markdown with these sections: "
            ."'## Overview', '## Learning objectives', '## Key concepts' (clear explanations with sub-headings), '## Worked example' (at least one fully worked numerical or scenario example with a step-by-step solution; use a Markdown table where it helps), "
            ."'## Common mistakes', '## Exam tips', '## Key terms' (a short glossary), '## Quick recap' (5-8 bullet points). Length 900-1600 words. "
            ."Return JSON: {\"summary\": string (2 sentences), \"objectives\": [3-6 strings], \"material\": string (the Markdown)}", 9000);
    }

    /** Quiz / MCQs / short questions for a lecture or a whole paper. */
    public static function quiz(Course $course, ?Lesson $lesson, string $kind = 'mcq', int $count = 10, string $difficulty = 'exam', ?string $notes = null): array
    {
        $count = max(1, min(40, $count));
        $mix = match ($kind) {
            'short' => "{$count} short-answer questions (type \"short\"), each with a model answer of 2-6 sentences or a short calculation and 2-5 marks",
            'mixed' => 'a mix of about '.(int) ceil($count * 0.7).' multiple-choice (type "mcq", 1-2 marks) and '.(int) floor($count * 0.3).' short-answer questions (type "short", 2-5 marks, with model answers)',
            default => "{$count} multiple-choice questions (type \"mcq\") with exactly 4 options, one correct answer, 1-2 marks each",
        };
        $material = $lesson?->study_material ? "\nStudy material for the lecture (base the questions on this):\n".mb_substr($lesson->study_material, 0, 9000)."\n" : '';
        return self::json(self::courseContext($course).($lesson ? "\nLecture: {$lesson->title}\n".($lesson->description ? "Description: {$lesson->description}\n" : '') : "\nScope: the whole paper\n")
            .$material.($notes ? "Teacher's instructions: {$notes}\n" : '')
            ."\nWrite {$mix}. Difficulty: {$difficulty} (match real ACCA/ICAP exam style; include calculation-based questions where the syllabus is numerical). "
            ."Distractors must be plausible (common student mistakes). Vary the position of the correct option. Every question needs a clear explanation of why the answer is correct. "
            ."Return JSON: {\"title\": string, \"description\": string (1 sentence), \"questions\": [{\"type\": \"mcq\"|\"short\", \"question\": string, \"options\": [4 strings] (mcq only), "
            ."\"correct_index\": 0-3 (mcq only), \"answer\": string (model answer, short only), \"explanation\": string, \"marks\": integer}]}", 9000);
    }

    /**
     * Mark short answers against model answers.
     * @param array<int, array{id:int, question:string, answer:?string, student:?string, marks:int}> $items
     * @return array<int, array{score: float, feedback: string}> keyed by question id
     */
    public static function gradeShort(array $items): array
    {
        if (!$items) return [];
        $out = self::json("Mark these short-answer exam responses fairly, like an ACCA/ICAP marker. Award partial marks for partly correct points. A blank or irrelevant answer scores 0. "
            ."Give one or two sentences of constructive feedback addressed to the student.\n\n".json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
            ."\n\nReturn JSON: {\"results\": [{\"id\": integer, \"score\": number (0 to marks, may be .5), \"feedback\": string}]}", 4000);
        $res = [];
        foreach ($out['results'] ?? [] as $r) if (isset($r['id'])) $res[(int) $r['id']] = ['score' => (float) ($r['score'] ?? 0), 'feedback' => (string) ($r['feedback'] ?? '')];
        return $res;
    }
}
