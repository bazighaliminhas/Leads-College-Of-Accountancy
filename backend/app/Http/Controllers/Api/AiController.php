<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesCourses;
use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Support\Activity;
use App\Support\Ai;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** AI assistant for teachers & admins. Generation returns drafts — nothing reaches students until the teacher saves & publishes. */
class AiController extends Controller
{
    use ManagesCourses;

    public function status()
    {
        return response()->json(['enabled' => Ai::enabled(), 'provider' => Ai::provider()]);
    }

    protected function run(callable $fn)
    {
        if (!Ai::enabled()) throw ValidationException::withMessages(['ai' => 'AI is not set up yet. The admin needs to add AI_PROVIDER and AI_API_KEY in the .env file (see README → AI setup).']);
        @set_time_limit(200);
        try { return $fn(); }
        catch (ValidationException $e) { throw $e; }
        catch (\Illuminate\Http\Client\RequestException $e) {
            report($e);
            $msg = $e->response?->json('error.message') ?? $e->getMessage();
            throw ValidationException::withMessages(['ai' => 'AI service error: '.mb_substr((string) $msg, 0, 300)]);
        } catch (\Throwable $e) {
            report($e);
            throw ValidationException::withMessages(['ai' => $e->getMessage()]);
        }
    }

    public function curriculum(Request $request)
    {
        $data = $request->validate(['course_id' => 'required|exists:courses,id', 'count' => 'nullable|integer|min:3|max:40', 'notes' => 'nullable|string|max:2000']);
        $course = $this->ownCourse($request, (int) $data['course_id']);
        $out = $this->run(fn () => Ai::curriculum($course, $data['count'] ?? 12, $data['notes'] ?? null));
        Activity::log('ai.curriculum', "AI curriculum generated for {$course->code}", $course, $data);
        return response()->json($out);
    }

    /** Turn the (edited) curriculum into draft lectures: Lecture 1, Lecture 2, … */
    public function applyCurriculum(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'lectures' => 'required|array|min:1|max:60',
            'lectures.*.title' => 'required|string|max:200',
            'lectures.*.chapter' => 'nullable|string|max:150',
            'lectures.*.description' => 'nullable|string|max:3000',
            'lectures.*.objectives' => 'nullable|array',
            'lectures.*.objectives.*' => 'nullable|string|max:500',
            'lectures.*.duration_minutes' => 'nullable|integer|min:0|max:600',
        ]);
        $course = $this->ownCourse($request, (int) $data['course_id']);
        $order = (int) Lesson::where('course_id', $course->id)->max('sort_order');
        $made = [];
        foreach ($data['lectures'] as $l) {
            $made[] = Lesson::create([
                'course_id' => $course->id, 'uploaded_by' => $request->user()->id, 'chapter' => $l['chapter'] ?? null, 'title' => $l['title'],
                'description' => $l['description'] ?? null, 'objectives' => array_values(array_filter($l['objectives'] ?? [])), 'duration_minutes' => $l['duration_minutes'] ?? null,
                'type' => 'video', 'sort_order' => ++$order, 'is_published' => false, 'ai_generated' => true,
            ]);
        }
        Activity::log('ai.curriculum.apply', count($made)." draft lectures created for {$course->code}", $course);
        return response()->json(['created' => count($made), 'lessons' => $made], 201);
    }

    public function studyMaterial(Request $request)
    {
        $data = $request->validate([
            'lesson_id' => 'nullable|required_without:course_id|exists:lessons,id', 'course_id' => 'nullable|required_without:lesson_id|exists:courses,id',
            'title' => 'nullable|required_without:lesson_id|string|max:200', 'chapter' => 'nullable|string|max:150', 'description' => 'nullable|string|max:3000',
            'notes' => 'nullable|string|max:2000', 'save' => 'nullable|boolean',
        ]);
        if (!empty($data['lesson_id'])) {
            $lesson = Lesson::findOrFail($data['lesson_id']);
        } else {
            // Lecture not saved yet — generate from the title the teacher typed
            $lesson = new Lesson(['course_id' => $data['course_id'], 'title' => $data['title'], 'chapter' => $data['chapter'] ?? null, 'description' => $data['description'] ?? null]);
            $data['save'] = false;
        }
        $this->ownCourse($request, $lesson->course_id);
        $out = $this->run(fn () => Ai::studyMaterial($lesson, $data['notes'] ?? null));
        if (!empty($data['save']) && $lesson->exists) {
            $lesson->update(['study_material' => $out['material'] ?? null, 'objectives' => $out['objectives'] ?? $lesson->objectives, 'description' => $lesson->description ?: ($out['summary'] ?? null), 'ai_generated' => true]);
        }
        Activity::log('ai.study_material', "AI study material for '{$lesson->title}'", $lesson->exists ? $lesson : null, $data);
        return response()->json($out);
    }

    public function quiz(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id', 'lesson_id' => 'nullable|exists:lessons,id',
            'kind' => 'nullable|in:mcq,short,mixed', 'count' => 'nullable|integer|min:1|max:40',
            'difficulty' => 'nullable|in:easy,medium,exam,hard', 'notes' => 'nullable|string|max:2000',
        ]);
        $course = $this->ownCourse($request, (int) $data['course_id']);
        $lesson = !empty($data['lesson_id']) ? Lesson::where('course_id', $course->id)->findOrFail($data['lesson_id']) : null;
        $out = $this->run(fn () => Ai::quiz($course, $lesson, $data['kind'] ?? 'mcq', $data['count'] ?? 10, $data['difficulty'] ?? 'exam', $data['notes'] ?? null));
        $out['questions'] = collect($out['questions'] ?? [])->map(function ($q) {
            $type = ($q['type'] ?? 'mcq') === 'short' ? 'short' : 'mcq';
            return ['type' => $type, 'question' => (string) ($q['question'] ?? ''), 'options' => $type === 'mcq' ? array_values(array_slice((array) ($q['options'] ?? []), 0, 6)) : null,
                'correct_index' => $type === 'mcq' ? (int) ($q['correct_index'] ?? 0) : null, 'answer' => $q['answer'] ?? null, 'explanation' => $q['explanation'] ?? null,
                'marks' => (int) ($q['marks'] ?? ($type === 'short' ? 3 : 1)) ?: 1];
        })->filter(fn ($q) => $q['question'] !== '')->values();
        Activity::log('ai.quiz', "AI quiz generated for {$course->code}", $course, $data);
        return response()->json($out);
    }
}
