<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\User;
use App\Support\Activity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:80',
            'last_name' => 'required|string|max:80',
            'username' => 'nullable|string|max:40|alpha_dash|unique:users,username',
            'email' => 'required|email|max:150|unique:users,email',
            'phone' => 'required|string|max:30',
            'dob' => 'nullable|date|before:today',
            'city' => 'nullable|string|max:80',
            'country' => 'nullable|string|max:80',
            'qualification' => 'nullable|string|max:150',
            'password' => 'required|string|min:8|confirmed',
        ]);
        $data['name'] = trim($data['first_name'].' '.$data['last_name']);
        $data['username'] = $data['username'] ?? $this->makeUsername($data['first_name'].$data['last_name']);
        $data['role'] = 'student';
        $data['status'] = 'active';
        $user = User::create($data);
        Activity::log('auth.register', "Student registered: {$user->email}", $user, [], $request, $user->id);
        return $this->issue($request, $user, 'auth.login');
    }

    public function login(Request $request)
    {
        $request->validate(['login' => 'required|string', 'password' => 'required|string']);
        $login = trim($request->login);
        $user = User::where('email', $login)->orWhere('username', $login)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            Activity::log('auth.login_failed', "Failed login for: {$login}", null, ['login' => $login], $request);
            throw ValidationException::withMessages(['login' => 'These credentials do not match our records.']);
        }
        if ($user->status !== 'active') {
            Activity::log('auth.login_blocked', "Blocked user tried to log in: {$login}", $user, [], $request, $user->id);
            throw ValidationException::withMessages(['login' => 'Your account is blocked. Please contact the college.']);
        }
        if ($request->filled('role') && $request->role !== $user->role) {
            throw ValidationException::withMessages(['login' => 'This account is not a '.$request->role.' account.']);
        }
        return $this->issue($request, $user, 'auth.login');
    }

    protected function issue(Request $request, User $user, string $action)
    {
        $user->forceFill(['last_login_at' => now(), 'last_login_ip' => $request->ip()])->save();
        $token = $user->createToken('web-'.Str::limit((string) $request->userAgent(), 40, ''))->plainTextToken;
        $this->claimCart($request, $user);
        Activity::log($action, "{$user->role} logged in: {$user->email}", $user, [], $request, $user->id);
        return response()->json(['token' => $token, 'user' => $user]);
    }

    /** Attach the guest cart (saved in DB by token) to the user after login. */
    protected function claimCart(Request $request, User $user): void
    {
        $token = $request->header('X-Cart-Token');
        if (!$token) return;
        $guest = Cart::where('token', $token)->where('status', 'active')->first();
        if (!$guest) return;
        $existing = Cart::where('user_id', $user->id)->where('status', 'active')->where('id', '!=', $guest->id)->first();
        if ($existing) {
            foreach ($guest->items as $item) {
                if (!$existing->items()->where('course_id', $item->course_id)->exists()) {
                    $item->update(['cart_id' => $existing->id]);
                }
            }
            $guest->delete();
            $existing->update(['token' => $token]);
        } else {
            $guest->update(['user_id' => $user->id]);
        }
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user(), 'unread' => $request->user()->userNotifications()->whereNull('read_at')->count()]);
    }

    public function logout(Request $request)
    {
        Activity::log('auth.logout', "Logged out: {$request->user()->email}", $request->user());
        $request->user()->currentAccessToken()?->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'first_name' => 'required|string|max:80',
            'last_name' => 'nullable|string|max:80',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'phone' => 'nullable|string|max:30',
            'father_name' => 'nullable|string|max:120',
            'dob' => 'nullable|date',
            'gender' => 'nullable|string|max:20',
            'cnic' => 'nullable|string|max:20',
            'city' => 'nullable|string|max:80',
            'country' => 'nullable|string|max:80',
            'address' => 'nullable|string|max:500',
            'qualification' => 'nullable|string|max:150',
            'registration_no' => 'nullable|string|max:50',
            'designation' => 'nullable|string|max:120',
            'specialization' => 'nullable|string|max:200',
            'bio' => 'nullable|string|max:3000',
            'avatar' => 'nullable|image|max:4096',
        ]);
        if ($request->hasFile('avatar')) {
            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        } else {
            unset($data['avatar']);
        }
        $data['name'] = trim(($data['first_name'] ?? '').' '.($data['last_name'] ?? ''));
        $user->update($data);
        Activity::log('profile.update', 'Profile updated', $user, $data);
        return response()->json(['user' => $user->fresh()]);
    }

    public function changePassword(Request $request)
    {
        $request->validate(['current_password' => 'required', 'password' => 'required|min:8|confirmed']);
        $user = $request->user();
        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Current password is incorrect.']);
        }
        $user->update(['password' => $request->password]);
        Activity::log('profile.password', 'Password changed', $user);
        return response()->json(['message' => 'Password updated']);
    }

    protected function makeUsername(string $base): string
    {
        $base = Str::lower(Str::slug($base, '')) ?: 'student';
        $u = $base; $i = 1;
        while (User::where('username', $u)->exists()) { $u = $base.(++$i); }
        return $u;
    }
}
