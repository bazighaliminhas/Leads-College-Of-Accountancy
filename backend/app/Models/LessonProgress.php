<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonProgress extends Model
{
    protected $guarded = ['id'];
    protected $table = "lesson_progress";
    protected $casts = ["completed_at" => "datetime"];
    public function lesson() { return $this->belongsTo(Lesson::class); }
    public function user() { return $this->belongsTo(User::class); }
}
