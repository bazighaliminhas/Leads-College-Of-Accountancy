<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Program extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["overview" => "array", "registration_fee" => "float", "registration_fee_scholarship" => "float"];
    public function levels() { return $this->hasMany(Level::class)->orderBy("sort_order"); }
    public function courses() { return $this->hasMany(Course::class); }
    public function examSessions() { return $this->hasMany(ExamSession::class)->orderBy("sort_order"); }
}
