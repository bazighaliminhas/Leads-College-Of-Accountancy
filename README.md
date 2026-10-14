# Leads College of Accountancy — Admissions + LMS (v3)

ACCA & CA (ICAP) admissions website with Student, Teacher and Admin portals, video lectures, AI study material & quizzes,
live classes on Google Meet, and WhatsApp + email notifications.

**Stack:** Laravel 11 API (PHP 8.2+) · React 18 + Vite · MySQL or SQLite · Sanctum tokens · database queue + scheduler.

---

## 1. Run it on your PC (Windows / Mac / Linux)

```bash
cd backend
composer install                 # only if vendor/ is missing
php artisan migrate              # adds the new v3 tables (live classes, quizzes, AI, message log)
php artisan storage:link
php artisan serve                # http://127.0.0.1:8000  — website + API
```

In a **second terminal** (sends WhatsApp + email in the background and live-class reminders):

```bash
cd backend
php artisan schedule:work
```

Changing React code? `cd frontend && npm install && npm run dev` (dev server on :5173), then `npm run build`
(builds into `backend/public/app`, which Laravel serves).

Fresh database with demo data: `php artisan migrate:fresh --seed`.

### Logins (change after first login)
| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@123` |
| Teacher (ACCA) | `acca.teacher` | `Teacher@123` |
| Teacher (CA) | `ca.teacher` | `Teacher@123` |
| Student | `student` | `Student@123` |

---

## 2. How it works

### Admissions (unchanged flow, now with email too)
Student picks papers → cart → register/login → details + terms → order → pays from any bank/app and uploads the
screenshot + transaction ID → **admin verifies and grants access** → student gets **WhatsApp + email + dashboard**
confirmation → courses open.

### Which courses does a teacher teach?
**Admin → Teachers → Add new**: fill in the login details and **tick the courses this teacher teaches** (chips grouped
by ACCA / CA). Tick *“Send login details”* to send the username, password and course list to the teacher on WhatsApp
and email. The Teachers table shows a **Teaches** column; you can change it any time (Edit, or the *Courses* button).
A teacher sees and manages **only** those courses — lectures, quizzes, live classes and students.

### Lectures (teacher or admin)
*My courses → open a course → Lectures*:
- **Add lecture** — “Lecture 1 — …”, chapter, **upload a video file** (stored privately, streamed only to students with
  access) **or paste a YouTube / Vimeo / Google Drive link**, notes file, and **study material** (Markdown).
- **Generate with AI** writes the study material (overview, key concepts, worked example, common mistakes, exam tips,
  glossary, recap). The teacher reviews and edits before saving.
- **AI curriculum** — AI drafts the whole lecture plan for the paper (Lecture 1, 2, 3 … grouped by syllabus chapter, with
  objectives). The teacher edits it and adds them as **draft** lectures, then fills in videos and publishes one by one.
- Publishing a lecture notifies the course's students (dashboard + WhatsApp + email).

### Quizzes, MCQs and short questions
*Course → Quizzes & MCQs* (or the **Quiz** button on a lecture):
- Write MCQs (choose the correct option) and short questions (with model answer), or **Generate questions with AI**
  from the lecture's study material — MCQs, short, or mixed; easy → exam standard.
- Students take quizzes under each lecture: optional timer and attempt limit, instant marking, explanations, and
  **AI marking of short answers** (when AI is set up; otherwise students compare with the model answer).
- Teachers see results per student; admins see everything under *Quiz results*.

### Live classes on Google Meet
*Live classes → Schedule live class*: course, title, date & time, duration →
1. **Generate Google Meet link** (creates the Google Calendar event + Meet link automatically), or paste a link from
   meet.new;
2. check the link;
3. **Publish to students** → every student with access gets the link on **WhatsApp, email (with calendar invite .ics)
   and their dashboard**. With Google connected, they're also added to the **Google Calendar event**, so Google sends
   the invite and **phone reminders** (30 & 10 min popups, email 2 h before).
- About **30 minutes before** the class the link is sent **again** to students and the teacher (WhatsApp + email + dashboard).
- Students: *Live classes* page and dashboard card with **Join**, **Add to Google Calendar**, **Apple / Outlook**.
- After class: **Add recording** (Drive / YouTube link) → optionally published as a lecture.
- Students who get access later are added to upcoming Calendar events automatically.

### Admin has full access
Admin can open any course (*Courses & content → Content*) and do everything a teacher can, plus CRUD tables for
lectures, live classes, quizzes, quiz results, the **WhatsApp & email log**, users, orders, payments, etc.
*Admin → Integrations* shows the status of WhatsApp, email, AI, Google and the queue, with **Send test** buttons.

---

## 3. Integrations (`backend/.env`)

| Service | Keys | Notes |
|---|---|---|
| WhatsApp (Kapso) | `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `ADMIN_WHATSAPP_NUMBER` | Uses Kapso's Meta-compatible API. Free-form messages only reach people who messaged your number in the last 24 h — create an approved **Utility template** with body `Leads College update: {{1}}` and set `KAPSO_TEMPLATE_NAME` so everyone else still gets messages. |
| Email | `MAIL_*`, `ADMIN_EMAIL` | Gmail SMTP with an **App Password**. Gmail sends ~500 emails/day; for more use a domain mailbox or Brevo/Mailgun. |
| AI | `AI_PROVIDER` (`gemini` / `openai` / `anthropic`), `AI_API_KEY`, optional `AI_MODEL` | Gemini has a free tier: https://aistudio.google.com/apikey |
| Google Meet | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → enable **Google Calendar API** → OAuth consent screen (scope `calendar.events`, publish) → OAuth client **Web application** with redirect URI `APP_URL/google/callback`. Then *Admin → Integrations → Connect college account*, or each teacher connects their own Google under *Live classes* (they become the Meet host). |

After editing `.env`: `php artisan config:clear`.

---

## 4. Before going live
- `APP_URL=https://your-domain` (used in every WhatsApp/email link and the Google redirect URI), `APP_DEBUG=false`, HTTPS.
- Cron (one line runs the queue + reminders): `* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1`
- `php artisan migrate --force`, `php artisan storage:link`, `php artisan config:cache`.
- Update payment accounts and website settings; change all demo passwords.
- Large video uploads: `upload_max_filesize=2G`, `post_max_size=2G`, `max_execution_time=600`.
- `.env` holds live keys — it is git-ignored; never commit or share it. Rotate any key that has been shared.
