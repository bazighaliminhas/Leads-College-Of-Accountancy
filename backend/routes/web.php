<?php

use App\Http\Controllers\Api\FileController;
use Illuminate\Support\Facades\Route;

// Private files via signed, expiring links
Route::get('/files/lessons/{lesson}/{kind}', [FileController::class, 'lesson'])->whereIn('kind', ['video', 'attachment'])->middleware('signed')->name('files.lesson');
Route::get('/files/payments/{payment}', [FileController::class, 'payment'])->middleware('signed')->name('files.payment');

// React single-page app (built into public/app by `npm run build` in /frontend)
Route::get('/{any?}', function () {
    $index = public_path('app/index.html');
    if (!file_exists($index)) {
        return response('Frontend not built yet. Run: cd frontend && npm install && npm run build', 200);
    }
    return response()->file($index, ['Cache-Control' => 'no-cache']);
})->where('any', '^(?!api|storage|files|up).*$');
