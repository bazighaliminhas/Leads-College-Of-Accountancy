<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** OAuth connection to a Google account (Calendar + Meet). user_id = null is the college-wide account. */
class GoogleAccount extends Model
{
    protected $guarded = ['id'];
    protected $hidden = ['access_token', 'refresh_token'];
    protected $casts = ['access_token' => 'encrypted', 'refresh_token' => 'encrypted', 'expires_at' => 'datetime'];
    public function user() { return $this->belongsTo(User::class); }
}
