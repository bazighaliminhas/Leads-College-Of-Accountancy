<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CartItem extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["price" => "float"];
    public function cart() { return $this->belongsTo(Cart::class); }
    public function course() { return $this->belongsTo(Course::class); }
    public function examSession() { return $this->belongsTo(ExamSession::class); }
}
