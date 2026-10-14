<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    protected $guarded = ['id'];
    protected $casts = ['is_published' => 'boolean', 'ai_generated' => 'boolean'];

    public function course() { return $this->belongsTo(Course::class); }
    public function lesson() { return $this->belongsTo(Lesson::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function questions() { return $this->hasMany(QuizQuestion::class)->orderBy('sort_order')->orderBy('id'); }
    public function attempts() { return $this->hasMany(QuizAttempt::class); }
}
