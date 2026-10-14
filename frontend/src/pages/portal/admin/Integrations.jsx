import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Mail, Sparkles, Video, Server, CheckCircle2, AlertTriangle, Send, RefreshCw, Copy } from "lucide-react";
import { api, errMsg } from "../../../lib/api";
import { useApp } from "../../../context/AppContext";
import { Spinner, Btn } from "../../../components/ui";
import { PageHead } from "../PortalLayout";
import { GoogleConnect } from "../live/Live";

function Status({ ok, warn }) {
  return ok ? <span className="badge badge-ok"><CheckCircle2 size={12} /> Connected</span> : <span className="badge badge-warn"><AlertTriangle size={12} /> {warn || "Not set up"}</span>;
}
function Env({ children }) { return <pre className="env">{children}</pre>; }

/** Admin → Integrations: WhatsApp (Kapso), email (SMTP), AI, Google Meet and the message queue — status, tests and setup steps. */
export default function Integrations() {
  const { toast } = useApp();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const load = () => api.get("/admin/integrations").then((r) => setD(r.data));
  useEffect(() => { load(); }, []);
  if (!d) return <Spinner />;
  const run = async (key, fn) => { setBusy(key); try { const r = await fn(); toast(r.data.message || "Done"); load(); } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(""); } };
  const count = (ch, st) => d.messages.find((m) => m.channel === ch && m.status === st)?.total || 0;

  return (
    <>
      <PageHead title="Integrations" sub="Everything the website uses to reach students and teachers. Keys live in backend/.env — never in the browser." actions={<Link to="/admin/message-log" className="btn btn-outline btn-sm">Message log</Link>} />
      <div className="integ-grid">
        <section className="card integ">
          <div className="integ-head"><span className="integ-icon wa"><MessageCircle size={22} /></span><div><h3>WhatsApp (Kapso)</h3><Status ok={d.whatsapp.configured && d.whatsapp.enabled} warn={!d.whatsapp.enabled ? "Disabled" : undefined} /></div></div>
          <p className="muted small">Admissions, payment, access, lecture, quiz and live-class messages to students, plus admin alerts to <strong>{d.whatsapp.admin_phone || "—"}</strong>.</p>
          <div className="integ-stats"><span><strong>{count("whatsapp", "sent")}</strong> sent</span><span><strong>{count("whatsapp", "failed")}</strong> failed</span><span className="muted">last 30 days</span></div>
          <div className="row-gap"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={d.whatsapp.admin_phone || "+92…"} aria-label="Test number" />
            <Btn loading={busy === "wa"} className="btn btn-outline btn-sm" onClick={() => run("wa", () => api.post("/admin/whatsapp/test", { phone: phone || undefined }))}><Send size={14} /> Send test</Btn></div>
          <details><summary>Setup & tips</summary>
            <Env>{`WHATSAPP_ENABLED=true\nKAPSO_API_KEY=…\nKAPSO_PHONE_NUMBER_ID=…\n# optional, for students who haven't messaged you in 24h:\nKAPSO_TEMPLATE_NAME=lca_update\nKAPSO_TEMPLATE_LANG=en`}</Env>
            <p className="small">WhatsApp only delivers free-form messages to people who messaged your number in the last 24 hours. For everyone else, create an approved <b>Utility</b> template in Kapso with body <code>{"Leads College update: {{1}}"}</code> and set <code>KAPSO_TEMPLATE_NAME</code> — the site falls back to it automatically.</p>
            {count("whatsapp", "failed") > 0 && <Btn loading={busy === "retry"} className="btn btn-ghost btn-sm" onClick={() => run("retry", () => api.post("/admin/messages/retry"))}><RefreshCw size={14} /> Retry failed WhatsApp messages</Btn>}
          </details>
        </section>

        <section className="card integ">
          <div className="integ-head"><span className="integ-icon mail"><Mail size={22} /></span><div><h3>Email (SMTP)</h3><Status ok={d.email.configured} warn={d.email.mailer === "log" ? "Log only" : undefined} /></div></div>
          <p className="muted small">Branded HTML emails from <strong>{d.email.from}</strong> via {d.email.host || d.email.mailer}. Admin copies go to <strong>{d.email.admin_email || "—"}</strong>.</p>
          <div className="integ-stats"><span><strong>{count("email", "sent")}</strong> sent</span><span><strong>{count("email", "failed")}</strong> failed</span><span className="muted">last 30 days</span></div>
          <div className="row-gap"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={d.email.admin_email || "you@example.com"} aria-label="Test email" />
            <Btn loading={busy === "mail"} className="btn btn-outline btn-sm" onClick={() => run("mail", () => api.post("/admin/email/test", { email: email || undefined }))}><Send size={14} /> Send test</Btn></div>
          <details><summary>Setup (Gmail)</summary>
            <Env>{`MAIL_MAILER=smtp\nMAIL_HOST=smtp.gmail.com\nMAIL_PORT=587\nMAIL_ENCRYPTION=tls\nMAIL_USERNAME=you@gmail.com\nMAIL_PASSWORD=<16-letter app password>\nMAIL_FROM_ADDRESS=you@gmail.com\nMAIL_FROM_NAME="Leads College of Accountancy"`}</Env>
            <p className="small">Gmail needs an <b>App password</b> (Google Account → Security → 2-Step Verification → App passwords). Gmail allows about 500 emails a day; for more, use a domain mailbox or a service like Brevo / Mailgun with the same settings.</p>
          </details>
        </section>

        <section className="card integ">
          <div className="integ-head"><span className="integ-icon ai"><Sparkles size={22} /></span><div><h3>AI assistant</h3><Status ok={d.ai.configured} /></div></div>
          <p className="muted small">Curriculum builder, study material, quizzes / MCQs / short questions and marking of short answers. Provider: <strong>{d.ai.provider}</strong>.</p>
          <details open={!d.ai.configured}><summary>Setup</summary>
            <Env>{`# Google Gemini (has a free tier) — https://aistudio.google.com/apikey\nAI_PROVIDER=gemini\nAI_API_KEY=…\n\n# or OpenAI:      AI_PROVIDER=openai\n# or Claude:      AI_PROVIDER=anthropic\n# optional:       AI_MODEL=…`}</Env>
            <p className="small">AI output is always saved as a draft — teachers review it before students see anything.</p>
          </details>
        </section>

        <section className="card integ">
          <div className="integ-head"><span className="integ-icon meet"><Video size={22} /></span><div><h3>Google Meet & Calendar</h3><Status ok={d.google.configured && (d.google.college || d.google.teachers.length)} warn={d.google.configured ? "Connect an account" : undefined} /></div></div>
          <p className="muted small">Automatic Meet links, Calendar invites to enrolled students and phone reminders. {d.google.college ? <>College account: <strong>{d.google.college.email}</strong>.</> : ""} {d.google.teachers.length ? `${d.google.teachers.length} teacher(s) connected their own Google.` : ""}</p>
          {d.google.configured && <GoogleConnect compact />}
          <details open={!d.google.configured}><summary>Setup (one time, ~10 minutes)</summary>
            <ol className="small steps-list">
              <li>Open <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a> → create a project.</li>
              <li>APIs & Services → Library → enable <b>Google Calendar API</b>.</li>
              <li>OAuth consent screen → External → add scope <code>…/auth/calendar.events</code> → publish the app.</li>
              <li>Credentials → Create credentials → OAuth client ID → <b>Web application</b>. Authorised redirect URI:
                <span className="copy-line"><code>{d.google.redirect_uri}</code><button className="icon-btn" onClick={() => { navigator.clipboard?.writeText(d.google.redirect_uri); toast("Copied"); }} aria-label="Copy"><Copy size={14} /></button></span></li>
              <li>Put the client ID and secret in <code>.env</code>, then press “Connect college account” here (or each teacher connects their own Google under Live classes).</li>
            </ol>
            <Env>{`GOOGLE_CLIENT_ID=…apps.googleusercontent.com\nGOOGLE_CLIENT_SECRET=…`}</Env>
            <p className="small">Until then, teachers paste a link from <a href="https://meet.new" target="_blank" rel="noreferrer">meet.new</a> — students still get it on WhatsApp, email (with calendar invite) and their dashboard.</p>
          </details>
        </section>

        <section className="card integ wide">
          <div className="integ-head"><span className="integ-icon q"><Server size={22} /></span><div><h3>Message queue & scheduler</h3><Status ok={d.queue.pending < 20} warn={`${d.queue.pending} waiting`} /></div></div>
          <p className="muted small">WhatsApp and email are sent in the background so pages stay fast. <strong>{d.queue.pending}</strong> waiting · <strong>{d.queue.failed}</strong> failed jobs · queue: {d.queue.connection}. Site address used in links: <code>{d.app_url}</code>{/127\.0\.0\.1|localhost/.test(d.app_url) ? <span className="badge badge-warn">set APP_URL to your domain before going live</span> : null}</p>
          <details><summary>Keep it running</summary>
            <p className="small"><b>Server (cPanel / VPS):</b> add one cron job:</p><Env>{`* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1`}</Env>
            <p className="small"><b>On your PC:</b> keep a second terminal open with <code>php artisan schedule:work</code> (sends messages and live-class reminders).</p>
          </details>
        </section>
      </div>
    </>
  );
}
