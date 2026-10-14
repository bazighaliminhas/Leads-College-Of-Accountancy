import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Users, PlayCircle, Hourglass, Plus, Pencil, Trash2, FileText, Megaphone, ArrowLeft, Eye, ListChecks, Video, Settings2, Sparkles } from "lucide-react";
import { useApp } from "../../../context/AppContext";
import { api, errMsg, fieldErrors } from "../../../lib/api";
import { pkr, dateTime } from "../../../lib/format";
import { Badge, Spinner, Empty, Modal, Field, Btn } from "../../../components/ui";
import LessonForm from "../../../components/LessonForm";
import AiCurriculum from "../../../components/AiCurriculum";
import { QuizManager, QuizEditor, AiBadge } from "../quiz/Quiz";
import { LiveManager, LiveWidget, GoogleConnect } from "../live/Live";
import { PageHead, Stat } from "../PortalLayout";
import { LessonView } from "../student/Student";

export function TeacherHome() {
  const { user } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/teacher/dashboard").then((r) => setD(r.data)); }, []);
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title={`Welcome, ${user.first_name || user.name}`} sub="Upload lectures, build quizzes with AI and teach live on Google Meet."
        actions={<><Link to="/teacher/live?new=1" className="btn btn-outline"><Video size={16} /> Schedule live class</Link><Link to="/teacher/courses" className="btn btn-primary"><Plus size={16} /> Add lecture</Link></>} />
      <div className="stats">
        <Stat icon={BookOpen} label="Courses I teach" value={d.stats.courses} to="/teacher/courses" />
        <Stat icon={PlayCircle} label="Lectures" value={d.stats.lessons} tone="red" to="/teacher/courses" />
        <Stat icon={Users} label="Students with access" value={d.stats.students} tone="green" to="/teacher/students" />
        <Stat icon={Video} label="Upcoming live classes" value={d.stats.live_upcoming} tone="amber" to="/teacher/live" />
      </div>
      <div className="grid-2-1">
        <div className="card">
          <div className="card-head"><h3>Courses I teach</h3><Link to="/teacher/courses">See all</Link></div>
          {!d.courses.length ? <CourseTable list={[]} /> : (
            <div className="course-tiles">{d.courses.map((c) => (
              <Link key={c.id} to={`/teacher/courses/${c.id}`} className="course-tile">
                <span className={`ct-code cc-${c.program?.slug}`}>{c.code}</span>
                <span className="ct-main"><strong>{c.title}</strong><small>{c.lessons_count} lectures · {c.quizzes_count ?? 0} quizzes · {c.students_count} students</small></span>
                {c.status !== "published" && <Badge status={c.status} />}
              </Link>
            ))}</div>
          )}
        </div>
        <div className="stack">
          <LiveWidget list={d.live} role="teacher" />
          <GoogleConnect compact />
        </div>
      </div>
    </>
  );
}

function CourseTable({ list }) {
  if (!list.length) return <Empty icon={BookOpen} title="No courses assigned yet" text="The admin assigns the courses you teach (Admin → Teachers → Courses). You can also propose a new course for approval." />;
  return (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Course</th><th>Status</th><th className="num">Lectures</th><th className="num">Quizzes</th><th className="num">Students</th><th /></tr></thead>
      <tbody>{list.map((c) => (
        <tr key={c.id}><td><span className="tag">{c.program?.name} · {c.code}</span><br /><strong>{c.title}</strong><br /><small className="muted">{c.level?.name}</small></td><td><Badge status={c.status} /></td><td className="num">{c.lessons_count}</td><td className="num">{c.quizzes_count ?? 0}</td><td className="num">{c.students_count}</td>
          <td className="num"><Link className="btn btn-sm btn-primary" to={`/teacher/courses/${c.id}`}>Open</Link></td></tr>
      ))}</tbody>
    </table></div>
  );
}

export function TeacherCourses() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(new URLSearchParams(location.search).get("new") === "1");
  const load = () => api.get("/teacher/courses").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  return (
    <>
      <PageHead title="My courses" sub="The courses the admin has assigned to you. Open a course to add lectures, study material, quizzes and live classes." actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add new course</button>} />
      <div className="card">{!list ? <Spinner /> : <CourseTable list={list} />}</div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a new course" size="lg">
        <CourseForm onSaved={() => { setOpen(false); load(); }} />
      </Modal>
    </>
  );
}

export function CourseForm({ course, onSaved }) {
  const { site, toast } = useApp();
  const programs = site?.programs || [];
  const published = course?.status === "published";
  const [f, setF] = useState({ program_id: course?.program_id || programs[0]?.id || "", level_id: course?.level_id || "", code: course?.code || "", title: course?.title || "", short_description: course?.short_description || "", about: course?.about || "", learn: (course?.learn || []).join("\n"), structure: (course?.structure || []).join("\n"), exam_duration: course?.exam_duration || "", exam_format: course?.exam_format || "", pass_mark: course?.pass_mark || "", fee: course?.fee ?? "", class_duration: course?.class_duration || "", language: course?.language || "English / Urdu" });
  const [img, setImg] = useState(null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const levels = programs.find((p) => String(p.id) === String(f.program_id))?.levels || [];
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => {
      if (published && ["fee", "program_id", "code"].includes(k)) return;
      if (k === "learn" || k === "structure") String(v).split("\n").map((x) => x.trim()).filter(Boolean).forEach((x) => fd.append(`${k}[]`, x));
      else fd.append(k, v ?? "");
    });
    if (img) fd.append("image", img);
    try { const r = await api.post(course ? `/teacher/courses/${course.id}` : "/teacher/courses", fd); toast(course ? "Course updated" : "Course submitted — the admin will review and publish it."); onSaved?.(r.data); }
    catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      {published && <p className="alert alert-info">This course is published. Fee, programme and code are managed by the admin.</p>}
      <div className="form-grid">
        <Field label="Programme" required error={err.program_id}><select value={f.program_id} onChange={set("program_id")} disabled={published}>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Level" error={err.level_id}><select value={f.level_id || ""} onChange={set("level_id")}><option value="">—</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <Field label="Paper code" required error={err.code}><input value={f.code} onChange={set("code")} disabled={published} required /></Field>
        <Field label="Course title" required error={err.title}><input value={f.title} onChange={set("title")} required /></Field>
        <Field label="Proposed fee (PKR)" error={err.fee}><input type="number" min="0" value={f.fee} onChange={set("fee")} disabled={published} /></Field>
        <Field label="Language"><input value={f.language} onChange={set("language")} /></Field>
        <Field label="Exam duration"><input value={f.exam_duration} onChange={set("exam_duration")} placeholder="e.g. 3 hours" /></Field>
        <Field label="Pass mark"><input value={f.pass_mark} onChange={set("pass_mark")} placeholder="50%" /></Field>
        <Field label="Short description" full error={err.short_description}><input value={f.short_description} onChange={set("short_description")} /></Field>
        <Field label="About this exam" full><textarea rows={4} value={f.about} onChange={set("about")} /></Field>
        <Field label="What you will learn (one per line)" full><textarea rows={4} value={f.learn} onChange={set("learn")} /></Field>
        <Field label="Exam structure (one per line)" full><textarea rows={4} value={f.structure} onChange={set("structure")} /></Field>
        <Field label="Cover image" full><input type="file" accept="image/*" onChange={(e) => setImg(e.target.files?.[0])} /></Field>
      </div>
      <Btn loading={busy}>{course ? "Save course" : "Submit for approval"}</Btn>
    </form>
  );
}

export function TeacherCourse({ base = "/teacher" }) {
  const { id } = useParams();
  const { toast } = useApp();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(new URLSearchParams(location.search).get("tab") || "lessons");
  const [edit, setEdit] = useState(null); // lesson | "new"
  const [preview, setPreview] = useState(null);
  const [curriculum, setCurriculum] = useState(false);
  const [quizFor, setQuizFor] = useState(null);
  const load = () => api.get(`/teacher/courses/${id}`).then((r) => setD(r.data)).catch((e) => toast(errMsg(e), "bad"));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  if (!d) return <Spinner />;
  const c = d.course;
  const chapters = [...new Set(d.lessons.map((l) => l.chapter).filter(Boolean))];
  const del = async (l) => { if (!confirm(`Delete lecture "${l.title}"?`)) return; await api.delete(`/teacher/lessons/${l.id}`); toast("Lecture deleted"); load(); };
  const publish = async (l) => { const fd = new FormData(); fd.append("is_published", l.is_published ? "0" : "1"); await api.post(`/teacher/lessons/${l.id}`, fd); toast(l.is_published ? "Lecture hidden" : "Lecture published — students notified"); load(); };
  const drafts = d.lessons.filter((l) => !l.is_published).length;
  return (
    <>
      <Link to={`${base}/courses`} className="back-link"><ArrowLeft size={16} /> {base === "/admin" ? "All courses" : "My courses"}</Link>
      <div className="course-hero">
        <div>
          <div className="live-tags"><span className="tag">{c.program.name}</span><span className="tag">{c.code}</span><Badge status={c.status} /></div>
          <h1>{c.title}</h1>
          <p className="muted">{c.level?.name}{c.teachers?.length ? ` · ${c.teachers.map((t) => t.name).join(", ")}` : ""}</p>
        </div>
        <div className="course-hero-stats">
          <div><strong>{d.lessons.length}</strong><span>Lectures</span></div>
          <div><strong>{d.students}</strong><span>Students</span></div>
          <div><strong>{drafts}</strong><span>Drafts</span></div>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === "lessons" ? "on" : ""} onClick={() => setTab("lessons")}><PlayCircle size={15} /> Lectures</button>
        <button className={tab === "quizzes" ? "on" : ""} onClick={() => setTab("quizzes")}><ListChecks size={15} /> Quizzes & MCQs</button>
        <button className={tab === "live" ? "on" : ""} onClick={() => setTab("live")}><Video size={15} /> Live classes</button>
        <button className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}><Settings2 size={15} /> Course details</button>
      </div>
      {tab === "lessons" && (
        <>
          <div className="tab-toolbar">
            <span className="muted">{d.lessons.length} lecture{d.lessons.length === 1 ? "" : "s"}{drafts ? ` · ${drafts} draft` : ""}</span>
            <span className="grow" />
            <button className="btn btn-ai btn-sm" onClick={() => setCurriculum(true)}><Sparkles size={15} /> AI curriculum</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEdit("new")}><Plus size={15} /> Add lecture</button>
          </div>
          {!d.lessons.length ? (
            <div className="card"><Empty icon={PlayCircle} title="No lectures yet" text="Upload Lecture 1 yourself, or let AI draft the full curriculum (Lecture 1, Lecture 2 …) from the syllabus and fill in the videos afterwards."
              action={<div className="row-gap"><button className="btn btn-ai" onClick={() => setCurriculum(true)}><Sparkles size={16} /> Generate curriculum with AI</button><button className="btn btn-primary" onClick={() => setEdit("new")}><Plus size={16} /> Add lecture</button></div>} /></div>
          ) : (
            <div className="lecture-list">
              {Object.entries(d.lessons.reduce((m, l) => { (m[l.chapter || "Lectures"] ||= []).push(l); return m; }, {})).map(([ch, ls]) => (
                <section key={ch} className="lecture-group">
                  <h4>{ch}</h4>
                  {ls.map((l) => (
                    <div key={l.id} className={`lecture-row ${l.is_published ? "" : "draft"}`}>
                      <span className={`lec-icon ${l.video_src || l.video_url ? "has" : ""}`}>{l.video_src || l.video_url ? <PlayCircle size={18} /> : <FileText size={18} />}</span>
                      <div className="lec-main">
                        <strong>{l.title}</strong>
                        <div className="lec-meta">
                          {l.video_src && <span className="tag tag-soft">Video{l.file_size ? ` · ${(l.file_size / 1048576).toFixed(0)} MB` : ""}</span>}
                          {l.video_url && <span className="tag tag-soft">Video link</span>}
                          {!l.video_src && !l.video_url && <span className="tag tag-warn">No video yet</span>}
                          {l.study_material ? <span className="tag tag-soft">Study material</span> : <span className="tag tag-muted">No study material</span>}
                          {l.attachment_name && <span className="tag tag-soft">Notes file</span>}
                          {l.quizzes_count > 0 && <span className="tag tag-soft">{l.quizzes_count} quiz</span>}
                          {l.ai_generated && <AiBadge />}
                          {l.duration_minutes ? <span className="muted small">{l.duration_minutes} min</span> : null}
                        </div>
                      </div>
                      <button className="linkish" onClick={() => publish(l)} title="Publish / hide"><Badge status={l.is_published ? "published" : "draft"} /></button>
                      <div className="lec-actions">
                        <button className="btn btn-ghost btn-xs" onClick={() => setQuizFor(l)} title="Create a quiz for this lecture"><ListChecks size={14} /> Quiz</button>
                        <button className="icon-btn" onClick={() => setPreview(l)} aria-label="Preview"><Eye size={16} /></button>
                        <button className="icon-btn" onClick={() => setEdit(l)} aria-label="Edit"><Pencil size={16} /></button>
                        <button className="icon-btn danger" onClick={() => del(l)} aria-label="Delete"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "quizzes" && <QuizManager courseId={c.id} lessons={d.lessons} embedded />}
      {tab === "live" && <LiveManager courseId={c.id} embedded admin={base === "/admin"} />}
      {tab === "details" && <div className="card"><CourseForm course={c} onSaved={load} /></div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === "new" ? "Add a lecture" : `Edit — ${edit?.title || ""}`} size="xl">
        {edit && <LessonForm endpoint={edit === "new" ? `/teacher/courses/${c.id}/lessons` : `/teacher/lessons/${edit.id}`} lesson={edit === "new" ? null : edit} courseId={c.id} chapters={chapters} nextNumber={d.lessons.length + 1} onSaved={() => { setEdit(null); load(); }} />}
      </Modal>
      <Modal open={curriculum} onClose={() => setCurriculum(false)} title="AI curriculum builder" size="xl">
        {curriculum && <AiCurriculum course={c} existing={d.lessons.length} onApplied={() => { setCurriculum(false); load(); }} />}
      </Modal>
      <Modal open={!!quizFor} onClose={() => setQuizFor(null)} title={`New quiz — ${quizFor?.title || ""}`} size="xl">
        {quizFor && <QuizEditor quiz={{}} courseId={c.id} lessons={d.lessons} lessonId={quizFor.id} onSaved={() => { setQuizFor(null); load(); }} />}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title} size="xl">
        {preview && <LessonView lesson={preview} />}
      </Modal>
    </>
  );
}

export function TeacherStudents() {
  const [list, setList] = useState(null);
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState("");
  useEffect(() => { api.get("/teacher/courses").then((r) => setCourses(r.data)); }, []);
  useEffect(() => { setList(null); api.get("/teacher/students", { params: { course_id: course || undefined } }).then((r) => setList(r.data)); }, [course]);
  return (
    <>
      <PageHead title="My students" sub="Students who have been granted access to your courses." actions={<select value={course} onChange={(e) => setCourse(e.target.value)}><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}</select>} />
      <div className="card flush">{!list ? <Spinner /> : !list.length ? <Empty icon={Users} title="No students yet" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Student</th><th>Contact</th><th>Course</th><th>Session</th><th className="num">Progress</th><th>Access since</th></tr></thead>
          <tbody>{list.map((e) => <tr key={e.id}><td><strong>{e.user.name}</strong><br /><small className="muted">{e.user.registration_no || "—"}</small></td><td>{e.user.email}<br /><small>{e.user.phone}</small></td><td><span className="tag">{e.course.code}</span></td><td>{e.exam_session?.name || "—"}</td><td className="num">{e.progress}% <small className="muted">({e.lessons_done})</small></td><td>{dateTime(e.granted_at)}</td></tr>)}</tbody>
        </table></div>
      )}</div>
    </>
  );
}

export function TeacherAnnouncements() {
  const { toast } = useApp();
  const [list, setList] = useState(null);
  const [courses, setCourses] = useState([]);
  const [f, setF] = useState({ course_id: "", title: "", body: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/teacher/announcements").then((r) => setList(r.data));
  useEffect(() => { load(); api.get("/teacher/courses").then((r) => { setCourses(r.data); setF((x) => ({ ...x, course_id: r.data[0]?.id || "" })); }); }, []);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { await api.post("/teacher/announcements", f); toast("Announcement posted and students notified"); setF({ ...f, title: "", body: "" }); load(); }
    catch (er) { setErr(fieldErrors(er)); } finally { setBusy(false); }
  };
  const del = async (a) => { if (!confirm("Delete this announcement?")) return; await api.delete(`/teacher/announcements/${a.id}`); load(); };
  return (
    <>
      <PageHead title="Announcements" sub="Post updates to the students of a course — they get a notification." />
      <div className="grid-2-1">
        <div className="card">{!list ? <Spinner /> : !list.length ? <Empty icon={Megaphone} title="No announcements yet" /> : list.map((a) => (
          <div className="ann" key={a.id}><div className="ann-row"><strong>{a.title}</strong><button className="icon-btn danger" onClick={() => del(a)} aria-label="Delete"><Trash2 size={15} /></button></div><p>{a.body}</p><small>{a.course?.code} · {dateTime(a.created_at)}</small></div>
        ))}</div>
        <form className="card" onSubmit={submit}>
          <h3>New announcement</h3>
          <Field label="Course" error={err.course_id}><select value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}</select></Field>
          <Field label="Title" error={err.title}><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
          <Field label="Message" error={err.body}><textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></Field>
          <Btn loading={busy}>Post announcement</Btn>
        </form>
      </div>
    </>
  );
}
