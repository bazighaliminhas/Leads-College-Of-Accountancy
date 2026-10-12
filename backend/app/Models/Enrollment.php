<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Enrollment extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["granted_at" => "datetime", "access_expires_on" => "date:Y-m-d"];
    public function user() { return $this->belongsTo(User::class); }
    public function course() { return $this->belongsTo(Course::class); }
    public function order() { return $this->belongsTo(Order::class); }
    public function examSession() { return $this->belongsTo(ExamSession::class); }
    public function granter() { return $this->belongsTo(User::class, "granted_by"); }
    public function hasAccess(): bool { return $this->status === "active" && (!$this->access_expires_on || $this->access_expires_on->endOfDay()->isFuture()); }
}
