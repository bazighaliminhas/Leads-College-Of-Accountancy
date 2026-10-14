import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Video, CalendarPlus, Plus, Copy, ExternalLink, Pencil, Trash2, Send, XCircle, CheckCircle2, RefreshCw, Download, Radio, Clock, Users, Link2, Sparkles, CalendarDays, PlayCircle } from "lucide-react";
import { api, errMsg, fieldErrors } from "../../../lib/api";
import { useApp } from "../../../context/AppContext";
import { dayTime, time, longDate, fromNow, toLocalInput } from "../../../lib/format";
import { Badge, Spinner, Empty, Modal, Field, Btn } from "../../../components/ui";
import { PageHead } from "../PortalLayout";
import { useAdminOptions } from "../admin/options";

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
);

function copy(text, toast) {
  try { navigator.clipboard.writeText(text); toast("Link copied"); } catch { toast("Copy failed — select the link manually", "bad"); }
}

/* ============================== Google connection card ============================== */
export function GoogleConnect({ compact = false }) {
  const { user, toast } = useApp();
  const [g, setG] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/teacher/google").then((r) => setG(r.data)).catch(() => setG({ configured: false }));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("google");
    if (q === "connected") toast("Google account connected — Meet links will now be created automatically");
  }, []); // eslint-disable-line
  if (!g) return null;
  const connect = async (scope = "me") => {
    setBusy(true);
    try { const r = await api.post("/teacher/google/connect", { scope, return: window.location.pathname }); window.location.href = r.data.url; }
    catch (e) { toast(errMsg(e), "bad"); setBusy(false); }
  };
  const disconnect = async () => { if (!confirm("Disconnect your Google account?")) return; await api.delete("/teacher/google/connect", { data: { scope: "me" } }); load(); };
  const account = g.mine || g.college;
  return (
    <div className={`gconnect ${account ? "on" : ""} ${compact ? "compact" : ""}`}>
      <span className="gconnect-icon"><GoogleMark /></span>
      <div className="gconnect-text">
        {!g.configured ? (
          <><strong>Automatic Meet links are not switched on yet</strong><span>You can still schedule classes — create a link at <a href="https://meet.new" target="_blank" rel="noreferrer">meet.new</a> and paste it. The admin can enable automatic links in Integrations.</span></>
        ) : account ? (
          <><strong>Google Meet connected</strong><span>New classes get a Meet link and Google Calendar invite automatically from <b>{account.email || "Google"}</b>{!g.mine && " (college account)"}.</span></>
        ) : (
          <><strong>Connect Google Calendar</strong><span>Connect once and every class you schedule gets its own Google Meet link, and students receive the Calendar invite with phone reminders.</span></>
        )}
      </div>
      {g.configured && (g.mine
        ? <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
        : <Btn loading={busy} className="btn btn-outline btn-sm" onClick={() => connect("me")}><GoogleMark /> {account ? "Use my own Google" : "Connect Google"}</Btn>)}
      {user?.role === "admin" && g.configured && !g.college && <Btn loading={busy} className="btn btn-navy btn-sm" onClick={() => connect("college")}>Connect college account</Btn>}
    </div>
  );
}

/* ============================== Teacher / admin manager ============================== */
export function LiveManager({ admin = false, courseId = null, embedded = false }) {
  const { toast } = useApp();
  const [tab, setTab] = useState("upcoming");
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [done, setDone] = useState(null);
  const loc = useLocation();
  const load = () => {
    setList(null);
    api.get("/teacher/live", { params: { when: tab, course_id: courseId || undefined } })
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((e) => {
        setList([]);
        toast(errMsg(e, "Unable to load live classes"), "bad");
      });
  };
  useEffect(() => { load(); }, [tab, courseId]); // eslint-disable-line
  useEffect(() => { if (new URLSearchParams(loc.search).get("new") === "1") setEdit({}); }, []); // eslint-disable-line

  const act = async (lc, action, confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      const r = action === "delete" ? await api.delete(`/teacher/live/${lc.id}`) : await api.post(`/teacher/live/${lc.id}/${action}`);
      toast(r.data?.message || { publish: "Published to students", cancel: "Class cancelled — students informed", "generate-link": "New Meet link created", delete: "Deleted" }[action] || "Done");
      load();
    } catch (e) { toast(errMsg(e), "bad"); }
  };

  const groups = useMemo(() => {
    const g = {};
    (list || []).forEach((lc) => { const k = longDate(lc.starts_at); (g[k] ||= []).push(lc); });
    return Object.entries(g);
  }, [list]);

  const body = (
    <>
      {!embedded && <GoogleConnect />}
      <div className="tabs">
        <button className={tab === "upcoming" ? "on" : ""} onClick={() => setTab("upcoming")}>Upcoming & drafts</button>
        <button className={tab === "past" ? "on" : ""} onClick={() => setTab("past")}>Past & cancelled</button>
        {embedded && <button className="tabs-action btn btn-primary btn-sm" onClick={() => setEdit({ course_id: courseId })}><Plus size={15} /> Schedule live class</button>}
      </div>
      {!list ? <Spinner /> : !list.length ? (
        <Empty icon={Video} title={tab === "upcoming" ? "No upcoming live classes" : "No past classes yet"} text={tab === "upcoming" ? "Schedule a class — pick a date and time, generate the Google Meet link and publish it to your students." : null}
          action={tab === "upcoming" && <button className="btn btn-primary" onClick={() => setEdit({ course_id: courseId || "" })}><Plus size={16} /> Schedule live class</button>} />
      ) : groups.map(([day, items]) => (
        <section key={day} className="live-day">
          <h4 className="live-day-title"><CalendarDays size={16} /> {day}</h4>
          {items.map((lc) => (
            <article key={lc.id} className={`live-row phase-${lc.phase}`}>
              <div className="live-time"><strong>{time(lc.starts_at)}</strong><span>{lc.duration_minutes} min</span></div>
              <div className="live-info">
                <div className="live-tags"><span className="tag">{lc.course?.code}</span><Badge status={lc.phase === "live" ? "live" : lc.status === "scheduled" ? (lc.phase === "past" ? "past" : "scheduled") : lc.status} />{lc.link_source === "google" && <span className="tag tag-soft"><GoogleMark /> Calendar</span>}</div>
                <h3>{lc.title}</h3>
                <p className="muted small">{lc.course?.title}{lc.teacher ? ` · ${lc.teacher.name}` : ""} · <Users size={12} /> {lc.students_count} student{lc.students_count === 1 ? "" : "s"}{lc.status === "scheduled" && lc.phase !== "past" ? ` · starts ${fromNow(lc.starts_at)}` : ""}</p>
                {lc.meet_link ? (
                  <div className="meet-link"><Link2 size={15} /><a href={lc.meet_link} target="_blank" rel="noreferrer">{lc.meet_link.replace(/^https?:\/\//, "")}</a><button className="icon-btn" onClick={() => copy(lc.meet_link, toast)} aria-label="Copy link"><Copy size={15} /></button></div>
                ) : <p className="alert alert-warn small">No Meet link yet — generate or paste one, then publish.</p>}
                {lc.recording_url && <p className="small"><PlayCircle size={14} /> Recording: <a href={lc.recording_url} target="_blank" rel="noreferrer">open</a>{lc.lesson && ` · saved as lecture “${lc.lesson.title}”`}</p>}
              </div>
              <div className="live-actions">
                {lc.status === "draft" && <button className="btn btn-primary btn-sm" disabled={!lc.meet_link} onClick={() => act(lc, "publish", `Send this class to ${lc.students_count} student(s) on WhatsApp, email and their dashboard?`)}><Send size={15} /> Publish</button>}
                {lc.meet_link && lc.status !== "cancelled" && lc.phase !== "past" && <a className={`btn btn-sm ${lc.phase === "live" ? "btn-danger" : "btn-outline"}`} href={lc.meet_link} target="_blank" rel="noreferrer"><Video size={15} /> {lc.phase === "live" ? "Start class" : "Open Meet"}</a>}
                {lc.phase === "past" && lc.status !== "cancelled" && <button className="btn btn-outline btn-sm" onClick={() => setDone(lc)}><CheckCircle2 size={15} /> Add recording</button>}
                <div className="live-icons">
                  {lc.status !== "cancelled" && <button className="icon-btn" title="Edit" onClick={() => setEdit(lc)} aria-label="Edit"><Pencil size={16} /></button>}
                  {lc.status !== "cancelled" && lc.phase !== "past" && <button className="icon-btn" title="New Google Meet link" onClick={() => act(lc, "generate-link", "Create a new Google Meet link for this class?")} aria-label="Regenerate link"><RefreshCw size={16} /></button>}
                  {lc.status === "scheduled" && lc.phase !== "past" && <button className="icon-btn danger" title="Cancel class" onClick={() => act(lc, "cancel", "Cancel this class? Students will be informed.")} aria-label="Cancel"><XCircle size={16} /></button>}
                  <button className="icon-btn danger" title="Delete" onClick={() => act(lc, "delete", "Delete this live class permanently?")} aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ))}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit live class" : "Schedule a live class"} size="lg">
        {edit && <LiveForm row={edit} admin={admin} fixedCourse={courseId} onDone={() => { setEdit(null); setTab("upcoming"); load(); }} />}
      </Modal>
      <Modal open={!!done} onClose={() => setDone(null)} title="Class recording">
        {done && <CompleteForm lc={done} onDone={() => { setDone(null); load(); }} />}
      </Modal>
    </>
  );
  if (embedded) return body;
  return (
    <>
      <PageHead title="Live classes" sub="Schedule classes on Google Meet. Students get the link on WhatsApp, email and their dashboard, plus a calendar invite with reminders."
        actions={<button className="btn btn-primary" onClick={() => setEdit({ course_id: courseId || "" })}><Plus size={16} /> Schedule live class</button>} />
      {body}
    </>
  );
}

function LiveForm({ row, admin, fixedCourse, onDone }) {
  const { toast } = useApp();
  const opts = useAdminOptions();
  const [courses, setCourses] = useState(admin ? null : []);
  const [g, setG] = useState(null);
  const def = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); return toLocalInput(d); };
  const [f, setF] = useState({ course_id: row.course_id || fixedCourse || "", teacher_id: row.teacher_id || "", title: row.title || "", description: row.description || "", starts_at: row.starts_at ? toLocalInput(row.starts_at) : def(), duration_minutes: row.duration_minutes || 60, link_mode: row.link_source || "", meet_link: row.meet_link || "" });
  const [saved, setSaved] = useState(row.id ? row : null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!admin) api.get("/teacher/courses").then((r) => { setCourses(r.data); if (!f.course_id && r.data[0]) setF((x) => ({ ...x, course_id: r.data[0].id })); });
    api.get("/teacher/google").then((r) => { setG(r.data); setF((x) => ({ ...x, link_mode: x.link_mode || (r.data.configured && (r.data.mine || r.data.college) ? "google" : "manual") })); }).catch(() => setF((x) => ({ ...x, link_mode: x.link_mode || "manual" })));
  }, []); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const courseList = admin ? (opts.courses || []).map((c) => ({ id: c.id, code: c.code, title: c.title })) : courses || [];
  const googleReady = g?.configured && (g.mine || g.college);

  const save = async (publish = false) => {
    setBusy(publish ? "publish" : "save"); setErr({});
    const payload = { ...f, starts_at: new Date(f.starts_at).toISOString(), publish, meet_link: f.link_mode === "manual" ? f.meet_link : undefined, teacher_id: admin ? f.teacher_id || undefined : undefined };
    try {
      let r;
      if (saved?.id) {
        r = await api.post(`/teacher/live/${saved.id}`, payload);
        if (f.link_mode === "google" && !r.data.meet_link) r = await api.post(`/teacher/live/${saved.id}/generate-link`);
        if (publish) r = await api.post(`/teacher/live/${saved.id}/publish`);
      } else r = await api.post("/teacher/live", payload);
      setSaved(r.data);
      if (publish) { toast(r.data.message || "Published to students"); onDone(); }
      else toast(f.link_mode === "google" ? "Google Meet link generated — check it, then publish to students" : "Saved as draft");
    } catch (e) { setErr(fieldErrors(e)); toast(errMsg(e), "bad"); } finally { setBusy(""); }
  };

  return (
    <div className="live-form">
      <ol className="steps-mini"><li className={!saved?.meet_link ? "on" : "done"}>Class details</li><li className={saved?.meet_link && saved?.status !== "scheduled" ? "on" : saved?.status === "scheduled" ? "done" : ""}>Meet link</li><li className={saved?.status === "scheduled" ? "done" : ""}>Publish to students</li></ol>
      <div className="form-grid">
        {!fixedCourse && <Field label="Course" required error={err.course_id}><select value={f.course_id} onChange={set("course_id")} required><option value="">— select course —</option>{courseList.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select></Field>}
        {admin && <Field label="Teacher" hint="Optional — defaults to the course teacher"><select value={f.teacher_id} onChange={set("teacher_id")}><option value="">Course teacher</option>{(opts.teachers || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
        <Field label="Class title" required error={err.title} full={!!fixedCourse && !admin}><input value={f.title} onChange={set("title")} placeholder="e.g. Lecture 4 — Consolidated statement of financial position" required /></Field>
        <Field label="Date & time" required error={err.starts_at} hint="Pakistan time"><input type="datetime-local" value={f.starts_at} onChange={set("starts_at")} required /></Field>
        <Field label="Duration"><select value={f.duration_minutes} onChange={set("duration_minutes")}>{[30, 45, 60, 75, 90, 120, 150, 180].map((m) => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`}</option>)}</select></Field>
        <Field label="What will you cover? (optional)" full><textarea rows={2} value={f.description} onChange={set("description")} placeholder="Topics, what to prepare, question practice…" /></Field>
      </div>

      <div className="link-mode" role="radiogroup" aria-label="Meet link">
        <label className={`mode ${f.link_mode === "google" ? "on" : ""} ${!googleReady ? "disabled" : ""}`}>
          <input type="radio" name="mode" checked={f.link_mode === "google"} disabled={!googleReady} onChange={() => setF({ ...f, link_mode: "google" })} />
          <span className="mode-icon"><Sparkles size={18} /></span>
          <span><strong>Generate Google Meet link</strong><small>{googleReady ? "Creates the Calendar event + Meet link automatically" : "Needs Google connected (see banner above)"}</small></span>
        </label>
        <label className={`mode ${f.link_mode === "manual" ? "on" : ""}`}>
          <input type="radio" name="mode" checked={f.link_mode === "manual"} onChange={() => setF({ ...f, link_mode: "manual" })} />
          <span className="mode-icon"><Link2 size={18} /></span>
          <span><strong>Paste a Meet link</strong><small>Create one at <a href="https://meet.new" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>meet.new</a> and paste it</small></span>
        </label>
      </div>
      {f.link_mode === "manual" && (
        <Field label="Google Meet link" required error={err.meet_link}>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="url"
              value={f.meet_link}
              onChange={set("meet_link")}
              placeholder="https://meet.google.com/abc-defg-hij"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ whiteSpace: "nowrap" }}
              onClick={() => {
                const r3 = () => Math.random().toString(36).substring(2, 5);
                const r4 = () => Math.random().toString(36).substring(2, 6);
                const code = `${r3()}-${r4()}-${r3()}`;
                setF((x) => ({ ...x, meet_link: `https://meet.google.com/${code}` }));
                toast("Google Meet link generated");
              }}
            >
              <Sparkles size={14} /> Auto-generate link
            </button>
          </div>
        </Field>
      )}
      {err.link_mode && <p className="alert alert-warn">{err.link_mode}</p>}

      {saved?.meet_link && (
        <div className="meet-ready">
          <div><span className="eyebrow-sm"><Video size={14} /> Google Meet link ready</span>
            <a href={saved.meet_link} target="_blank" rel="noreferrer" className="meet-big">{saved.meet_link.replace(/^https?:\/\//, "")}</a>
            <small className="muted">{dayTime(saved.starts_at)} · {saved.duration_minutes} min{saved.link_source === "google" ? " · added to Google Calendar" : ""}</small></div>
          <button className="btn btn-ghost btn-sm" onClick={() => copy(saved.meet_link, toast)}><Copy size={15} /> Copy</button>
        </div>
      )}

      <div className="form-actions">
        {f.link_mode === "google" && !saved?.meet_link
          ? <Btn loading={busy === "save"} className="btn btn-navy" onClick={() => save(false)} disabled={!f.course_id || !f.title}><Sparkles size={16} /> Generate Meet link</Btn>
          : <Btn loading={busy === "save"} className="btn btn-ghost" onClick={() => save(false)} disabled={!f.course_id || !f.title}>{saved ? "Save changes" : "Save as draft"}</Btn>}
        <Btn loading={busy === "publish"} className="btn btn-primary" onClick={() => save(true)} disabled={!f.course_id || !f.title || (f.link_mode === "google" && !saved?.meet_link) || (f.link_mode === "manual" && !f.meet_link)}>
          <Send size={16} /> {saved?.status === "scheduled" ? "Save & notify students" : "Publish to students"}
        </Btn>
      </div>
      <p className="fine">Publishing sends the link to every student with access to this course — on WhatsApp, by email (with a calendar invite) and in their dashboard. A reminder with the link goes out again about 30 minutes before the class.</p>
    </div>
  );
}

function CompleteForm({ lc, onDone }) {
  const { toast } = useApp();
  const [url, setUrl] = useState(lc.recording_url || "");
  const [asLecture, setAsLecture] = useState(true);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/teacher/live/${lc.id}/complete`, { recording_url: url || null, save_as_lecture: asLecture }); toast(asLecture && url ? "Recording published as a lecture" : "Class marked as completed"); onDone(); }
    catch (er) { toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save}>
      <p className="muted">Google Meet recordings are saved to the organiser's Google Drive. Share the recording (anyone with the link → viewer) and paste the link here, or a YouTube (unlisted) link.</p>
      <Field label="Recording link"><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" /></Field>
      <label className="check"><input type="checkbox" checked={asLecture} onChange={(e) => setAsLecture(e.target.checked)} /> Publish it as a lecture so students can re-watch it</label>
      <Btn loading={busy}><CheckCircle2 size={16} /> Save</Btn>
    </form>
  );
}

/* ============================== Students ============================== */
export function LiveCard({ lc, compact = false }) {
  const live = lc.is_live || lc.phase === "live";
  return (
    <article className={`live-card ${live ? "is-live" : ""} ${compact ? "compact" : ""} phase-${lc.phase}`}>
      <div className="lc-date"><span>{new Date(lc.starts_at).toLocaleDateString("en-GB", { month: "short" })}</span><strong>{new Date(lc.starts_at).getDate()}</strong><small>{new Date(lc.starts_at).toLocaleDateString("en-GB", { weekday: "short" })}</small></div>
      <div className="lc-body">
        <div className="live-tags"><span className="tag">{lc.course?.code}</span>{live ? <span className="badge badge-bad pulse"><Radio size={12} /> Live now</span> : lc.status === "cancelled" ? <Badge status="cancelled" /> : lc.phase === "past" ? <Badge status="past" /> : <span className="badge badge-info"><Clock size={12} /> {fromNow(lc.starts_at)}</span>}</div>
        <h3>{lc.title}</h3>
        <p className="muted small">{time(lc.starts_at)} – {time(lc.ends_at)} · {lc.teacher?.name || "Faculty"}{lc.course?.title ? ` · ${lc.course.title}` : ""}</p>
        {!compact && lc.description && <p className="small">{lc.description}</p>}
        {lc.status === "scheduled" && lc.phase !== "past" && (
          <div className="lc-actions">
            <a className={`btn btn-sm ${live ? "btn-danger" : "btn-primary"}`} href={lc.meet_link} target="_blank" rel="noreferrer"><Video size={15} /> {live ? "Join now" : "Join Google Meet"}</a>
            <a className="btn btn-sm btn-outline" href={lc.calendar_url} target="_blank" rel="noreferrer"><CalendarPlus size={15} /> Add to Google Calendar</a>
            {!compact && <a className="btn btn-sm btn-ghost" href={lc.ics_url}><Download size={15} /> Apple / Outlook</a>}
          </div>
        )}
        {lc.phase === "past" && lc.recording_url && <a className="btn btn-sm btn-outline" href={lc.recording_url} target="_blank" rel="noreferrer"><PlayCircle size={15} /> Watch recording</a>}
      </div>
    </article>
  );
}

export function StudentLive() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api.get("/student/live")
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setList([]));
  }, []);
  if (!list) return <Spinner />;
  const upcoming = list.filter((l) => l.status === "scheduled" && l.phase !== "past");
  const past = list.filter((l) => !(l.status === "scheduled" && l.phase !== "past")).reverse();
  return (
    <>
      <PageHead title="Live classes" sub="Join your teachers on Google Meet. Add each class to your calendar to get a reminder on your phone." />
      {!list.length ? <Empty icon={Video} title="No live classes yet" text="When your teacher schedules a class, it appears here and you get the link on WhatsApp and email." /> : (
        <>
          <h3 className="section-label">Upcoming</h3>
          {!upcoming.length ? <p className="muted card">No upcoming classes right now.</p> : <div className="live-grid">{upcoming.map((lc) => <LiveCard key={lc.id} lc={lc} />)}</div>}
          {past.length > 0 && <><h3 className="section-label mt">Past classes & recordings</h3><div className="live-grid">{past.map((lc) => <LiveCard key={lc.id} lc={lc} compact />)}</div></>}
        </>
      )}
    </>
  );
}

export function LiveWidget({ list, role = "student" }) {
  if (!list?.length) return (
    <div className="card">
      <div className="card-head"><h3><Video size={18} /> Live classes</h3><Link to={`/${role}/live`}>All</Link></div>
      <p className="muted">{role === "student" ? "No other upcoming classes right now." : "No upcoming live classes."}</p>
      {role !== "student" && <Link to={`/${role}/live?new=1`} className="btn btn-outline btn-sm"><Plus size={15} /> Schedule a class</Link>}
    </div>
  );
  return (
    <div className="card">
      <div className="card-head"><h3><Video size={18} /> Upcoming live classes</h3><Link to={`/${role}/live`}>All</Link></div>
      <div className="live-stack">{list.map((lc) => role === "student" ? <LiveCard key={lc.id} lc={lc} compact /> : (
        <div key={lc.id} className="live-mini"><div><span className="tag">{lc.course?.code}</span> <strong>{lc.title}</strong><br /><small className="muted">{dayTime(lc.starts_at)} · {lc.status === "draft" ? "draft — not published" : fromNow(lc.starts_at)}</small></div>
          {lc.meet_link && lc.status === "scheduled" ? <a className="btn btn-sm btn-outline" href={lc.meet_link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Meet</a> : <Badge status={lc.status} />}</div>
      ))}</div>
    </div>
  );
}
