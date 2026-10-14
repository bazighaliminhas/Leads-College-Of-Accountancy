<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Course;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/** Teachers may only manage the courses the admin assigned to them (or that they created). Admins manage everything. */
trait ManagesCourses
{
    protected function myCourseIds(User $u): Collection
    {
        if ($u->role === 'admin') return Course::pluck('id');
        return $u->teachingCourses()->pluck('courses.id')->merge(Course::where('created_by', $u->id)->pluck('id'))->unique()->values();
    }

    protected function ownCourse(Request $request, Course|int|null $course): Course
    {
        $course = $course instanceof Course ? $course : Course::findOrFail($course);
        if ($request->user()->role !== 'admin') {
            abort_unless($this->myCourseIds($request->user())->contains($course->id), 403, 'This course is not assigned to you. Ask the admin to assign it.');
        }
        return $course;
    }
}
