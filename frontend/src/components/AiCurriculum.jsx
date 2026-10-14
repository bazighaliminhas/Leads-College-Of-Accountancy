import { useState } from "react";
import { Wand2, Trash2, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useApp } from "../context/AppContext";
import { Field, Btn } from "./ui";
import { useAiStatus } from "../pages/portal/quiz/Quiz";

/** AI builds the whole lecture plan (Lecture 1, Lecture 2 …) for a paper; the teacher edits it and adds it as draft lectures. */
export default function AiCurriculum({ course, existing = 0, onApplied }) {
  const { toast } = useApp();
  const ai = useAiStatus();
  const [count, setCount] = useState(12);
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState("");

  const generate = async () => {
    setBusy("gen");
    try {
      const r = await api.post("/teacher/ai/curriculum", { course_id: course.id, count, notes });
      setPlan({ overview: r.data.overview, lectures: (r.data.lectures || []).map((l, i) => ({ ...l, title: l.title || `Lecture ${existing + i + 1}`, objectives: l.objectives || [], keep: true })) });
    } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(""); }
  };
  const upd = (i, p) => setPlan({ ...plan, lectures: plan.lectures.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const apply = async () => {
    const lectures = plan.lectures.filter((l) => l.keep && l.title.trim()).map(({ keep, ...l }) => l);
    if (!lectures.length) return;
    setBusy("apply");
    try { const r = await api.post("/teacher/ai/curriculum/apply", { course_id: course.id, lectures }); toast(`${r.data.created} draft lectures added — add videos and study material, then publish`); onApplied?.(); }
    catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(""); }
  };

  if (!ai) return null;
  if (!ai.enabled) return <p className="alert alert-info">AI is not set up yet. The admin can add an AI key in <strong>Admin → Integrations</strong> (Google Gemini, OpenAI or Claude). You can still add lectures manually.</p>;

  return (
    <div className="curriculum">
      {!plan ? (
        <>
          <p className="muted">AI drafts a complete lecture plan for <strong>{course.code} — {course.title}</strong> following the official syllabus: chapters, lecture titles, descriptions and learning objectives. You review and edit it before anything is created. Lectures are added as <em>drafts</em>, so students see nothing until you publish.</p>
          <div className="form-grid">
            <Field label="Number of lectures"><select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[6, 8, 10, 12, 15, 18, 20, 24, 30].map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Your instructions (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 2 lectures per week, include revision lectures before the exam" /></Field>
          </div>
          <Btn loading={busy === "gen"} className="btn btn-ai" onClick={generate}><Wand2 size={16} /> {busy === "gen" ? "Designing the curriculum… (up to a minute)" : "Generate curriculum"}</Btn>
        </>
      ) : (
        <>
          {plan.overview && <p className="alert alert-info"><Sparkles size={15} /> {plan.overview}</p>}
          <div className="cur-list">
            {plan.lectures.map((l, i) => (
              <div key={i} className={`cur-item ${l.keep ? "" : "off"}`}>
                <label className="check"><input type="checkbox" checked={l.keep} onChange={(e) => upd(i, { keep: e.target.checked })} aria-label="Include" /></label>
                <div className="cur-fields">
                  <input className="cur-chapter" value={l.chapter || ""} onChange={(e) => upd(i, { chapter: e.target.value })} placeholder="Chapter" />
                  <input className="cur-title" value={l.title} onChange={(e) => upd(i, { title: e.target.value })} />
                  <textarea rows={2} value={l.description || ""} onChange={(e) => upd(i, { description: e.target.value })} />
                  {l.objectives?.length > 0 && <ul className="cur-obj">{l.objectives.map((o, k) => <li key={k}>{o}</li>)}</ul>}
                </div>
                <div className="cur-side"><input type="number" value={l.duration_minutes || ""} onChange={(e) => upd(i, { duration_minutes: Number(e.target.value) })} aria-label="Minutes" /><small>min</small>
                  <button className="icon-btn danger" onClick={() => setPlan({ ...plan, lectures: plan.lectures.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 size={15} /></button></div>
              </div>
            ))}
          </div>
          <div className="form-actions sticky-foot">
            <button className="btn btn-ghost" onClick={() => setPlan({ ...plan, lectures: [...plan.lectures, { title: `Lecture ${existing + plan.lectures.length + 1} — `, chapter: plan.lectures.at(-1)?.chapter || "", description: "", objectives: [], keep: true }] })}><Plus size={15} /> Add lecture</button>
            <button className="btn btn-ghost" onClick={() => setPlan(null)}>Start over</button>
            <Btn loading={busy === "apply"} onClick={apply}><CheckCircle2 size={16} /> Add {plan.lectures.filter((l) => l.keep).length} lectures as drafts</Btn>
          </div>
        </>
      )}
    </div>
  );
}
