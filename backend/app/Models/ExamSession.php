<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamSession extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["starts_on" => "date:Y-m-d"];
    public function program() { return $this->belongsTo(Program::class); }
}
