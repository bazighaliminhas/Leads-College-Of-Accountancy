<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["amount" => "float", "paid_on" => "date:Y-m-d", "verified_at" => "datetime"];
    protected $appends = ["screenshot_url"];
    public function getScreenshotUrlAttribute() { return $this->screenshot_path ? \Illuminate\Support\Facades\URL::temporarySignedRoute("files.payment", now()->addHours(6), ["payment" => $this->id]) : null; }
    public function order() { return $this->belongsTo(Order::class); }
    public function user() { return $this->belongsTo(User::class); }
    public function verifier() { return $this->belongsTo(User::class, "verified_by"); }
}
