<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserNotification extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["read_at" => "datetime"];
    public function user() { return $this->belongsTo(User::class); }
}
