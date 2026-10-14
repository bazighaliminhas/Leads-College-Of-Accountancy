<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    protected $guarded = ['id'];
    protected $casts = ['answers' => 'array', 'results' => 'array', 'passed' => 'boolean', 'score' => 'float', 'total' => 'float', 'started_at' => 'datetime', 'submitted_at' => 'datetime'];
    public function quiz() { return $this->belongsTo(Quiz::class); }
    public function user() { return $this->belongsTo(User::class); }
}
