<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Level extends Model
{
    protected $guarded = ['id'];
    public function program() { return $this->belongsTo(Program::class); }
    public function courses() { return $this->hasMany(Course::class)->orderBy("sort_order"); }
}
