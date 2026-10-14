import { useState } from "react";
import { Upload, Video, Paperclip, Sparkles, Wand2, Eye, PencilLine, Youtube } from "lucide-react";
import { api, errMsg, fieldErrors } from "../lib/api";
import { useApp } from "../context/AppContext";
import { Field, Btn } from "./ui";
import Markdown from "./Markdown";
import { useAiStatus } from "../pages/portal/quiz/Quiz";

/**
 * Create / edit a lecture: upload a video file or paste a YouTube / Vimeo / Google Drive link,
 * attach notes, and write (or AI-generate) the study material students read under the video.
 */
export default function LessonForm({ endpoint, lesson, courseId, onSaved, chapters = [], nextNumber }) {
  const { toast } = useApp();
  const ai = useAiStatus();
  const [f, setF] = useState({
    chapter: lesson?.chapter || chapters[chapters.length - 1] || "",
    title: lesson?.title || (nextNumber ? `Lecture ${nextNumber} — ` : ""),
    description: lesson?.description || "", type: lesson?.type || "video", video_url: lesson?.video_url || "",
    content: lesson?.content || "", study_material: lesson?.study_material || "", objectives: (lesson?.objectives || []).join("\n"),
    duration_minutes: lesson?.duration_minutes || "", sort_order: lesson?.sort_order || "", is_published: lesson ? !!lesson.is_published : true, ai_generated: !!lesson?.ai_generated,
  });
  const [source, setSource] = useState(lesson?.video_url ? "link" : "upload");
  const [video, setVideo] = useState(null);
  const [att, setAtt] = useState(null);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [preview, setPreview] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const generate = async () => {
    if (!f.title.trim()) { toast("Type the lecture title first", "bad"); return; }
    if (f.study_material.trim() && !confirm("Replace the current study material with a new AI draft?")) return;
    setAiBusy(true);
    try {
      const r = await api.post("/teacher/ai/study-material", lesson?.id ? { lesson_id: lesson.id, notes: aiNotes } : { course_id: courseId, title: f.title, chapter: f.chapter, description: f.description, notes: aiNotes });
      setF((x) => ({ ...x, study_material: r.data.material || "", objectives: (r.data.objectives || []).join("\n") || x.objectives, description: x.description || r.data.summary || "", ai_generated: true }));
      setPreview(true);
      toast("Study material drafted — review it, then save the lecture");
    } catch (e) { toast(errMsg(e), "bad"); } finally { setAiBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({}); setPct(0);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => {
      if (k === "objectives") { String(v).split("\n").map((x) => x.trim()).filter(Boolean).forEach((x) => fd.append("objectives[]", x)); return; }
      if (k === "video_url" && source !== "link") { fd.append(k, lesson?.video_url && !video ? "" : ""); return; }
      fd.append(k, typeof v === "boolean" ? (v ? "1" : "0") : v ?? "");
    });
    if (courseId) fd.append("course_id", courseId);
    if (source === "upload" && video) fd.append("video", video);
    if (att) fd.append("attachment", att);
    try {
      const r = await api.post(endpoint, fd, { onUploadProgress: (p) => p.total && setPct(Math.round((p.loaded * 100) / p.total)) });
      toast(lesson ? "Lecture updated" : f.is_published ? "Lecture published — students notified" : "Lecture saved as draft");
      onSaved?.(r.data);
    } catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="lesson-form">
      <div className="form-grid">
        <Field label="Lecture title" required error={err.title} full><input value={f.title} onChange={set("title")} placeholder="Lecture 1 — Introduction to financial reporting" required /></Field>
        <Field label="Chapter / section" hint="Lectures are grouped by chapter"><input list="chapters" value={f.chapter} onChange={set("chapter")} placeholder="Chapter 1 — Double entry" /><datalist id="chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Duration (minutes)" error={err.duration_minutes}><input type="number" min="0" value={f.duration_minutes} onChange={set("duration_minutes")} /></Field>
      </div>

      <div className="block-label">Video lecture</div>
      <div className="seg seg-wide" role="tablist">
        <button type="button" className={source === "upload" ? "on" : ""} onClick={() => setSource("upload")}><Upload size={15} /> Upload video file</button>
        <button type="button" className={source === "link" ? "on" : ""} onClick={() => setSource("link")}><Youtube size={15} /> YouTube / Vimeo / Drive link</button>
        <button type="button" className={source === "none" ? "on" : ""} onClick={() => { setSource("none"); setF({ ...f, type: f.study_material || f.content ? "text" : "document" }); }}>No video (notes only)</button>
      </div>
      {source === "upload" && (
        <Field label="" error={err.video} hint={lesson?.video_src ? "A video is already uploaded — choose a file only to replace it." : "MP4 / WEBM / MOV up to 2 GB — stored privately and streamed only to students with access."}>
          <label className="file-drop"><input type="file" accept="video/*" onChange={(e) => { setVideo(e.target.files?.[0] || null); setF({ ...f, type: "video" }); }} /><span><Video size={20} /> {video ? `${video.name} (${(video.size / 1048576).toFixed(1)} MB)` : "Click to choose a video file"}</span></label>
        </Field>
      )}
      {source === "link" && <Field label="" error={err.video_url} hint="Paste an unlisted YouTube link, a Vimeo link or a Google Drive share link (anyone with the link can view)."><input type="url" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value, type: "video" })} placeholder="https://youtu.be/… or https://drive.google.com/file/d/…" /></Field>}

      <div className="block-label">Study material <span className="muted small">— students read this under the video</span>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(!preview)}>{preview ? <><PencilLine size={13} /> Edit</> : <><Eye size={13} /> Preview</>}</button>
      </div>
      <div className="ai-inline">
        <input value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} placeholder="Optional instructions for AI, e.g. add a worked example with PKR figures" disabled={!ai?.enabled} />
        <Btn type="button" loading={aiBusy} className="btn btn-ai btn-sm" onClick={generate} disabled={!ai?.enabled} title={ai?.enabled ? "" : "AI not set up yet"}><Wand2 size={15} /> {aiBusy ? "Writing…" : "Generate with AI"}</Btn>
      </div>
      {preview ? <div className="md-preview">{f.study_material ? <Markdown text={f.study_material} /> : <p className="muted">Nothing yet.</p>}</div> :
        <textarea rows={10} className="mono-ish" value={f.study_material} onChange={set("study_material")} placeholder={"## Overview\nWrite the notes here (Markdown supported: ## headings, **bold**, - bullets, tables)…"} />}
      <div className="form-grid">
        <Field label="Learning objectives (one per line)"><textarea rows={3} value={f.objectives} onChange={set("objectives")} /></Field>
        <Field label="Short description"><textarea rows={3} value={f.description} onChange={set("description")} /></Field>
        <Field label="Notes / slides file" full error={err.attachment} hint={lesson?.attachment_name ? `Current: ${lesson.attachment_name}` : "PDF, Word, PowerPoint, Excel, ZIP or image (max 50 MB)"}>
          <label className="file-drop small"><input type="file" onChange={(e) => setAtt(e.target.files?.[0] || null)} /><span><Paperclip size={18} /> {att ? att.name : "Choose file"}</span></label>
        </Field>
        <Field label="Order" hint="Position in the course"><input type="number" value={f.sort_order} onChange={set("sort_order")} /></Field>
      </div>
      {f.ai_generated && <p className="fine"><Sparkles size={13} /> Contains AI-generated material — please review it for accuracy before publishing.</p>}
      {busy && pct > 0 && <div className="upload-progress"><div className="progress"><span style={{ width: `${pct}%` }} /></div><small>Uploading… {pct}%</small></div>}
      <div className="form-actions sticky-foot">
        <label className="check"><input type="checkbox" checked={f.is_published} onChange={set("is_published")} /> Published — visible to students (they are notified)</label>
        <Btn loading={busy}><Upload size={16} /> {lesson ? "Save lecture" : "Add lecture"}</Btn>
      </div>
    </form>
  );
}
