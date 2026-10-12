<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $guarded = ['id'];
    protected $hidden = ['password', 'remember_token'];
    protected $appends = ['avatar_url'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'dob' => 'date:Y-m-d',
            'password' => 'hashed',
        ];
    }

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar ? asset('storage/'.$this->avatar) : null;
    }

    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function isTeacher(): bool { return $this->role === 'teacher'; }
    public function isStudent(): bool { return $this->role === 'student'; }

    public function teachingCourses() { return $this->belongsToMany(Course::class, 'course_teacher', 'teacher_id', 'course_id')->withPivot('can_upload', 'assigned_by')->withTimestamps(); }
    public function enrollments() { return $this->hasMany(Enrollment::class); }
    public function orders() { return $this->hasMany(Order::class); }
    public function payments() { return $this->hasMany(Payment::class); }
    public function userNotifications() { return $this->hasMany(UserNotification::class); }
}
