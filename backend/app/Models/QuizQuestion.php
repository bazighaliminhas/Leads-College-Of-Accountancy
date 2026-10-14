<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizQuestion extends Model
{
    protected $guarded = ['id'];
    protected $casts = ['options' => 'array', 'correct_index' => 'integer', 'marks' => 'integer'];
    public function quiz() { return $this->belongsTo(Quiz::class); }
}
