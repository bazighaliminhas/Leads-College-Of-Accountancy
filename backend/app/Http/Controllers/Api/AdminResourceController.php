<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models;
use App\Support\Activity;
use App\Support\Notify;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Generic admin CRUD over every table in the system.
 * GET /api/admin/r/{resource}            list (search, filters, pagination)
 * POST /api/admin/r/{resource}           create
 * GET /api/admin/r/{resource}/{id}       show
 * POST|PUT /api/admin/r/{resource}/{id}  update (multipart allowed)
 * DELETE /api/admin/r/{resource}/{id}    delete
 */
class AdminResourceController extends Controller
{
    protected function registry(?int $id = null): array
    {
        return [
            'users' => [
                'model' => Models\User::class,
                'search' => ['name', 'email', 'username', 'phone', 'registration_no', 'city'],
                'filters' => ['role', 'status'],
                'with' => ['teachingCourses:id,code,title'],
                'files' => ['avatar' => 'public:avatars'],
                'rules' => [
                    'first_name' => 'required|string|max:80', 'last_name' => 'nullable|string|max:80',
                    'username' => ['required', 'alpha_dash', 'max:40', Rule::unique('users', 'username')->ignore($id)],
                    'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($id)],
                    'password' => ($id ? 'nullable' : 'required').'|string|min:8',
                    'role' => 'required|in:admin,teacher,student', 'status' => 'required|in:active,blocked',
                    'phone' => 'nullable|max:30', 'father_name' => 'nullable|max:120', 'dob' => 'nullable|date', 'gender' => 'nullable|max:20', 'cnic' => 'nullable|max:20',
                    'city' => 'nullable|max:80', 'country' => 'nullable|max:80', 'address' => 'nullable|max:500', 'qualification' => 'nullable|max:150',
                    'registration_no' => 'nullable|max:50', 'designation' => 'nullable|max:120', 'specialization' => 'nullable|max:200', 'bio' => 'nullable|max:3000',
                    'avatar' => 'nullable|image|max:4096',
                ],
            ],
            'programs' => ['model' => Models\Program::class, 'search' => ['name', 'full_name'], 'files' => ['image' => 'public:programs'], 'rules' => [
                'name' => 'required|max:50', 'slug' => ['required', 'alpha_dash', Rule::unique('programs', 'slug')->ignore($id)], 'full_name' => 'nullable|max:200', 'awarding_body' => 'nullable|max:200',
                'tagline' => 'nullable|max:255', 'description' => 'nullable', 'overview' => 'nullable|array', 'registration_fee' => 'required|numeric|min:0', 'registration_fee_scholarship' => 'nullable|numeric|min:0',
                'registration_no_label' => 'nullable|max:100', 'sort_order' => 'nullable|integer', 'status' => 'required|in:active,inactive', 'image' => 'nullable|image|max:4096']],
            'levels' => ['model' => Models\Level::class, 'search' => ['name'], 'filters' => ['program_id'], 'with' => ['program:id,name'], 'rules' => [
                'program_id' => 'required|exists:programs,id', 'name' => 'required|max:150', 'slug' => 'required|alpha_dash|max:150', 'description' => 'nullable', 'sort_order' => 'nullable|integer']],
            'courses' => ['model' => Models\Course::class, 'search' => ['code', 'title'], 'filters' => ['program_id', 'level_id', 'status'], 'with' => ['program:id,name', 'level:id,name', 'teachers:id,name'], 'counts' => ['lessons', 'enrollments'],
                'files' => ['image' => 'public:courses'], 'rules' => [
                'program_id' => 'required|exists:programs,id', 'level_id' => 'nullable|exists:levels,id', 'code' => 'required|max:20', 'title' => 'required|max:200',
                'slug' => ['nullable', 'alpha_dash', Rule::unique('courses', 'slug')->ignore($id)], 'short_description' => 'nullable|max:500', 'about' => 'nullable',
                'learn' => 'nullable|array', 'structure' => 'nullable|array', 'exam_duration' => 'nullable|max:60', 'exam_format' => 'nullable|max:255', 'pass_mark' => 'nullable|max:20',
                'fee' => 'nullable|numeric|min:0', 'scholarship_fee' => 'nullable|numeric|min:0', 'class_duration' => 'nullable|max:100', 'language' => 'nullable|max:60',
                'is_purchasable' => 'boolean', 'is_featured' => 'boolean', 'status' => 'required|in:published,draft,pending', 'sort_order' => 'nullable|integer', 'image' => 'nullable|image|max:4096']],
            'lessons' => ['model' => Models\Lesson::class, 'search' => ['title', 'chapter'], 'filters' => ['course_id', 'type'], 'with' => ['course:id,code,title', 'uploader:id,name'], 'custom' => 'lesson'],
            'course-teachers' => ['model' => Models\CourseTeacher::class, 'filters' => ['course_id', 'teacher_id'], 'with' => ['course:id,code,title', 'teacher:id,name,email'], 'rules' => [
                'course_id' => 'required|exists:courses,id', 'teacher_id' => 'required|exists:users,id', 'can_upload' => 'boolean']],
            'exam-sessions' => ['model' => Models\ExamSession::class, 'search' => ['name'], 'filters' => ['program_id', 'status'], 'with' => ['program:id,name'], 'rules' => [
                'program_id' => 'required|exists:programs,id', 'name' => 'required|max:100', 'starts_on' => 'nullable|date', 'status' => 'required|in:open,closed', 'sort_order' => 'nullable|integer']],
            'orders' => ['model' => Models\Order::class, 'search' => ['order_no', 'first_name', 'last_name', 'email', 'phone', 'registration_no'], 'filters' => ['status', 'user_id'], 'with' => ['items', 'payments', 'user:id,name,username,email', 'reviewer:id,name'], 'rules' => [
                'status' => 'required|in:pending_payment,payment_submitted,approved,rejected,cancelled', 'first_name' => 'required|max:80', 'last_name' => 'nullable|max:80', 'email' => 'required|email', 'phone' => 'required|max:30',
                'dob' => 'nullable|date', 'cnic' => 'nullable|max:20', 'city' => 'nullable|max:80', 'country' => 'nullable|max:80', 'address' => 'nullable|max:500', 'registration_no' => 'nullable|max:50', 'qualification' => 'nullable|max:150',
                'subtotal' => 'required|numeric|min:0', 'registration_fee' => 'required|numeric|min:0', 'total' => 'required|numeric|min:0', 'notes' => 'nullable', 'admin_remarks' => 'nullable']],
            'order-items' => ['model' => Models\OrderItem::class, 'filters' => ['order_id'], 'with' => ['order:id,order_no'], 'rules' => [
                'order_id' => 'required|exists:orders,id', 'course_id' => 'nullable|exists:courses,id', 'item_type' => 'required|in:course,registration_fee', 'code' => 'nullable|max:30', 'title' => 'required|max:200', 'session_name' => 'nullable|max:100', 'price' => 'required|numeric|min:0']],
            'payments' => ['model' => Models\Payment::class, 'search' => ['transaction_ref', 'account_title', 'paid_from', 'method'], 'filters' => ['status', 'order_id', 'user_id'], 'with' => ['order:id,order_no,total,status', 'user:id,name,email', 'verifier:id,name'],
                'files' => ['screenshot' => 'local:payments'], 'rules' => [
                'order_id' => 'required|exists:orders,id', 'user_id' => 'required|exists:users,id', 'method' => 'required|max:60', 'paid_from' => 'nullable|max:120', 'account_title' => 'nullable|max:120', 'account_number' => 'nullable|max:60',
                'paid_to' => 'nullable|max:160', 'transaction_ref' => 'required|max:120', 'amount' => 'required|numeric|min:0', 'paid_on' => 'nullable|date', 'note' => 'nullable', 'status' => 'required|in:submitted,verified,rejected', 'remarks' => 'nullable',
                'screenshot' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:8192']],
            'enrollments' => ['model' => Models\Enrollment::class, 'filters' => ['status', 'course_id', 'user_id'], 'with' => ['user:id,name,email,username', 'course:id,code,title', 'examSession:id,name', 'order:id,order_no', 'granter:id,name'],
                'searchRel' => ['user' => ['name', 'email'], 'course' => ['code', 'title']], 'rules' => [
                'user_id' => 'required|exists:users,id', 'course_id' => 'required|exists:courses,id', 'order_id' => 'nullable|exists:orders,id', 'exam_session_id' => 'nullable|exists:exam_sessions,id',
                'status' => 'required|in:pending,active,suspended,completed,cancelled', 'access_expires_on' => 'nullable|date', 'progress' => 'nullable|integer|min:0|max:100', 'remarks' => 'nullable']],
            'carts' => ['model' => Models\Cart::class, 'filters' => ['status', 'user_id'], 'with' => ['user:id,name,email', 'items.course:id,code,title,fee'], 'rules' => ['status' => 'required|in:active,converted']],
            'cart-items' => ['model' => Models\CartItem::class, 'filters' => ['cart_id'], 'with' => ['course:id,code,title'], 'rules' => ['cart_id' => 'required|exists:carts,id', 'course_id' => 'required|exists:courses,id', 'exam_session_id' => 'nullable|exists:exam_sessions,id', 'price' => 'nullable|numeric']],
            'lesson-progress' => ['model' => Models\LessonProgress::class, 'filters' => ['user_id', 'course_id'], 'with' => ['user:id,name', 'lesson:id,title'], 'rules' => ['completed_at' => 'nullable|date', 'views' => 'nullable|integer', 'last_position_seconds' => 'nullable|integer']],
            'announcements' => ['model' => Models\Announcement::class, 'search' => ['title', 'body'], 'filters' => ['audience', 'course_id'], 'with' => ['author:id,name', 'course:id,code'], 'rules' => [
                'title' => 'required|max:200', 'body' => 'required', 'audience' => 'required|in:all,students,teachers,course', 'course_id' => 'nullable|required_if:audience,course|exists:courses,id', 'is_published' => 'boolean']],
            'notifications' => ['model' => Models\UserNotification::class, 'search' => ['title', 'body'], 'filters' => ['user_id', 'type'], 'with' => ['user:id,name,email'], 'rules' => [
                'user_id' => 'required|exists:users,id', 'type' => 'nullable|max:30', 'title' => 'required|max:200', 'body' => 'nullable', 'link' => 'nullable|max:255']],
            'contact-messages' => ['model' => Models\ContactMessage::class, 'search' => ['name', 'email', 'subject', 'message'], 'filters' => ['status'], 'rules' => [
                'name' => 'required|max:120', 'email' => 'required|email', 'phone' => 'nullable|max:30', 'subject' => 'nullable|max:200', 'message' => 'required', 'status' => 'required|in:new,read,replied']],
            'inquiries' => ['model' => Models\Inquiry::class, 'search' => ['name', 'email', 'phone', 'city'], 'filters' => ['status', 'program'], 'rules' => [
                'name' => 'required|max:120', 'email' => 'required|email', 'phone' => 'required|max:30', 'program' => 'nullable|max:50', 'qualification' => 'nullable|max:150', 'city' => 'nullable|max:80', 'message' => 'nullable', 'status' => 'required|in:new,contacted,closed']],
            'subscribers' => ['model' => Models\NewsletterSubscriber::class, 'search' => ['email'], 'rules' => ['email' => ['required', 'email', Rule::unique('newsletter_subscribers', 'email')->ignore($id)]]],
            'payment-accounts' => ['model' => Models\PaymentAccount::class, 'search' => ['provider', 'account_title', 'account_number'], 'rules' => [
                'type' => 'required|in:bank,wallet', 'provider' => 'required|max:120', 'account_title' => 'required|max:150', 'account_number' => 'required|max:60', 'iban' => 'nullable|max:60', 'branch' => 'nullable|max:150',
                'instructions' => 'nullable', 'is_active' => 'boolean', 'sort_order' => 'nullable|integer']],
            'settings' => ['model' => Models\Setting::class, 'search' => ['key', 'label', 'value'], 'filters' => ['group'], 'rules' => [
                'key' => ['required', 'max:100', Rule::unique('settings', 'key')->ignore($id)], 'value' => 'nullable', 'group' => 'required|max:50', 'label' => 'nullable|max:150']],
            'live-classes' => ['model' => Models\LiveClass::class, 'search' => ['title', 'meet_link'], 'filters' => ['course_id', 'teacher_id', 'status', 'link_source'], 'with' => ['course:id,code,title', 'teacher:id,name'], 'rules' => [
                'course_id' => 'required|exists:courses,id', 'teacher_id' => 'nullable|exists:users,id', 'title' => 'required|max:200', 'description' => 'nullable', 'starts_at' => 'required|date',
                'duration_minutes' => 'nullable|integer|min:10|max:600', 'meet_link' => 'nullable|url|max:500', 'status' => 'required|in:draft,scheduled,completed,cancelled', 'recording_url' => 'nullable|url|max:500']],
            'quizzes' => ['model' => Models\Quiz::class, 'search' => ['title'], 'filters' => ['course_id', 'lesson_id', 'kind', 'is_published'], 'with' => ['course:id,code,title', 'lesson:id,title', 'creator:id,name'], 'counts' => ['questions', 'attempts'], 'rules' => [
                'course_id' => 'required|exists:courses,id', 'lesson_id' => 'nullable|exists:lessons,id', 'title' => 'required|max:200', 'kind' => 'nullable|in:mcq,short,mixed', 'description' => 'nullable',
                'time_limit_minutes' => 'nullable|integer|min:1', 'pass_percentage' => 'nullable|integer|min:0|max:100', 'max_attempts' => 'nullable|integer|min:1', 'is_published' => 'boolean']],
            'quiz-questions' => ['model' => Models\QuizQuestion::class, 'search' => ['question'], 'filters' => ['quiz_id', 'type'], 'with' => ['quiz:id,title,course_id'], 'rules' => [
                'quiz_id' => 'required|exists:quizzes,id', 'type' => 'required|in:mcq,short', 'question' => 'required', 'options' => 'nullable|array', 'correct_index' => 'nullable|integer|min:0|max:7',
                'answer' => 'nullable', 'explanation' => 'nullable', 'marks' => 'nullable|integer|min:1', 'sort_order' => 'nullable|integer']],
            'quiz-attempts' => ['model' => Models\QuizAttempt::class, 'filters' => ['quiz_id', 'user_id', 'passed'], 'with' => ['quiz:id,title,course_id', 'quiz.course:id,code', 'user:id,name,email'], 'searchRel' => ['user' => ['name', 'email'], 'quiz' => ['title']], 'rules' => [
                'score' => 'nullable|numeric', 'total' => 'nullable|numeric', 'percentage' => 'nullable|integer|min:0|max:100', 'passed' => 'boolean']],
            'message-logs' => ['model' => Models\MessageLog::class, 'search' => ['recipient', 'subject', 'body'], 'filters' => ['channel', 'status', 'user_id'], 'with' => ['user:id,name'], 'readonly' => true],
            'activity-logs' => ['model' => Models\ActivityLog::class, 'search' => ['action', 'description', 'ip', 'url'], 'filters' => ['action', 'user_id', 'method'], 'with' => ['user:id,name,role'], 'readonly' => true],
        ];
    }

    protected function cfg(string $resource, ?int $id = null): array
    {
        $r = $this->registry($id);
        abort_unless(isset($r[$resource]), 404, 'Unknown resource');
        return $r[$resource];
    }

    public function index(Request $request, string $resource)
    {
        $c = $this->cfg($resource);
        $q = $c['model']::query()->with($c['with'] ?? []);
        if (!empty($c['counts'])) $q->withCount($c['counts']);
        foreach ($c['filters'] ?? [] as $f) if ($request->filled($f)) $q->where($f, $request->input($f));
        if ($s = trim((string) $request->search)) {
            $q->where(function ($w) use ($c, $s) {
                foreach ($c['search'] ?? [] as $col) $w->orWhere($col, 'like', "%$s%");
                foreach ($c['searchRel'] ?? [] as $rel => $cols) $w->orWhereHas($rel, fn ($r) => $r->where(fn ($x) => collect($cols)->each(fn ($col) => $x->orWhere($col, 'like', "%$s%"))));
                if (is_numeric($s)) $w->orWhere('id', (int) $s);
            });
        }
        $sort = $request->input('sort', 'id');
        $table = (new $c['model'])->getTable();
        $q->orderBy(preg_match('/^[a-z_]+$/', $sort) && Schema::hasColumn($table, $sort) ? $sort : 'id', $request->input('dir') === 'asc' ? 'asc' : 'desc');
        $per = min((int) $request->input('per_page', 25), 500);
        return response()->json($q->paginate($per));
    }

    public function show(string $resource, int $id)
    {
        $c = $this->cfg($resource, $id);
        $m = $c['model']::with($c['with'] ?? [])->findOrFail($id);
        if ($resource === 'lessons') return response()->json(array_merge($m->toArray(), StudentController::lessonPayload($m)));
        return response()->json($m);
    }

    public function store(Request $request, string $resource)
    {
        return $this->save($request, $resource, null);
    }

    public function update(Request $request, string $resource, int $id)
    {
        return $this->save($request, $resource, $id);
    }

    protected function save(Request $request, string $resource, ?int $id)
    {
        $c = $this->cfg($resource, $id);
        abort_if(!empty($c['readonly']), 405, 'Read-only resource');
        $this->normalize($request);
        $model = $id ? $c['model']::findOrFail($id) : new $c['model'];

        if (($c['custom'] ?? null) === 'lesson') {
            $request->validate(['course_id' => ($id ? 'sometimes' : 'required').'|exists:courses,id']);
            $data = TeacherController::validateLesson($request, !$id);
            if ($request->filled('course_id')) $model->course_id = $request->course_id;
            if (!$id) $model->uploaded_by = $request->user()->id;
            TeacherController::fillLesson($request, $model, $data);
            Activity::log("admin.$resource.".($id ? 'update' : 'create'), "Admin saved lesson {$model->title}", $model, $data);
            return response()->json($model->fresh(), $id ? 200 : 201);
        }

        $rules = $c['rules'];
        if ($id) foreach ($rules as $k => $r) { if (!$request->has($k) && !$request->hasFile($k)) unset($rules[$k]); }
        $data = $request->validate($rules);
        $before = $id ? $model->toArray() : null;

        foreach ($c['files'] ?? [] as $field => $spec) {
            [$disk, $dir] = explode(':', $spec);
            $col = $field === 'screenshot' ? 'screenshot_path' : $field;
            if ($request->hasFile($field)) {
                $data[$col] = $request->file($field)->store($dir, $disk);
                if ($field === 'screenshot') $data['screenshot_name'] = $request->file($field)->getClientOriginalName();
            }
            if ($field === 'screenshot') unset($data['screenshot']);
            elseif (!$request->hasFile($field)) unset($data[$field]);
        }

        $plainPassword = $request->input('password');
        if ($resource === 'users') {
            if (empty($data['password'])) unset($data['password']);
            if (($data['role'] ?? $model->role) === 'student') unset($data['course_ids']);
            if (isset($data['first_name']) || isset($data['last_name'])) $data['name'] = trim(($data['first_name'] ?? $model->first_name).' '.($data['last_name'] ?? $model->last_name));
            if (!$id) $data['created_by'] = $request->user()->id;
            if ($id === $request->user()->id && isset($data['status']) && $data['status'] !== 'active') abort(422, 'You cannot block your own account.');
        }
        if ($resource === 'courses' && empty($data['slug']) && !$id) $data['slug'] = Str::slug($data['code'].'-'.$data['title']);
        if ($resource === 'course-teachers' && !$id) $data['assigned_by'] = $request->user()->id;
        if ($resource === 'announcements' && !$id) $data['user_id'] = $request->user()->id;
        if ($resource === 'enrollments' && isset($data['status']) && $data['status'] === 'active' && $model->status !== 'active') { $data['granted_by'] = $request->user()->id; $data['granted_at'] = now(); }
        if ($resource === 'payments' && isset($data['status']) && $data['status'] !== 'submitted' && ($model->status ?? null) !== $data['status']) { $data['verified_by'] = $request->user()->id; $data['verified_at'] = now(); }

        $model->fill($data)->save();
        if ($resource === 'users' && $id && isset($data['password'])) $model->tokens()->delete(); // force re-login after admin password reset
        if ($resource === 'users' && $id && ($data['status'] ?? null) === 'blocked') $model->tokens()->delete();

        // Teachers: the courses they teach are chosen right in the teacher form
        if ($resource === 'users' && $model->role === 'teacher' && $request->has('course_ids')) {
            $ids = collect(is_array($request->course_ids) ? $request->course_ids : (json_decode((string) $request->course_ids, true) ?: []))->map(fn ($x) => (int) $x)->filter()->unique();
            $ids = Models\Course::whereIn('id', $ids)->pluck('id');
            $changes = $model->teachingCourses()->sync($ids->mapWithKeys(fn ($cid) => [$cid => ['assigned_by' => $request->user()->id, 'can_upload' => true]])->all());
            if ($id && $changes['attached']) Notify::coursesAssigned($model, Models\Course::whereIn('id', $changes['attached'])->get());
        }
        if ($resource === 'users' && $model->role === 'teacher' && $request->boolean('send_credentials')) {
            Notify::teacherWelcome($model, $plainPassword ?: null);
        }
        if ($resource === 'notifications' && !$id) {
            // Admin-written notification: also deliver it on WhatsApp + email
            $u = Models\User::find($model->user_id);
            if ($u) Notify::user($u, ['title' => $model->title, 'body' => $model->body, 'link' => $model->link, 'type' => $model->type ?: 'info', 'dashboard' => false]);
        }
        if (in_array($resource, ['programs', 'levels', 'courses', 'exam-sessions', 'payment-accounts', 'settings', 'users', 'course-teachers'])) PublicController::flushCache();
        if ($resource === 'enrollments' && isset($data['status']) && ($before['status'] ?? null) !== $data['status']) AdminController::notifyEnrollment($model);

        Activity::log("admin.$resource.".($id ? 'update' : 'create'), 'Admin '.($id ? 'updated' : 'created')." $resource #{$model->id}", $model, ['before' => $before, 'after' => Activity::clean($data)]);
        return response()->json($model->fresh($c['with'] ?? []), $id ? 200 : 201);
    }

    public function destroy(Request $request, string $resource, int $id)
    {
        $c = $this->cfg($resource, $id);
        $m = $c['model']::findOrFail($id);
        if ($resource === 'users' && $m->id === $request->user()->id) abort(422, 'You cannot delete your own account.');
        if ($resource === 'lessons') TeacherController::deleteLessonFiles($m);
        if ($resource === 'payments' && $m->screenshot_path) Storage::disk('local')->delete($m->screenshot_path);
        if ($resource === 'live-classes') { try { \App\Support\GoogleCalendar::delete($m, $m->status === 'scheduled'); } catch (\Throwable $e) { report($e); } }
        Activity::log("admin.$resource.delete", "Admin deleted $resource #$id", $m, ['record' => $m->toArray()]);
        $m->delete();
        PublicController::flushCache();
        return response()->json(['ok' => true]);
    }

    /** FormData sends everything as strings — convert JSON arrays / booleans / empty strings. */
    protected function normalize(Request $request): void
    {
        $all = $request->except(array_keys($request->allFiles()));
        foreach ($all as $k => $v) {
            if (!is_string($v)) continue;
            if ($v === '') $request->merge([$k => null]);
            elseif ($v === 'true' || $v === 'false') $request->merge([$k => $v === 'true']);
            elseif (in_array($k, ['learn', 'structure', 'overview', 'options', 'course_ids', 'objectives'], true) && str_starts_with(trim($v), '[')) $request->merge([$k => json_decode($v, true)]);
        }
    }
}
