<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["is_published" => "boolean"];
    public function author() { return $this->belongsTo(User::class, "user_id"); }
    public function course() { return $this->belongsTo(Course::class); }
}
