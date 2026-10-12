<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["subtotal" => "float", "registration_fee" => "float", "total" => "float", "dob" => "date:Y-m-d", "agreed_terms_at" => "datetime", "reviewed_at" => "datetime"];
    public function user() { return $this->belongsTo(User::class); }
    public function items() { return $this->hasMany(OrderItem::class); }
    public function payments() { return $this->hasMany(Payment::class)->latest(); }
    public function enrollments() { return $this->hasMany(Enrollment::class); }
    public function reviewer() { return $this->belongsTo(User::class, "reviewed_by"); }
}
