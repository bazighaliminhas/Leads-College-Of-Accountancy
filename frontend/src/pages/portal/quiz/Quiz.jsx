import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Plus, Trash2, ArrowUp, ArrowDown, ListChecks, BarChart3, Pencil, CheckCircle2, XCircle, Timer, Trophy, RotateCcw, FileQuestion, Eye, Lightbulb, Wand2 } from "lucide-react";
import { api, errMsg, fieldErrors } from "../../../lib/api";
import { useApp } from "../../../context/AppContext";
import { dateTime } from "../../../lib/format";
import { Badge, Spinner, Empty, Modal, Field, Btn } from "../../../components/ui";
import { PageHead } from "../PortalLayout";

const KIND = { mcq: "MCQs", short: "Short questions", mixed: "MCQs + short" };
const blankMcq = () => ({ type: "mcq", question: "", options: ["", "", "", ""], correct_index: 0, explanation: "", marks: 1 });
const blankShort = () => ({ type: "short", question: "", answer: "", explanation: "", marks: 3 });

export function useAiStatus() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/teacher/ai/status").then((r) => setS(r.data)).catch(() => setS({ enabled: false })); }, []);
  return s;
}

export function AiBadge() { return <span className="badge badge-ai"><Sparkles size={11} /> AI</span>; }

/* ============================== Manager (teacher / admin) ============================== */
export function QuizManager({ courseId = null, lessons = [], embedded = false, admin = false }) {
  const { toast } = useApp();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [results, setResults] = useState(null);
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(courseId || "");
  const load = () => {
    setList(null);
    api.get("/teacher/quizzes", { params: { course_id: course || undefined } })
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch((e) => {
        setList([]);
        toast(errMsg(e, "Unable to load quizzes"), "bad");
      });
  };
  useEffect(() => { load(); }, [course]); // eslint-disable-line
  useEffect(() => {
    if (!courseId) {
      api.get("/teacher/courses")
        .then((r) => setCourses(Array.isArray(r.data) ? r.data : []))
        .catch(() => setCourses([]));
    }
  }, [courseId]);

  const del = async (q) => { if (!confirm(`Delete quiz “${q.title}” and all its attempts?`)) return; await api.delete(`/teacher/quizzes/${q.id}`); toast("Quiz deleted"); load(); };
  const toggle = async (q) => { try { await api.post(`/teacher/quizzes/${q.id}`, { is_published: !q.is_published }); toast(q.is_published ? "Quiz hidden from students" : "Quiz published — students notified"); load(); } catch (e) { toast(errMsg(e), "bad"); } };

  const table = !list ? <Spinner /> : !list.length ? (
    <Empty icon={FileQuestion} title="No quizzes yet" text="Create MCQs and short questions yourself, or let AI draft them from your lecture — you review everything before students see it."
      action={(courseId || course) && <button className="btn btn-primary" onClick={() => setEdit({ course_id: courseId || course })}><Plus size={16} /> Create quiz</button>} />
  ) : (
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Quiz</th>{!courseId && <th>Course</th>}<th>Lecture</th><th>Type</th><th className="num">Questions</th><th className="num">Attempts</th><th>Status</th><th /></tr></thead>
      <tbody>{list.map((q) => (
        <tr key={q.id}>
          <td><strong>{q.title}</strong> {q.ai_generated && <AiBadge />}<br /><small className="muted">Pass {q.pass_percentage}%{q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ""}</small></td>
          {!courseId && <td><span className="tag">{q.course?.code}</span></td>}
          <td>{q.lesson?.title || <span className="muted">Whole course</span>}</td>
          <td>{KIND[q.kind] || q.kind}</td>
          <td className="num">{q.questions_count}</td>
          <td className="num">{q.attempts_count}</td>
          <td><button className="linkish" onClick={() => toggle(q)}><Badge status={q.is_published ? "published" : "draft"} /></button></td>
          <td className="num nowrap">
            <button className="icon-btn" title="Results" onClick={() => setResults(q)} aria-label="Results"><BarChart3 size={16} /></button>
            <button className="icon-btn" title="Edit" onClick={() => setEdit(q)} aria-label="Edit"><Pencil size={16} /></button>
            <button className="icon-btn danger" title="Delete" onClick={() => del(q)} aria-label="Delete"><Trash2 size={16} /></button>
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  );

  return (
    <>
      {!embedded && <PageHead title="Quizzes & MCQs" sub="Practice quizzes, MCQs and short questions for your courses — with instant marking and results."
        actions={<>{!courseId && <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}</select>}
          <button className="btn btn-primary" disabled={!course && !courseId} title={!course && !courseId ? "Choose a course first" : ""} onClick={() => setEdit({ course_id: courseId || course })}><Plus size={16} /> Create quiz</button></>} />}
      {embedded && <div className="tab-toolbar"><span className="muted">{list?.length || 0} quiz{list?.length === 1 ? "" : "zes"}</span><button className="btn btn-primary btn-sm" onClick={() => setEdit({ course_id: courseId })}><Plus size={15} /> Create quiz</button></div>}
      <div className="card flush">{table}</div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit quiz — ${edit.title}` : "Create a quiz"} size="xl">
        {edit && <QuizEditor quiz={edit} courseId={edit.course_id} lessons={lessons} onSaved={() => { setEdit(null); load(); }} />}
      </Modal>
      <Modal open={!!results} onClose={() => setResults(null)} title={`Results — ${results?.title || ""}`} size="lg">
        {results && <QuizResults quizId={results.id} />}
      </Modal>
    </>
  );
}

/* ============================== Editor with AI ============================== */
export function QuizEditor({ quiz, courseId, lessons: lessonsProp = [], lessonId = null, onSaved }) {
  const { toast } = useApp();
  const ai = useAiStatus();
  const [lessons, setLessons] = useState(lessonsProp);
  const [f, setF] = useState({ title: "", description: "", lesson_id: lessonId || "", pass_percentage: 50, time_limit_minutes: "", max_attempts: "", is_published: false, ai_generated: false });
  const [qs, setQs] = useState(null);
  const [gen, setGen] = useState({ kind: "mcq", count: 10, difficulty: "exam", notes: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState({});
  const [showAi, setShowAi] = useState(false);
  useEffect(() => { if (ai?.enabled && !quiz.id) setShowAi(true); }, [ai?.enabled]); // eslint-disable-line

  useEffect(() => {
    if (!lessonsProp.length) api.get(`/teacher/courses/${courseId}`).then((r) => setLessons(r.data.lessons)).catch(() => {});
    if (quiz.id) api.get(`/teacher/quizzes/${quiz.id}`).then((r) => {
      const q = r.data;
      setF({ title: q.title, description: q.description || "", lesson_id: q.lesson_id || "", pass_percentage: q.pass_percentage, time_limit_minutes: q.time_limit_minutes || "", max_attempts: q.max_attempts || "", is_published: q.is_published, ai_generated: q.ai_generated });
      setQs(q.questions.map((x) => ({ ...x, options: x.options || ["", "", "", ""] })));
    });
    else setQs([blankMcq()]);
  }, [quiz.id]); // eslint-disable-line

  const generate = async () => {
    setBusy("ai");
    try {
      const r = await api.post("/teacher/ai/quiz", { course_id: courseId, lesson_id: f.lesson_id || undefined, ...gen });
      const fresh = r.data.questions || [];
      const keep = (qs || []).filter((q) => q.question.trim());
      setQs([...keep, ...fresh.map((q) => ({ ...q, options: q.options || ["", "", "", ""] }))]);
      setF((x) => ({ ...x, title: x.title || r.data.title || "", description: x.description || r.data.description || "", ai_generated: true }));
      toast(`${fresh.length} questions generated — review and edit them below`);
      setShowAi(false);
    } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(""); }
  };

  const upd = (i, patch) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i, d) => { const a = [...qs]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); setQs(a); };
  const total = useMemo(() => (qs || []).reduce((s, q) => s + Number(q.marks || 0), 0), [qs]);

  const save = async () => {
    setBusy("save"); setErr({});
    const payload = { ...f, course_id: courseId, lesson_id: f.lesson_id || null, time_limit_minutes: f.time_limit_minutes || null, max_attempts: f.max_attempts || null,
      questions: qs.filter((q) => q.question.trim()).map((q) => ({ type: q.type, question: q.question, options: q.type === "mcq" ? q.options : null, correct_index: q.type === "mcq" ? Number(q.correct_index) : null, answer: q.answer || null, explanation: q.explanation || null, marks: Number(q.marks) || 1 })) };
    if (!payload.questions.length) { toast("Add at least one question", "bad"); setBusy(""); return; }
    try {
      await (quiz.id ? api.post(`/teacher/quizzes/${quiz.id}`, payload) : api.post("/teacher/quizzes", payload));
      toast(f.is_published ? "Quiz saved and published" : "Quiz saved as draft"); onSaved?.();
    } catch (e) { setErr(fieldErrors(e)); toast(errMsg(e), "bad"); } finally { setBusy(""); }
  };

  if (!qs) return <Spinner />;
  return (
    <div className="quiz-editor">
      <div className={`ai-panel ${showAi ? "open" : ""}`}>
        <button type="button" className="ai-panel-head" onClick={() => setShowAi(!showAi)}>
          <span className="ai-orb"><Sparkles size={18} /></span>
          <span><strong>Generate questions with AI</strong><small>{ai?.enabled ? "Drafts MCQs or short questions from the lecture and its study material" : "AI is not set up yet — the admin can enable it in Integrations"}</small></span>
          <span className="muted small">{showAi ? "Hide" : "Show"}</span>
        </button>
        {showAi && (
          <div className="ai-panel-body">
            <div className="form-grid four">
              <Field label="Based on"><select value={f.lesson_id} onChange={(e) => setF({ ...f, lesson_id: e.target.value })}><option value="">Whole course syllabus</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></Field>
              <Field label="Question type"><select value={gen.kind} onChange={(e) => setGen({ ...gen, kind: e.target.value })}><option value="mcq">MCQs</option><option value="short">Short questions</option><option value="mixed">Mixed (MCQ + short)</option></select></Field>
              <Field label="How many"><select value={gen.count} onChange={(e) => setGen({ ...gen, count: Number(e.target.value) })}>{[5, 10, 15, 20, 25, 30].map((n) => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Difficulty"><select value={gen.difficulty} onChange={(e) => setGen({ ...gen, difficulty: e.target.value })}><option value="easy">Easy — basics</option><option value="medium">Medium</option><option value="exam">Exam standard</option><option value="hard">Hard</option></select></Field>
            </div>
            <Field label="Instructions for the AI (optional)"><input value={gen.notes} onChange={(e) => setGen({ ...gen, notes: e.target.value })} placeholder="e.g. focus on IAS 16 depreciation calculations; include 3 numerical questions" /></Field>
            <Btn loading={busy === "ai"} className="btn btn-ai" onClick={generate} disabled={!ai?.enabled}><Wand2 size={16} /> {busy === "ai" ? "Writing questions… (up to a minute)" : "Generate questions"}</Btn>
          </div>
        )}
      </div>

      <div className="form-grid">
        <Field label="Quiz title" required error={err.title}><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Lecture 1 — Short quiz" required /></Field>
        <Field label="Lecture" hint="Shown under this lecture for students"><select value={f.lesson_id} onChange={(e) => setF({ ...f, lesson_id: e.target.value })}><option value="">Whole course (end-of-course test)</option>{lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></Field>
        <Field label="Pass mark (%)"><input type="number" min="0" max="100" value={f.pass_percentage} onChange={(e) => setF({ ...f, pass_percentage: e.target.value })} /></Field>
        <Field label="Time limit (minutes)" hint="Empty = no limit"><input type="number" min="1" value={f.time_limit_minutes} onChange={(e) => setF({ ...f, time_limit_minutes: e.target.value })} /></Field>
        <Field label="Attempts allowed" hint="Empty = unlimited"><input type="number" min="1" value={f.max_attempts} onChange={(e) => setF({ ...f, max_attempts: e.target.value })} /></Field>
        <Field label="Instructions (optional)"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>

      <div className="q-head"><h4>Questions <span className="muted">({qs.length} · {total} marks)</span></h4>{f.ai_generated && <AiBadge />}</div>
      {err.questions && <p className="alert alert-warn">{err.questions}</p>}
      <div className="q-list">
        {qs.map((q, i) => (
          <div className={`q-card ${err[`questions.${i}.options`] || err[`questions.${i}.correct_index`] ? "has-error" : ""}`} key={i}>
            <div className="q-card-top">
              <span className="q-no">Q{i + 1}</span>
              <div className="seg">
                <button type="button" className={q.type === "mcq" ? "on" : ""} onClick={() => upd(i, { type: "mcq", options: q.options?.length ? q.options : ["", "", "", ""], correct_index: q.correct_index ?? 0 })}>MCQ</button>
                <button type="button" className={q.type === "short" ? "on" : ""} onClick={() => upd(i, { type: "short" })}>Short</button>
              </div>
              <label className="marks">Marks <input type="number" min="1" value={q.marks} onChange={(e) => upd(i, { marks: e.target.value })} /></label>
              <span className="grow" />
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
              <button type="button" className="icon-btn" disabled={i === qs.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
              <button type="button" className="icon-btn danger" onClick={() => setQs(qs.filter((_, j) => j !== i))} aria-label="Remove question"><Trash2 size={15} /></button>
            </div>
            <textarea rows={2} value={q.question} onChange={(e) => upd(i, { question: e.target.value })} placeholder="Type the question…" aria-label={`Question ${i + 1}`} />
            {q.type === "mcq" ? (
              <div className="opts">
                {q.options.map((o, k) => (
                  <label key={k} className={`opt ${Number(q.correct_index) === k ? "correct" : ""}`}>
                    <input type="radio" name={`c${i}`} checked={Number(q.correct_index) === k} onChange={() => upd(i, { correct_index: k })} title="Correct answer" />
                    <span className="opt-letter">{String.fromCharCode(65 + k)}</span>
                    <input value={o} onChange={(e) => upd(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`Option ${String.fromCharCode(65 + k)}`} />
                    {q.options.length > 2 && <button type="button" className="icon-btn" onClick={() => upd(i, { options: q.options.filter((_, m) => m !== k), correct_index: Number(q.correct_index) >= k && q.correct_index > 0 ? q.correct_index - 1 : q.correct_index })} aria-label="Remove option"><XCircle size={14} /></button>}
                  </label>
                ))}
                {q.options.length < 6 && <button type="button" className="btn btn-ghost btn-xs" onClick={() => upd(i, { options: [...q.options, ""] })}><Plus size={13} /> Option</button>}
                <small className="muted">Select the radio button next to the correct answer.</small>
              </div>
            ) : (
              <textarea rows={2} className="model" value={q.answer || ""} onChange={(e) => upd(i, { answer: e.target.value })} placeholder="Model answer (used for marking and shown to students after they submit)" />
            )}
            <input className="expl" value={q.explanation || ""} onChange={(e) => upd(i, { explanation: e.target.value })} placeholder="Explanation shown after submitting (optional)" />
          </div>
        ))}
      </div>
      <div className="q-add">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setQs([...qs, blankMcq()])}><Plus size={15} /> Add MCQ</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setQs([...qs, blankShort()])}><Plus size={15} /> Add short question</button>
      </div>
      <div className="form-actions sticky-foot">
        <label className="check"><input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} /> Published — visible to students (they are notified)</label>
        <Btn loading={busy === "save"} onClick={save}><CheckCircle2 size={16} /> Save quiz</Btn>
      </div>
    </div>
  );
}

/* ============================== Results ============================== */
export function QuizResults({ quizId }) {
  const [d, setD] = useState(null);
  const [view, setView] = useState(null);
  useEffect(() => { api.get(`/teacher/quizzes/${quizId}/results`).then((r) => setD(r.data)); }, [quizId]);
  if (!d) return <Spinner />;
  const s = d.summary;
  return (
    <>
      <div className="mini-stats">
        <div><strong>{s.students}</strong><span>Students</span></div>
        <div><strong>{s.attempts}</strong><span>Attempts</span></div>
        <div><strong>{s.average}%</strong><span>Average</span></div>
        <div><strong>{s.pass_rate}%</strong><span>Pass rate</span></div>
      </div>
      {!d.attempts.length ? <Empty icon={BarChart3} title="No attempts yet" /> : (
        <div className="table-wrap"><table className="table compact">
          <thead><tr><th>Student</th><th className="num">Score</th><th className="num">%</th><th>Result</th><th>Submitted</th><th /></tr></thead>
          <tbody>{d.attempts.map((a) => (
            <tr key={a.id}><td><strong>{a.user?.name}</strong><br /><small className="muted">{a.user?.email}</small></td><td className="num">{a.score}/{a.total}</td><td className="num">{a.percentage}%</td><td><Badge tone={a.passed ? "ok" : "bad"}>{a.passed ? "Passed" : "Not passed"}</Badge></td><td>{dateTime(a.submitted_at)}</td>
              <td><button className="icon-btn" onClick={() => setView(view === a.id ? null : a.id)} aria-label="Answers"><Eye size={15} /></button></td></tr>
          ))}</tbody>
        </table></div>
      )}
      {view && (() => { const a = d.attempts.find((x) => x.id === view); return (
        <div className="card mt"><h4>Answers — {a.user?.name}</h4>{Object.entries(a.results || {}).map(([qid, r], i) => (
          <div key={qid} className={`rev ${r.type === "mcq" ? (r.correct ? "ok" : "bad") : ""}`}><strong>Q{i + 1}</strong> {r.type === "mcq" ? `Answered ${r.given === null ? "—" : String.fromCharCode(65 + r.given)}, correct ${String.fromCharCode(65 + r.correct_index)}` : <>“{r.given || "—"}”{r.graded ? ` · ${r.score}/${r.marks}` : " · not marked"}{r.feedback && <><br /><small>{r.feedback}</small></>}</>}</div>
        ))}</div>); })()}
    </>
  );
}

/* ============================== Student player ============================== */
export function QuizPlayer({ quizId, onDone }) {
  const { toast } = useApp();
  const [d, setD] = useState(null);
  const [stage, setStage] = useState("intro");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(null);
  const started = useRef(null);
  const load = () => api.get(`/student/quizzes/${quizId}`).then((r) => setD(r.data)).catch((e) => toast(errMsg(e), "bad"));
  useEffect(() => { load(); }, [quizId]); // eslint-disable-line

  const submit = async (auto = false) => {
    if (!auto && Object.keys(answers).length < d.questions.length && !confirm("Some questions are unanswered. Submit anyway?")) return;
    setBusy(true);
    try {
      const r = await api.post(`/student/quizzes/${quizId}/submit`, { answers, started_at: started.current });
      setResult(r.data); setStage("result"); onDone?.(r.data.attempt);
    } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (stage !== "run" || !d?.quiz.time_limit_minutes) return;
    const end = Date.now() + d.quiz.time_limit_minutes * 60000;
    const t = setInterval(() => { const s = Math.max(0, Math.round((end - Date.now()) / 1000)); setLeft(s); if (s === 0) { clearInterval(t); toast("Time is up — submitting your answers"); submit(true); } }, 1000);
    return () => clearInterval(t);
  }, [stage]); // eslint-disable-line

  if (!d) return <Spinner />;
  const q = d.quiz;
  const answered = Object.values(answers).filter((v) => v !== "" && v !== null && v !== undefined).length;

  if (stage === "intro") return (
    <div className="quiz-intro">
      <span className="quiz-icon"><ListChecks size={28} /></span>
      <h2>{q.title}</h2>
      {q.description && <p className="muted">{q.description}</p>}
      <div className="quiz-facts">
        <div><strong>{d.questions.length}</strong><span>Questions</span></div>
        <div><strong>{q.time_limit_minutes ? `${q.time_limit_minutes} min` : "No limit"}</strong><span>Time</span></div>
        <div><strong>{q.pass_percentage}%</strong><span>Pass mark</span></div>
        <div><strong>{q.max_attempts ? `${d.attempts.length}/${q.max_attempts}` : d.attempts.length}</strong><span>Attempts used</span></div>
      </div>
      {d.attempts.length > 0 && <p className="small">Your best score: <strong>{Math.max(...d.attempts.map((a) => a.percentage))}%</strong></p>}
      {d.can_attempt ? <button className="btn btn-primary btn-lg" onClick={() => { started.current = new Date().toISOString(); setStage("run"); }}>Start quiz</button> : <p className="alert alert-warn">You have used all attempts for this quiz.</p>}
    </div>
  );

  if (stage === "run") return (
    <div className="quiz-run">
      <div className="quiz-bar">
        <div className="progress"><span style={{ width: `${(answered * 100) / d.questions.length}%` }} /></div>
        <span className="small">{answered}/{d.questions.length} answered</span>
        {left !== null && <span className={`timer ${left < 60 ? "low" : ""}`}><Timer size={15} /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
      </div>
      {d.questions.map((x, i) => (
        <fieldset key={x.id} className="quiz-q">
          <legend><span className="q-no">Q{i + 1}</span><span className="muted small">{x.marks} mark{x.marks > 1 ? "s" : ""}{x.type === "short" ? " · short answer" : ""}</span></legend>
          <p className="q-text">{x.question}</p>
          {x.type === "mcq" ? (
            <div className="choices">{x.options.map((o, k) => (
              <label key={k} className={`choice ${answers[x.id] === k ? "on" : ""}`}>
                <input type="radio" name={`q${x.id}`} checked={answers[x.id] === k} onChange={() => setAnswers({ ...answers, [x.id]: k })} />
                <span className="opt-letter">{String.fromCharCode(65 + k)}</span><span>{o}</span>
              </label>
            ))}</div>
          ) : <textarea rows={4} value={answers[x.id] || ""} onChange={(e) => setAnswers({ ...answers, [x.id]: e.target.value })} placeholder="Write your answer…" />}
        </fieldset>
      ))}
      <div className="form-actions sticky-foot"><span className="muted small">{d.ai_marking ? "Short answers are marked by AI against the model answer." : ""}</span><Btn loading={busy} className="btn btn-primary btn-lg" onClick={() => submit(false)}>Submit answers</Btn></div>
    </div>
  );

  const a = result.attempt;
  return (
    <div className="quiz-result">
      <div className={`score-hero ${a.passed ? "ok" : "bad"}`}>
        <div className="ring" style={{ "--p": a.percentage }}><strong>{a.percentage}%</strong></div>
        <div><h2>{a.passed ? <><Trophy size={22} /> Well done — you passed!</> : "Keep practising"}</h2>
          <p>You scored <strong>{a.score} / {a.total}</strong> marks. Pass mark {q.pass_percentage}%.</p>
          {result.ungraded_marks > 0 && <p className="small muted">{result.ungraded_marks} marks of short answers aren't included — compare your answers with the model answers below.</p>}
        </div>
      </div>
      <h3>Review your answers</h3>
      {result.questions.map((x, i) => {
        const r = a.results[x.id] || {};
        return (
          <div key={x.id} className={`qreview ${x.type === "mcq" ? (r.correct ? "ok" : "bad") : r.graded ? (r.correct ? "ok" : "bad") : "neutral"}`}>
            <div className="qreview-head"><span className="q-no">Q{i + 1}</span>{x.type === "mcq" ? (r.correct ? <span className="ok-text"><CheckCircle2 size={16} /> Correct</span> : <span className="bad-text"><XCircle size={16} /> Incorrect</span>) : r.graded ? <span>{r.score}/{r.marks} marks</span> : <span className="muted">Self-check</span>}</div>
            <p className="q-text">{x.question}</p>
            {x.type === "mcq" ? (
              <ul className="rev-opts">{x.options.map((o, k) => <li key={k} className={k === x.correct_index ? "correct" : k === r.given ? "wrong" : ""}><span className="opt-letter">{String.fromCharCode(65 + k)}</span>{o}{k === x.correct_index && <CheckCircle2 size={15} />}{k === r.given && k !== x.correct_index && <XCircle size={15} />}</li>)}</ul>
            ) : (
              <div className="rev-short"><p><strong>Your answer:</strong> {r.given || <em className="muted">No answer</em>}</p><p><strong>Model answer:</strong> {x.answer}</p>{r.feedback && <p className="feedback"><Sparkles size={14} /> {r.feedback}</p>}</div>
            )}
            {x.explanation && <p className="explain"><Lightbulb size={15} /> {x.explanation}</p>}
          </div>
        );
      })}
      <div className="form-actions"><button className="btn btn-outline" onClick={() => { setAnswers({}); setResult(null); setStage("intro"); load(); }}><RotateCcw size={16} /> Try again</button></div>
    </div>
  );
}
