<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\Course;
use App\Models\Inquiry;
use App\Models\NewsletterSubscriber;
use App\Models\PaymentAccount;
use App\Models\Program;
use App\Models\Setting;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Activity;
use App\Support\Notify;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PublicController extends Controller
{
    protected function courseCard($q)
    {
        return $q->with(['program:id,name,slug', 'level:id,name,slug', 'teachers:id,name,username,designation,avatar'])
            ->where('status', 'published')->orderBy('sort_order')->orderBy('id');
    }

    public function site()
    {
        $data = Cache::remember('lca_public_site_'.self::cacheVersion(), 300, function () {
            return [
                'settings' => Setting::allPublic(),
                'programs' => Program::where('status', 'active')->orderBy('sort_order')
                    ->with(['levels' => fn ($q) => $q->withCount(['courses' => fn ($c) => $c->where('status', 'published')]), 'examSessions' => fn ($q) => $q->where('status', 'open')])->get(),
                'payment_accounts' => PaymentAccount::where('is_active', true)->orderBy('sort_order')->get(),
            ];
        });
        return response()->json($data);
    }

    public static function cacheVersion(): int
    {
        return (int) Cache::get('lca_cache_v', 1);
    }

    /** Called after any admin change so the public website shows it immediately. */
    public static function flushCache(): void
    {
        Cache::forever('lca_cache_v', self::cacheVersion() + 1);
    }

    public function courses(Request $request)
    {
        $program = $request->program;
        $level = $request->level;
        $featured = $request->featured;
        $search = $request->search;

        if (!$search) {
            $cacheKey = 'lca_courses_'.self::cacheVersion().'_'.($program ?? 'all').'_'.($level ?? 'all').'_'.($featured ? '1' : '0');
            $data = Cache::remember($cacheKey, 180, function () use ($program, $level, $featured) {
                $q = $this->courseCard(Course::query());
                if ($program) $q->whereHas('program', fn ($p) => $p->where('slug', $program));
                if ($level) $q->whereHas('level', fn ($p) => $p->where('slug', $level));
                if ($featured) $q->where('is_featured', true);
                return $q->get()->makeHidden(['about', 'learn', 'structure']);
            });
            return response()->json($data);
        }

        $q = $this->courseCard(Course::query());
        if ($program) $q->whereHas('program', fn ($p) => $p->where('slug', $program));
        if ($level) $q->whereHas('level', fn ($p) => $p->where('slug', $level));
        if ($featured) $q->where('is_featured', true);
        $q->where(fn ($w) => $w->where('title', 'like', "%$search%")->orWhere('code', 'like', "%$search%"));
        return response()->json($q->get()->makeHidden(['about', 'learn', 'structure']));
    }

    public function course(string $slug)
    {
        $course = $this->courseCard(Course::query())->where('slug', $slug)->firstOrFail();
        $course->loadCount(['lessons' => fn ($q) => $q->where('is_published', true)]);
        $course->load(['lessons' => fn ($q) => $q->where('is_published', true)->select('id', 'course_id', 'chapter', 'title', 'type', 'duration_minutes', 'sort_order')]);
        $related = $this->courseCard(Course::query())->where('level_id', $course->level_id)->where('id', '!=', $course->id)->limit(4)->get()->makeHidden(['about', 'learn', 'structure']);
        $sessions = $course->program->examSessions()->where('status', 'open')->get();
        return response()->json(['course' => $course, 'related' => $related, 'sessions' => $sessions]);
    }

    public function program(string $slug)
    {
        $program = Program::where('slug', $slug)->where('status', 'active')
            ->with(['levels.courses' => fn ($q) => $q->where('status', 'published')->with('teachers:id,name,username,avatar')->select('id', 'program_id', 'level_id', 'code', 'slug', 'title', 'short_description', 'fee', 'scholarship_fee', 'exam_duration', 'pass_mark', 'is_purchasable', 'status', 'image', 'sort_order'), 'examSessions'])
            ->firstOrFail();
        return response()->json($program);
    }

    public function faculty()
    {
        return response()->json(User::where('role', 'teacher')->where('status', 'active')
            ->with(['teachingCourses' => fn ($q) => $q->where('status', 'published')->select('courses.id', 'code', 'title', 'slug', 'program_id')])
            ->get(['id', 'name', 'username', 'designation', 'specialization', 'bio', 'avatar', 'qualification']));
    }

    public function teacher(string $username)
    {
        $t = User::where('role', 'teacher')->where('username', $username)->where('status', 'active')
            ->with(['teachingCourses' => fn ($q) => $q->where('status', 'published')->with('program:id,name,slug')])
            ->firstOrFail(['id', 'name', 'username', 'designation', 'specialization', 'bio', 'avatar', 'qualification']);
        return response()->json($t);
    }

    public function contact(Request $request)
    {
        $data = $request->validate(['name' => 'required|max:120', 'email' => 'required|email', 'phone' => 'nullable|max:30', 'subject' => 'nullable|max:200', 'message' => 'required|max:5000']);
        $m = ContactMessage::create($data + ['ip' => $request->ip()]);
        Activity::log('contact.submit', "Contact message from {$m->email}", $m);
        Notify::contact($m);
        return response()->json(['message' => 'Thank you! Our admissions team will get back to you shortly.']);
    }

    public function inquiry(Request $request)
    {
        $data = $request->validate(['name' => 'required|max:120', 'email' => 'required|email', 'phone' => 'required|max:30', 'program' => 'nullable|max:50', 'qualification' => 'nullable|max:150', 'city' => 'nullable|max:80', 'message' => 'nullable|max:3000']);
        $m = Inquiry::create($data + ['ip' => $request->ip()]);
        Activity::log('inquiry.submit', "Admission inquiry from {$m->email}", $m);
        Notify::inquiry($m);
        return response()->json(['message' => 'Your admission inquiry has been received. A counsellor will call you soon.']);
    }

    public function newsletter(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        $s = NewsletterSubscriber::firstOrCreate(['email' => $data['email']], ['ip' => $request->ip()]);
        Activity::log('newsletter.subscribe', "Newsletter subscribe {$s->email}", $s);
        return response()->json(['message' => 'Subscribed! You will receive updates from Leads College of Accountancy.']);
    }

    /** Records page views from the SPA so every visit is stored in the DB. */
    public function track(Request $request)
    {
        $request->validate(['path' => 'required|string|max:500', 'title' => 'nullable|string|max:300', 'referrer' => 'nullable|string|max:500']);
        Activity::log('page.view', $request->path, null, ['path' => $request->path, 'title' => $request->title, 'referrer' => $request->referrer]);
        return response()->noContent();
    }
}
