<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminResourceController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\GoogleController;
use App\Http\Controllers\Api\LiveClassController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\TeacherController;
use Illuminate\Support\Facades\Route;

// ---------- Public website ----------
Route::get('/site', [PublicController::class, 'site']);
Route::get('/programs/{slug}', [PublicController::class, 'program']);
Route::get('/courses', [PublicController::class, 'courses']);
Route::get('/courses/{slug}', [PublicController::class, 'course']);
Route::get('/faculty', [PublicController::class, 'faculty']);
Route::get('/faculty/{username}', [PublicController::class, 'teacher']);
Route::middleware('throttle:20,1')->group(function () {
    Route::post('/contact', [PublicController::class, 'contact']);
    Route::post('/inquiry', [PublicController::class, 'inquiry']);
    Route::post('/newsletter', [PublicController::class, 'newsletter']);
});
Route::post('/track', [PublicController::class, 'track'])->middleware('throttle:120,1');

// ---------- Cart (guest or logged in, saved in DB) ----------
Route::get('/cart', [CartController::class, 'show']);
Route::post('/cart/items', [CartController::class, 'add']);
Route::delete('/cart/items/{item}', [CartController::class, 'remove']);
Route::delete('/cart', [CartController::class, 'clear']);

// ---------- Auth ----------
Route::middleware('throttle:30,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/password', [AuthController::class, 'changePassword']);
    Route::get('/notifications', [StudentController::class, 'notifications']);
    Route::post('/notifications/read', [StudentController::class, 'readNotifications']);

    // ---------- Student ----------
    Route::middleware('role:student')->prefix('student')->group(function () {
        Route::post('/checkout', [CheckoutController::class, 'placeOrder']);
        Route::post('/orders/{order}/payment', [CheckoutController::class, 'submitPayment']);
        Route::post('/orders/{order}/cancel', [CheckoutController::class, 'cancel']);
        Route::get('/dashboard', [StudentController::class, 'dashboard']);
        Route::get('/enrollments', [StudentController::class, 'enrollments']);
        Route::get('/learn/{slug}', [StudentController::class, 'learn']);
        Route::post('/lessons/{lesson}/progress', [StudentController::class, 'progress']);
        Route::get('/orders', [StudentController::class, 'orders']);
        Route::get('/orders/{order}', [StudentController::class, 'order']);
        Route::get('/announcements', [StudentController::class, 'announcements']);
        Route::get('/live', [LiveClassController::class, 'studentIndex']);
        Route::get('/quizzes/{quiz}', [QuizController::class, 'take']);
        Route::post('/quizzes/{quiz}/submit', [QuizController::class, 'submit'])->middleware('throttle:20,1');
    });

    // ---------- Teacher (admins may use every teacher tool for any course) ----------
    Route::middleware('role:teacher,admin')->prefix('teacher')->group(function () {
        Route::get('/dashboard', [TeacherController::class, 'dashboard']);
        Route::get('/courses', [TeacherController::class, 'courses']);
        Route::post('/courses', [TeacherController::class, 'storeCourse']);
        Route::get('/courses/{course}', [TeacherController::class, 'course']);
        Route::post('/courses/{course}', [TeacherController::class, 'updateCourse']);
        Route::post('/courses/{course}/lessons', [TeacherController::class, 'storeLesson']);
        Route::post('/lessons/{lesson}', [TeacherController::class, 'updateLesson']);
        Route::delete('/lessons/{lesson}', [TeacherController::class, 'destroyLesson']);
        Route::get('/students', [TeacherController::class, 'students']);
        Route::get('/announcements', [TeacherController::class, 'announcements']);
        Route::post('/announcements', [TeacherController::class, 'storeAnnouncement']);
        Route::delete('/announcements/{announcement}', [TeacherController::class, 'destroyAnnouncement']);

        // Live classes (Google Meet)
        Route::get('/live', [LiveClassController::class, 'index']);
        Route::post('/live', [LiveClassController::class, 'store']);
        Route::post('/live/{liveClass}', [LiveClassController::class, 'update']);
        Route::post('/live/{liveClass}/generate-link', [LiveClassController::class, 'generateLink']);
        Route::post('/live/{liveClass}/publish', [LiveClassController::class, 'publish']);
        Route::post('/live/{liveClass}/cancel', [LiveClassController::class, 'cancel']);
        Route::post('/live/{liveClass}/complete', [LiveClassController::class, 'complete']);
        Route::delete('/live/{liveClass}', [LiveClassController::class, 'destroy']);

        // Quizzes, MCQs and short questions
        Route::get('/quizzes', [QuizController::class, 'index']);
        Route::post('/quizzes', [QuizController::class, 'store']);
        Route::get('/quizzes/{quiz}', [QuizController::class, 'show']);
        Route::post('/quizzes/{quiz}', [QuizController::class, 'update']);
        Route::delete('/quizzes/{quiz}', [QuizController::class, 'destroy']);
        Route::get('/quizzes/{quiz}/results', [QuizController::class, 'results']);

        // AI assistant
        Route::get('/ai/status', [AiController::class, 'status']);
        Route::middleware('throttle:30,1')->group(function () {
            Route::post('/ai/curriculum', [AiController::class, 'curriculum']);
            Route::post('/ai/curriculum/apply', [AiController::class, 'applyCurriculum']);
            Route::post('/ai/study-material', [AiController::class, 'studyMaterial']);
            Route::post('/ai/quiz', [AiController::class, 'quiz']);
        });

        // Google account for automatic Meet links
        Route::get('/google', [GoogleController::class, 'status']);
        Route::post('/google/connect', [GoogleController::class, 'connect']);
        Route::delete('/google/connect', [GoogleController::class, 'disconnect']);
    });

    // ---------- Admin (full access) ----------
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);
        Route::get('/options', [AdminController::class, 'options']);
        Route::post('/orders/{order}/approve', [AdminController::class, 'approveOrder']);
        Route::post('/orders/{order}/reject', [AdminController::class, 'rejectOrder']);
        Route::post('/enrollments/{enrollment}/access', [AdminController::class, 'setAccess']);
        Route::post('/enroll', [AdminController::class, 'enrollStudent']);
        Route::post('/courses/{course}/teachers', [AdminController::class, 'assignTeachers']);
        Route::get('/settings', [AdminController::class, 'settings']);
        Route::post('/settings', [AdminController::class, 'saveSettings']);
        Route::post('/whatsapp/send', [AdminController::class, 'sendWhatsApp']);
        Route::post('/whatsapp/test', [AdminController::class, 'testWhatsApp']);
        Route::get('/integrations', [AdminController::class, 'integrations']);
        Route::post('/email/test', [AdminController::class, 'testEmail']);
        Route::post('/messages/retry', [AdminController::class, 'retryMessages']);

        Route::get('/r/{resource}', [AdminResourceController::class, 'index']);
        Route::post('/r/{resource}', [AdminResourceController::class, 'store']);
        Route::get('/r/{resource}/{id}', [AdminResourceController::class, 'show'])->whereNumber('id');
        Route::match(['put', 'post'], '/r/{resource}/{id}', [AdminResourceController::class, 'update'])->whereNumber('id');
        Route::delete('/r/{resource}/{id}', [AdminResourceController::class, 'destroy'])->whereNumber('id');
    });
});
