<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ManagesCourses;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Support\Activity;
use App\Support\Ai;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Quizzes, MCQs and short questions — built by teachers (or with AI), taken by students with instant marking. */
class QuizController extends Controller
{
    use ManagesCourses;

    // ---------------------------------------------------------------- teacher / admin

    public function index(Request $request)
    {
        $q = Quiz::with(['course:id,code,title', 'lesson:id,title', 'creator:id,name'])->withCount(['questions', 'attempts'])
            ->whereIn('course_id', $this->myCourseIds($request->user()));
        if ($request->filled('course_id')) $q->where('course_id', $request->course_id);
        if ($request->filled('lesson_id')) $q->where('lesson_id', $request->lesson_id);
        return response()->json($q->orderBy('course_id')->orderBy('sort_order')->orderByDesc('id')->get());
    }

    public function show(Request $request, Quiz $quiz)
    {
        $this->ownCourse($request, $quiz->course_id);
        return response()->json($quiz->load(['questions', 'course:id,code,title', 'lesson:id,title']));
    }

    protected function validated(Request $request, bool $creating): array
    {
        return $request->validate([
            'course_id' => ($creating ? 'required' : 'sometimes').'|exists:courses,id',
            'lesson_id' => 'nullable|exists:lessons,id',
            'title' => ($creating ? 'required' : 'sometimes').'|string|max:200',
            'kind' => 'nullable|in:mcq,short,mixed',
            'description' => 'nullable|string|max:2000',
            'time_limit_minutes' => 'nullable|integer|min:1|max:600',
            'pass_percentage' => 'nullable|integer|min:0|max:100',
            'max_attempts' => 'nullable|integer|min:1|max:100',
            'difficulty' => 'nullable|string|max:20',
            'is_published' => 'nullable|boolean',
            'ai_generated' => 'nullable|boolean',
            'sort_order' => 'nullable|integer',
            'questions' => ($creating ? 'required' : 'sometimes').'|array|min:1|max:200',
            'questions.*.type' => 'required|in:mcq,short',
            'questions.*.question' => 'required|string|max:5000',
            'questions.*.options' => 'nullable|array|max:8',
            'questions.*.options.*' => 'nullable|string|max:1000',
            'questions.*.correct_index' => 'nullable|integer|min:0|max:7',
            'questions.*.answer' => 'nullable|string|max:5000',
            'questions.*.explanation' => 'nullable|string|max:5000',
            'questions.*.marks' => 'nullable|integer|min:1|max:100',
        ]);
    }

    protected function checkQuestions(array $questions): void
    {
        foreach ($questions as $i => $q) {
            if ($q['type'] !== 'mcq') continue;
            $opts = array_values(array_filter($q['options'] ?? [], fn ($o) => trim((string) $o) !== ''));
            if (count($opts) < 2) throw ValidationException::withMessages(["questions.$i.options" => 'Question '.($i + 1).' needs at least 2 options.']);
            if (!isset($q['correct_index']) || $q['correct_index'] >= count($opts)) throw ValidationException::withMessages(["questions.$i.correct_index" => 'Choose the correct answer for question '.($i + 1).'.']);
        }
    }

    protected function save(Request $request, Quiz $quiz, array $data): Quiz
    {
        if (isset($data['lesson_id']) && $data['lesson_id'] && Lesson::find($data['lesson_id'])?->course_id != ($data['course_id'] ?? $quiz->course_id)) {
            throw ValidationException::withMessages(['lesson_id' => 'That lecture belongs to another course.']);
        }
        if (isset($data['questions'])) $this->checkQuestions($data['questions']);
        $wasPublished = (bool) $quiz->is_published;
        DB::transaction(function () use ($quiz, $data, $request) {
            $quiz->fill(collect($data)->except('questions')->all());
            if (!$quiz->exists) $quiz->created_by = $request->user()->id;
            $quiz->kind ??= 'mcq';
            $quiz->save();
            if (isset($data['questions'])) {
                $quiz->questions()->delete();
                foreach (array_values($data['questions']) as $i => $q) {
                    $opts = $q['type'] === 'mcq' ? array_values(array_filter($q['options'] ?? [], fn ($o) => trim((string) $o) !== '')) : null;
                    $quiz->questions()->create([
                        'type' => $q['type'], 'question' => $q['question'], 'options' => $opts,
                        'correct_index' => $q['type'] === 'mcq' ? (int) $q['correct_index'] : null,
                        'answer' => $q['answer'] ?? null, 'explanation' => $q['explanation'] ?? null,
                        'marks' => $q['marks'] ?? ($q['type'] === 'short' ? 3 : 1), 'sort_order' => $i + 1,
                    ]);
                }
                $kinds = collect($data['questions'])->pluck('type')->unique();
                $quiz->update(['kind' => $kinds->count() > 1 ? 'mixed' : $kinds->first()]);
            }
        });
        if (!$wasPublished && $quiz->is_published) Notify::quizPublished($quiz);
        return $quiz;
    }

    public function store(Request $request)
    {
        $data = $this->validated($request, true);
        $this->ownCourse($request, (int) $data['course_id']);
        $quiz = $this->save($request, new Quiz(), $data);
        Activity::log('quiz.create', "Quiz '{$quiz->title}' created", $quiz, collect($data)->except('questions')->all());
        return response()->json($quiz->load('questions'), 201);
    }

    public function update(Request $request, Quiz $quiz)
    {
        $this->ownCourse($request, $quiz->course_id);
        $data = $this->validated($request, false);
        if (isset($data['course_id'])) $this->ownCourse($request, (int) $data['course_id']);
        $this->save($request, $quiz, $data);
        Activity::log('quiz.update', "Quiz '{$quiz->title}' updated", $quiz, collect($data)->except('questions')->all());
        return response()->json($quiz->fresh('questions'));
    }

    public function destroy(Request $request, Quiz $quiz)
    {
        $this->ownCourse($request, $quiz->course_id);
        Activity::log('quiz.delete', "Quiz '{$quiz->title}' deleted", $quiz);
        $quiz->delete();
        return response()->json(['ok' => true]);
    }

    public function results(Request $request, Quiz $quiz)
    {
        $this->ownCourse($request, $quiz->course_id);
        $attempts = $quiz->attempts()->with('user:id,name,email,registration_no')->whereNotNull('submitted_at')->latest('submitted_at')->get();
        return response()->json([
            'quiz' => $quiz->loadCount('questions'),
            'attempts' => $attempts,
            'summary' => [
                'attempts' => $attempts->count(),
                'students' => $attempts->pluck('user_id')->unique()->count(),
                'average' => $attempts->count() ? round($attempts->avg('percentage')) : 0,
                'pass_rate' => $attempts->count() ? round($attempts->where('passed', true)->count() * 100 / $attempts->count()) : 0,
            ],
        ]);
    }

    // ---------------------------------------------------------------- students

    protected function studentQuiz(Request $request, Quiz $quiz): Quiz
    {
        abort_unless($quiz->is_published, 404);
        $e = Enrollment::where('user_id', $request->user()->id)->where('course_id', $quiz->course_id)->first();
        abort_unless($e && $e->hasAccess(), 403, 'You do not have access to this course.');
        return $quiz;
    }

    /** Questions without answers. */
    public function take(Request $request, Quiz $quiz)
    {
        $this->studentQuiz($request, $quiz);
        $attempts = QuizAttempt::where('quiz_id', $quiz->id)->where('user_id', $request->user()->id)->whereNotNull('submitted_at')->latest('submitted_at')->get();
        return response()->json([
            'quiz' => $quiz->only(['id', 'title', 'description', 'kind', 'time_limit_minutes', 'pass_percentage', 'max_attempts', 'lesson_id', 'course_id']),
            'questions' => $quiz->questions->map(fn ($q) => $q->only(['id', 'type', 'question', 'options', 'marks'])),
            'attempts' => $attempts->map->only(['id', 'score', 'total', 'percentage', 'passed', 'submitted_at']),
            'can_attempt' => !$quiz->max_attempts || $attempts->count() < $quiz->max_attempts,
            'ai_marking' => Ai::enabled(),
        ]);
    }

    public function submit(Request $request, Quiz $quiz)
    {
        $this->studentQuiz($request, $quiz);
        $data = $request->validate(['answers' => 'present|array', 'answers.*' => 'nullable', 'started_at' => 'nullable|date']);
        $done = QuizAttempt::where('quiz_id', $quiz->id)->where('user_id', $request->user()->id)->whereNotNull('submitted_at')->count();
        if ($quiz->max_attempts && $done >= $quiz->max_attempts) throw ValidationException::withMessages(['answers' => 'You have used all attempts for this quiz.']);

        $answers = $data['answers'];
        $results = [];
        $score = 0; $total = 0; $short = [];
        foreach ($quiz->questions as $q) {
            $given = $answers[$q->id] ?? $answers[(string) $q->id] ?? null;
            $total += $q->marks;
            if ($q->type === 'mcq') {
                $ok = $given !== null && $given !== '' && (int) $given === (int) $q->correct_index;
                $score += $ok ? $q->marks : 0;
                $results[$q->id] = ['type' => 'mcq', 'given' => $given === null || $given === '' ? null : (int) $given, 'correct_index' => $q->correct_index, 'correct' => $ok, 'score' => $ok ? $q->marks : 0, 'marks' => $q->marks, 'explanation' => $q->explanation];
            } else {
                $text = trim((string) $given);
                $results[$q->id] = ['type' => 'short', 'given' => $text, 'answer' => $q->answer, 'score' => 0, 'marks' => $q->marks, 'explanation' => $q->explanation, 'feedback' => null, 'graded' => false];
                if ($text !== '') $short[] = ['id' => $q->id, 'question' => $q->question, 'model_answer' => $q->answer, 'student_answer' => $text, 'marks' => $q->marks];
            }
        }
        if ($short && Ai::enabled()) {
            try {
                @set_time_limit(180);
                foreach (Ai::gradeShort($short) as $id => $g) {
                    if (!isset($results[$id])) continue;
                    $s = max(0, min($results[$id]['marks'], round($g['score'] * 2) / 2));
                    $results[$id] = array_merge($results[$id], ['score' => $s, 'feedback' => $g['feedback'], 'graded' => true, 'correct' => $s >= $results[$id]['marks'] * 0.5]);
                    $score += $s;
                }
            } catch (\Throwable $e) { report($e); }
        }
        // Without AI marking, short answers are self-checked against the model answer and excluded from the total.
        $ungraded = collect($results)->where('type', 'short')->where('graded', false)->sum('marks');
        $total -= $ungraded;
        $pct = $total > 0 ? (int) round($score * 100 / $total) : 0;

        $attempt = QuizAttempt::create([
            'quiz_id' => $quiz->id, 'user_id' => $request->user()->id, 'answers' => $answers, 'results' => $results,
            'score' => $score, 'total' => $total, 'percentage' => $pct, 'passed' => $pct >= $quiz->pass_percentage,
            'started_at' => $data['started_at'] ?? null, 'submitted_at' => now(),
        ]);
        Activity::log('quiz.submit', "Quiz '{$quiz->title}' submitted: {$score}/{$total} ({$pct}%)", $attempt);
        return response()->json(['attempt' => $attempt, 'questions' => $quiz->questions, 'ungraded_marks' => $ungraded]);
    }
}
