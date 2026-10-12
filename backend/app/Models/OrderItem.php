<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["price" => "float"];
    public function order() { return $this->belongsTo(Order::class); }
    public function course() { return $this->belongsTo(Course::class); }
}
