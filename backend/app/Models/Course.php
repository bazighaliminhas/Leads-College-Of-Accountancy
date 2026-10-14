<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["learn" => "array", "structure" => "array", "fee" => "float", "scholarship_fee" => "float", "is_purchasable" => "boolean", "is_featured" => "boolean"];
    protected $appends = ["image_url"];
    public function getImageUrlAttribute() { return $this->image ? asset("storage/".$this->image) : null; }
    public function program() { return $this->belongsTo(Program::class); }
    public function level() { return $this->belongsTo(Level::class); }
    public function teachers() { return $this->belongsToMany(User::class, "course_teacher", "course_id", "teacher_id")->withPivot("can_upload", "assigned_by")->withTimestamps(); }
    public function lessons() { return $this->hasMany(Lesson::class)->orderBy("sort_order")->orderBy("id"); }
    public function enrollments() { return $this->hasMany(Enrollment::class); }
    public function liveClasses() { return $this->hasMany(LiveClass::class); }
    public function quizzes() { return $this->hasMany(Quiz::class); }
    public function creator() { return $this->belongsTo(User::class, "created_by"); }
    public function canBeBought(): bool { return $this->status === "published" && $this->is_purchasable && $this->fee !== null; }
}
