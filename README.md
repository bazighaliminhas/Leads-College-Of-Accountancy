# Leads College of Accountancy — Online Admissions + LMS

ACCA & CA (ICAP) admissions website (flow modelled on admissions.mirchawala.com) with Student, Teacher and Admin dashboards.

**Stack:** Laravel 11 API (PHP 8.2+) · React 18 + Vite · SQLite (default) or MySQL · Sanctum token auth.

## Quick start (Windows / Mac / Linux)
```bash
# 1) Backend
cd backend
composer install            # downloads Laravel packages into vendor/
cp .env.example .env        # (Windows: copy .env.example .env)  — skip if .env already exists
php artisan key:generate
php artisan migrate:fresh --seed   # creates all tables + ACCA/CA courses, fees, demo users
php artisan storage:link
php artisan serve           # http://127.0.0.1:8000  (full website + API)

# 2) Frontend (only if you change React code)
cd ../frontend
npm install
npm run dev     # live dev server on http://localhost:5173 (talks to :8000)
npm run build   # rebuilds into backend/public/app — Laravel then serves the new version
```
A pre-built frontend and a seeded `database/database.sqlite` are already included, so `php artisan serve` alone is enough to see the site.

For **MySQL**: create a database, set the `DB_*` values in `backend/.env`, then run `php artisan migrate:fresh --seed`.

## Logins (change passwords after first login)
| Role | Username | Password |
|---|---|---|
| Admin | `admin` (admin@leads.edu.pk) | `Admin@123` |
| Teacher (ACCA) | `acca.teacher` | `Teacher@123` |
| Teacher (CA) | `ca.teacher` | `Teacher@123` |
| Student | `student` | `Student@123` |

All logins use one page: `/login` (email or username).

## Admission flow
1. Student picks **ACCA / CA → level (sub-category) → paper**, selects the exam session and adds to cart (cart saved in DB, even for guests).
2. Checkout → register / log in → personal details + registration no. → accepts terms (scroll-to-agree).
3. Order is saved → student pays from **any bank or app** and uploads **screenshot + transaction ID, amount, date, registration no.**
4. Enrolments are created as **"Awaiting admin permission"** — course is locked.
5. Admin → *Orders & payment review* → views screenshot → **Verify payment & grant access** (or verify only / reject with remarks).
   Admin can also grant / suspend / cancel access any time in *Course access*, or enrol a student manually.
6. Student gets a notification; the course opens in *My courses* with videos, notes and progress tracking.

No discounts are applied. Total = paper fees + one-time college registration fee per programme (ACCA PKR 10,000, CA PKR 15,000) for new students.

## Roles
- **Admin:** full CRUD on everything — students, teachers, admins (usernames/passwords), programmes, levels, courses, lessons/videos, teacher assignments, exam sessions, orders, payments, course access, carts, announcements, notifications, contact messages, inquiries, subscribers, bank/wallet accounts, website settings (contact info, terms, fee notes) and the full activity log. CSV export on every table.
- **Teacher:** sees courses assigned by admin, uploads video lectures (file or YouTube/Vimeo link), notes (PDF/Office), text lessons; edits course content; adds new courses (pending admin approval); sees students with access and their progress; posts course announcements.
- **Student:** dashboard, my courses (locked until admin grants access), course player, orders & payment uploads (re-upload if rejected), announcements, notifications, profile & password.

## What is stored in the database
Users & profiles, programmes, levels, courses, teacher assignments, exam sessions, lessons & uploaded files, carts & cart items (guests too), orders & order items (with snapshot of the student's details, terms acceptance time, IP, browser), payments (method, bank/app, sender, transaction ID, amount, date, screenshot), enrolments/access (who granted, when, expiry), lesson progress, announcements, notifications, contact messages, inquiries, newsletter subscribers, payment accounts, settings and **activity_logs** — every API request, login (incl. failed), page view, cart action, upload and admin change.

Payment screenshots and lecture videos are stored privately (`storage/app`) and served only through expiring signed links.

## Before going live
- Update **Admin → Payment accounts** (placeholder bank / wallet details) and **Admin → Website settings** (WhatsApp, social links).
- Replace demo teacher names/photos and change all demo passwords.
- Set `APP_DEBUG=false`, `APP_URL` to your domain, use HTTPS.
- For large video uploads raise PHP limits: `upload_max_filesize=2G`, `post_max_size=2G`, `max_execution_time=600`.
