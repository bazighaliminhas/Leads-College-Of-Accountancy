import { useState } from "react";
import { Upload, Video, Paperclip } from "lucide-react";
import { api, errMsg, fieldErrors } from "../lib/api";
import { useApp } from "../context/AppContext";
import { Field, Btn } from "./ui";

/** Create / edit a lesson: upload a video file, or paste a YouTube/Vimeo link, notes (PDF etc.) and text. */
export default function LessonForm({ endpoint, lesson, courseId, onSaved, chapters = [] }) {
  const { toast } = useApp();
  const [f, setF] = useState({ chapter: lesson?.chapter || chapters[chapters.length - 1] || "", title: lesson?.title || "", description: lesson?.description || "", type: lesson?.type || "video", video_url: lesson?.video_url || "", content: lesson?.content || "", duration_minutes: lesson?.duration_minutes || "", sort_order: lesson?.sort_order || "", is_published: lesson ? !!lesson.is_published : true });
  const [video, setVideo] = useState(null);
  const [att, setAtt] = useState(null);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({}); setPct(0);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, typeof v === "boolean" ? (v ? "1" : "0") : v ?? ""));
    if (courseId) fd.append("course_id", courseId);
    if (video) fd.append("video", video);
    if (att) fd.append("attachment", att);
    try {
      const r = await api.post(endpoint, fd, { onUploadProgress: (p) => p.total && setPct(Math.round((p.loaded * 100) / p.total)) });
      toast(lesson ? "Lesson updated" : "Lesson added");
      onSaved?.(r.data);
    } catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Chapter / section" hint="Lessons are grouped by chapter"><input list="chapters" value={f.chapter} onChange={set("chapter")} placeholder="e.g. Chapter 1 — Double entry" /><datalist id="chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Lesson title" required error={err.title}><input value={f.title} onChange={set("title")} required /></Field>
        <Field label="Type"><select value={f.type} onChange={set("type")}><option value="video">Video lecture</option><option value="document">Notes / document</option><option value="text">Reading (text)</option></select></Field>
        <Field label="Duration (minutes)" error={err.duration_minutes}><input type="number" min="0" value={f.duration_minutes} onChange={set("duration_minutes")} /></Field>
        <Field label="Upload video file" full error={err.video} hint={lesson?.video_src ? "A video is already uploaded — choose a file to replace it." : "MP4 / WEBM / MOV — stored privately, streamed only to students with access"}>
          <label className="file-drop small"><input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} /><span><Video size={18} /> {video ? video.name : "Choose video file"}</span></label>
        </Field>
        <Field label="…or video link (YouTube / Vimeo unlisted)" full error={err.video_url}><input type="url" value={f.video_url} onChange={set("video_url")} placeholder="https://" /></Field>
        <Field label="Notes / attachment" full error={err.attachment} hint={lesson?.attachment_name ? `Current: ${lesson.attachment_name}` : "PDF, Word, PowerPoint, Excel, ZIP or image (max 50 MB)"}>
          <label className="file-drop small"><input type="file" onChange={(e) => setAtt(e.target.files?.[0] || null)} /><span><Paperclip size={18} /> {att ? att.name : "Choose file"}</span></label>
        </Field>
        <Field label="Short description" full><textarea rows={2} value={f.description} onChange={set("description")} /></Field>
        <Field label="Lesson text (HTML allowed)" full><textarea rows={5} value={f.content} onChange={set("content")} /></Field>
        <Field label="Order"><input type="number" value={f.sort_order} onChange={set("sort_order")} /></Field>
        <label className="check"><input type="checkbox" checked={f.is_published} onChange={set("is_published")} /> Published (visible to students)</label>
      </div>
      {busy && pct > 0 && <div className="upload-progress"><div className="progress"><span style={{ width: `${pct}%` }} /></div><small>Uploading… {pct}%</small></div>}
      <Btn loading={busy}><Upload size={16} /> {lesson ? "Save lesson" : "Add lesson"}</Btn>
    </form>
  );
}
