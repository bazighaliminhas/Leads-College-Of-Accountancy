import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Clock, Receipt, Wallet, Lock, PlayCircle, FileText, CheckCircle2, Circle, Download, Megaphone, ShoppingCart, Upload, ArrowLeft, Hourglass, ListChecks, X, BookOpenText, Target, Sparkles, Video, Trophy } from "lucide-react";
import DOMPurify from "dompurify";
import Markdown from "../../../components/Markdown";
import { QuizPlayer } from "../quiz/Quiz";
import { LiveCard, LiveWidget } from "../live/Live";
import { useApp } from "../../../context/AppContext";
import { api, errMsg } from "../../../lib/api";
import { pkr, date, dateTime } from "../../../lib/format";
import { Badge, Spinner, Empty, Modal } from "../../../components/ui";
import PaymentForm from "../../../components/PaymentForm";
import { PageHead, Stat } from "../PortalLayout";

export function StudentHome() {
  const { user } = useApp();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/student/dashboard").then((r) => setD(r.data)); }, []);
  if (!d) return <Spinner />;
  const needPay = d.orders.filter((o) => ["pending_payment", "rejected"].includes(o.status));
  return (
    <>
      <PageHead title={`Welcome, ${user.first_name || user.name}`} sub="Your admissions, payments and courses in one place." actions={<Link to="/#courses" className="btn btn-primary"><ShoppingCart size={16} /> Enrol in more papers</Link>} />
      {needPay.length > 0 && (
        <div className="alert alert-warn"><Upload size={18} /> You have {needPay.length} order(s) waiting for payment proof. <Link to="/student/orders">Upload now →</Link></div>
      )}
      <div className="stats">
        <Stat icon={BookOpen} label="Courses with access" value={d.stats.active} tone="green" to="/student/courses" />
        <Stat icon={Hourglass} label="Awaiting admin permission" value={d.stats.pending} tone="amber" to="/student/courses" />
        <Stat icon={Receipt} label="Orders" value={d.stats.orders} to="/student/orders" />
        <Stat icon={Trophy} label={`Quizzes taken${d.quiz_stats?.taken ? ` · avg ${d.quiz_stats.average}%` : ""}`} value={d.quiz_stats?.taken ?? 0} tone="red" />
      </div>
      {d.live?.length > 0 && <div className="live-hero">{d.live.slice(0, 1).map((lc) => <LiveCard key={lc.id} lc={lc} />)}</div>}
      <div className="grid-2-1">
        <div className="card">
          <div className="card-head"><h3>My courses</h3><Link to="/student/courses">View all</Link></div>
          {!d.enrollments.length ? <Empty icon={BookOpen} title="No courses yet" text="Enrol in ACCA or CA papers to get started." action={<Link to="/#courses" className="btn btn-primary btn-sm">Browse courses</Link>} /> :
            <div className="enroll-list">{d.enrollments.slice(0, 6).map((e) => <EnrollRow key={e.id} e={e} />)}</div>}
        </div>
        <div className="stack">
        <LiveWidget list={d.live?.slice(1)} role="student" />
        <div className="card">
          <div className="card-head"><h3>Announcements</h3><Link to="/student/announcements">All</Link></div>
          {!d.announcements.length ? <p className="muted">No announcements.</p> : d.announcements.map((a) => (
            <div className="ann" key={a.id}><strong>{a.title}</strong><p>{a.body}</p><small>{a.course ? `${a.course.code} · ` : ""}{dateTime(a.created_at)}</small></div>
          ))}
        </div>
        </div>
      </div>
    </>
  );
}

function EnrollRow({ e }) {
  const ok = e.status === "active";
  return (
    <div className="enroll-row">
      <span className="tag">{e.course.program?.name} · {e.course.code}</span>
      <strong>{e.course.title}</strong>
      <Badge status={e.status} />
      {ok ? <Link className="btn btn-sm btn-primary" to={`/student/learn/${e.course.slug}`}><PlayCircle size={15} /> Open</Link> : <span className="btn btn-sm btn-ghost" aria-disabled><Lock size={15} /> Locked</span>}
    </div>
  );
}

export function MyCourses() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/student/enrollments").then((r) => setList(r.data)); }, []);
  if (!list) return <Spinner />;
  return (
    <>
      <PageHead title="My courses" sub="Courses open once the admin has verified your payment and granted permission." />
      {!list.length ? <Empty icon={BookOpen} title="You are not enrolled in any course" action={<Link to="/#courses" className="btn btn-primary">Browse courses</Link>} /> : (
        <div className="my-courses">
          {list.map((e) => {
            const pct = e.lessons_total ? Math.round((e.lessons_done * 100) / e.lessons_total) : 0;
            return (
              <div className={`my-course ${e.has_access ? "" : "locked"}`} key={e.id}>
                <div className={`mc-head cc-${e.course.program?.slug}`}><span>{e.course.program?.name}</span><strong>{e.course.code}</strong></div>
                <div className="mc-body">
                  <h3>{e.course.title}</h3>
                  <p className="muted">{e.course.level?.name}{e.exam_session ? ` · ${e.exam_session.name} attempt` : ""}</p>
                  <Badge status={e.status} />
                  {e.has_access ? (
                    <>
                      <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                      <small className="muted">{e.lessons_done} of {e.lessons_total} lessons completed</small>
                      <Link to={`/student/learn/${e.course.slug}`} className="btn btn-primary btn-block"><PlayCircle size={16} /> {pct ? "Continue learning" : "Start learning"}</Link>
                      {e.access_expires_on && <small className="muted">Access until {date(e.access_expires_on)}</small>}
                    </>
                  ) : (
                    <div className="locked-note"><Lock size={16} />
                      {e.status === "pending" ? (e.order?.status === "pending_payment" ? <span>Upload your payment proof in <Link to="/student/orders">My orders</Link>.</span> : <span>Payment received — waiting for the admin to grant access.</span>) : <span>Access is {e.status}. Contact the college for help.</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function Learn() {
  const { slug } = useParams();
  const { toast } = useApp();
  const [d, setD] = useState(null);
  const [denied, setDenied] = useState(null);
  const [cur, setCur] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  useEffect(() => {
    api.get(`/student/learn/${slug}`).then((r) => {
      setD(r.data);
      const qs = new URLSearchParams(location.search);
      const want = Number(qs.get("lesson"));
      setCur(r.data.lessons.find((l) => l.id === want) || r.data.lessons.find((l) => !l.completed) || r.data.lessons[0] || null);
      if (qs.get("quiz")) setQuiz(Number(qs.get("quiz")));
    }).catch((e) => setDenied(errMsg(e)));
  }, [slug]);
  useEffect(() => { if (cur) { api.post(`/student/lessons/${cur.id}/progress`, {}).catch(() => {}); setSideOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); } }, [cur?.id]); // eslint-disable-line

  if (denied) return <Empty icon={Lock} title="Course locked" text={denied} action={<Link to="/student/courses" className="btn btn-primary">Back to my courses</Link>} />;
  if (!d) return <Spinner />;

  const toggle = async (l) => {
    try {
      const r = await api.post(`/student/lessons/${l.id}/progress`, { completed: !l.completed });
      const lessons = d.lessons.map((x) => (x.id === l.id ? { ...x, completed: !l.completed } : x));
      setD({ ...d, lessons, enrollment: { ...d.enrollment, progress: r.data.progress } });
      if (cur?.id === l.id) setCur({ ...cur, completed: !l.completed });
    } catch (e) { toast(errMsg(e), "bad"); }
  };
  const chapters = d.lessons.reduce((m, l) => { const k = l.chapter || "Lectures"; (m[k] ||= []).push(l); return m; }, {});
  const idx = d.lessons.findIndex((l) => l.id === cur?.id);
  const lessonQuizzes = d.quizzes.filter((q) => q.lesson_id === cur?.id);
  const courseQuizzes = d.quizzes.filter((q) => !q.lesson_id || !d.lessons.some((l) => l.id === q.lesson_id));
  const onQuizDone = (a) => setD((x) => ({ ...x, quizzes: x.quizzes.map((q) => (q.id === a.quiz_id ? { ...q, attempts: q.attempts + 1, best: Math.max(q.best ?? 0, a.percentage), passed: q.passed || a.passed } : q)) }));

  return (
    <>
      <Link to="/student/courses" className="back-link"><ArrowLeft size={16} /> My courses</Link>
      <div className="learn-head">
        <div><span className="tag">{d.course.program.name} · {d.course.code}</span><h1>{d.course.title}</h1><p className="muted">{d.course.teachers.map((t) => t.name).join(", ")}</p></div>
        <div className="learn-head-progress"><div className="ring sm" style={{ "--p": d.enrollment.progress }}><strong>{d.enrollment.progress}%</strong></div><span>course<br />complete</span></div>
      </div>
      {d.live.length > 0 && <div className="live-strip">{d.live.slice(0, 2).map((lc) => <LiveCard key={lc.id} lc={{ ...lc, course: d.course }} compact />)}</div>}
      <div className="learn">
        <div className="learn-main">
          {!cur ? <div className="card"><Empty icon={PlayCircle} title="No lectures yet" text="Your teacher has not published lectures for this course yet. You'll be notified on WhatsApp and email when they do." /></div> : (
            <div className="card lesson-card">
              <LessonView lesson={cur} quizzes={lessonQuizzes} onQuiz={setQuiz}
                actions={<button className={`btn btn-sm ${cur.completed ? "btn-success" : "btn-outline"}`} onClick={() => toggle(cur)}>{cur.completed ? <><CheckCircle2 size={16} /> Completed</> : <><Circle size={16} /> Mark as complete</>}</button>} />
              <div className="lesson-nav">
                <button className="btn btn-ghost btn-sm" disabled={idx <= 0} onClick={() => setCur(d.lessons[idx - 1])}>← Previous</button>
                <button className="btn btn-ghost btn-sm hide-lg" onClick={() => setSideOpen(true)}><ListChecks size={15} /> All lectures</button>
                <button className="btn btn-primary btn-sm" disabled={idx >= d.lessons.length - 1} onClick={() => setCur(d.lessons[idx + 1])}>Next lecture →</button>
              </div>
            </div>
          )}
          {courseQuizzes.length > 0 && (
            <div className="card"><div className="card-head"><h3><ListChecks size={18} /> Course tests</h3></div><div className="quiz-tiles">{courseQuizzes.map((q) => <QuizTile key={q.id} q={q} onOpen={() => setQuiz(q.id)} />)}</div></div>
          )}
          {d.announcements.length > 0 && <div className="card"><h3><Megaphone size={18} /> Course announcements</h3>{d.announcements.map((a) => <div className="ann" key={a.id}><strong>{a.title}</strong><p>{a.body}</p><small>{dateTime(a.created_at)}</small></div>)}</div>}
        </div>
        <aside className={`learn-side card flush ${sideOpen ? "open" : ""}`}>
          <div className="learn-progress"><strong>Course content</strong><small className="muted">{d.lessons.filter((l) => l.completed).length}/{d.lessons.length} done</small><button className="icon-btn hide-lg" onClick={() => setSideOpen(false)} aria-label="Close"><X size={18} /></button>
            <div className="progress"><span style={{ width: `${d.enrollment.progress}%` }} /></div></div>
          {Object.entries(chapters).map(([ch, ls]) => (
            <div key={ch} className="chapter"><span className="chapter-title">{ch}</span>
              {ls.map((l) => {
                const qn = d.quizzes.filter((q) => q.lesson_id === l.id).length;
                return (
                  <button key={l.id} className={`lesson-item ${cur?.id === l.id ? "on" : ""}`} onClick={() => setCur(l)}>
                    {l.completed ? <CheckCircle2 size={17} className="ok" /> : l.video_src || l.video_url ? <PlayCircle size={17} /> : <FileText size={17} />}
                    <span>{l.title}{qn > 0 && <small className="lesson-quiz"><ListChecks size={11} /> {qn} quiz</small>}</span>{l.duration_minutes ? <em>{l.duration_minutes}m</em> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        {sideOpen && <div className="learn-scrim" onClick={() => setSideOpen(false)} />}
      </div>
      <Modal open={!!quiz} onClose={() => setQuiz(null)} title="Quiz" size="lg">
        {quiz && <QuizPlayer quizId={quiz} onDone={onQuizDone} />}
      </Modal>
    </>
  );
}

function QuizTile({ q, onOpen }) {
  return (
    <button className={`quiz-tile ${q.passed ? "passed" : ""}`} onClick={onOpen}>
      <span className="quiz-tile-icon">{q.passed ? <CheckCircle2 size={20} /> : <ListChecks size={20} />}</span>
      <span className="quiz-tile-main"><strong>{q.title}</strong><small>{q.questions_count} questions · {q.kind === "short" ? "short answers" : q.kind === "mixed" ? "MCQ + short" : "MCQs"}{q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ""}</small></span>
      <span className="quiz-tile-score">{q.best !== null && q.best !== undefined ? <><strong>{q.best}%</strong><small>best</small></> : <small>Start →</small>}</span>
    </button>
  );
}

/** One lecture: video + study material + lecture quizzes + downloads. Also used for teacher previews. */
export function LessonView({ lesson: cur, quizzes = [], onQuiz, actions }) {
  const hasMaterial = !!(cur.study_material || cur.content);
  const [tab, setTab] = useState("material");
  useEffect(() => setTab(hasMaterial ? "material" : quizzes.length ? "quiz" : "material"), [cur.id]); // eslint-disable-line
  return (
    <>
      {(cur.video_src || cur.video_url) && (
        <div className="player">
          {cur.video_src ? <video key={cur.id} src={cur.video_src} controls controlsList="nodownload" playsInline onContextMenu={(e) => e.preventDefault()} /> : <VideoEmbed url={cur.video_url} />}
        </div>
      )}
      <div className="lesson-head">
        <div><span className="tag">{cur.chapter || "Lecture"}</span><h2>{cur.title}</h2>{cur.description && <p className="muted">{cur.description}</p>}</div>
        {actions}
      </div>
      <div className="tabs tabs-sm">
        <button className={tab === "material" ? "on" : ""} onClick={() => setTab("material")}><BookOpenText size={15} /> Study material</button>
        {(quizzes.length > 0 || onQuiz) && <button className={tab === "quiz" ? "on" : ""} onClick={() => setTab("quiz")}><ListChecks size={15} /> Quiz{quizzes.length ? ` (${quizzes.length})` : ""}</button>}
        {cur.attachment_src && <button className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}><Download size={15} /> Downloads</button>}
      </div>
      {tab === "material" && (
        <div className="lesson-body">
          {cur.objectives?.length > 0 && <div className="objectives"><strong><Target size={15} /> In this lecture you will learn to</strong><ul>{cur.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
          {cur.study_material ? <Markdown text={cur.study_material} /> : cur.content ? <div className="prose" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cur.content) }} /> : <p className="muted">Study material for this lecture will be added by your teacher.</p>}
          {cur.ai_generated && <p className="fine"><Sparkles size={12} /> Prepared with AI assistance and reviewed by your teacher.</p>}
        </div>
      )}
      {tab === "quiz" && (
        <div className="lesson-body">{!quizzes.length ? <p className="muted">No quiz for this lecture yet.</p> : <div className="quiz-tiles">{quizzes.map((q) => <QuizTile key={q.id} q={q} onOpen={() => onQuiz?.(q.id)} />)}</div>}</div>
      )}
      {tab === "files" && cur.attachment_src && <div className="lesson-body"><a className="file-row" href={cur.attachment_src}><FileText size={22} /><span><strong>{cur.attachment_name || "Lecture notes"}</strong><small>Download</small></span><Download size={18} /></a></div>}
    </>
  );
}

export function VideoEmbed({ url }) {
  let src = url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  const gd = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]{10,})/);
  if (yt) src = `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  else if (vm) src = `https://player.vimeo.com/video/${vm[1]}`;
  else if (gd) src = `https://drive.google.com/file/d/${gd[1]}/preview`;
  else if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return <video src={url} controls playsInline />;
  return <iframe src={src} title="Lecture video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />;
}

export function Orders() {
  const [list, setList] = useState(null);
  const [pay, setPay] = useState(null);
  const { toast } = useApp();
  const load = () => api.get("/student/orders").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  if (!list) return <Spinner />;
  const cancel = async (o) => { if (!confirm(`Cancel order ${o.order_no}?`)) return; try { await api.post(`/student/orders/${o.id}/cancel`); toast("Order cancelled"); load(); } catch (e) { toast(errMsg(e), "bad"); } };
  return (
    <>
      <PageHead title="My orders & payments" sub="Every admission order and payment proof you have submitted." />
      {!list.length ? <Empty icon={Receipt} title="No orders yet" action={<Link to="/#courses" className="btn btn-primary">Browse courses</Link>} /> : list.map((o) => (
        <div className="card order-card" key={o.id}>
          <div className="order-top">
            <div><h3>{o.order_no}</h3><small className="muted">{dateTime(o.created_at)}</small></div>
            <Badge status={o.status} />
            <strong className="order-total">{pkr(o.total)}</strong>
          </div>
          <div className="table-wrap"><table className="table compact"><tbody>
            {o.items.map((i) => <tr key={i.id}><td><span className="tag">{i.code}</span></td><td>{i.title}{i.session_name && <small className="muted"> · {i.session_name}</small>}</td><td className="num">{pkr(i.price)}</td></tr>)}
          </tbody></table></div>
          {o.payments.length > 0 && (
            <div className="pay-history"><strong>Payment proofs</strong>
              {o.payments.map((p) => (
                <div className="pay-row" key={p.id}>
                  <a href={p.screenshot_url} target="_blank" rel="noreferrer" className="thumb">{/\.pdf$/i.test(p.screenshot_name || "") ? <FileText /> : <img src={p.screenshot_url} alt="Payment proof" />}</a>
                  <div><strong>{pkr(p.amount)}</strong> via {p.method} ({p.paid_from}) · Ref <code>{p.transaction_ref}</code><br /><small className="muted">Paid {date(p.paid_on)} · submitted {dateTime(p.created_at)}</small>{p.remarks && <p className="remark">Admin: {p.remarks}</p>}</div>
                  <Badge status={p.status} />
                </div>
              ))}
            </div>
          )}
          {o.admin_remarks && <div className="alert alert-info">Admin remarks: {o.admin_remarks}</div>}
          <div className="order-actions">
            {["pending_payment", "rejected", "payment_submitted"].includes(o.status) && <button className="btn btn-primary btn-sm" onClick={() => setPay(o)}><Upload size={16} /> {o.status === "payment_submitted" ? "Upload another proof" : "Upload payment proof"}</button>}
            {o.status === "pending_payment" && <button className="btn btn-ghost btn-sm" onClick={() => cancel(o)}>Cancel order</button>}
          </div>
        </div>
      ))}
      <Modal open={!!pay} onClose={() => setPay(null)} title={`Upload payment — ${pay?.order_no || ""}`} size="lg">
        {pay && <PaymentForm order={pay} onDone={() => { setPay(null); load(); }} />}
      </Modal>
    </>
  );
}

export function StudentAnnouncements() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/student/announcements").then((r) => setList(r.data)); }, []);
  if (!list) return <Spinner />;
  return (
    <>
      <PageHead title="Announcements" />
      {!list.length ? <Empty icon={Megaphone} title="No announcements" /> : <div className="card">{list.map((a) => <div className="ann" key={a.id}><strong>{a.title}</strong><p>{a.body}</p><small>{a.author?.name} · {a.course ? `${a.course.code} · ` : ""}{dateTime(a.created_at)}</small></div>)}</div>}
    </>
  );
}
