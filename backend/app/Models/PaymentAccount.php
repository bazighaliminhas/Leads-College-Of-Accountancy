<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentAccount extends Model
{
    protected $guarded = ['id'];
    protected $casts = ["is_active" => "boolean"];
}
