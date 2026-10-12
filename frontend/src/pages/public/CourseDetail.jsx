import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Award, Languages, CheckCircle2, ShoppingCart, PlayCircle, FileText, Lock, ChevronRight, MessageCircle } from "lucide-react";
import { api } from "../../lib/api";
import { pkr } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import { Spinner, Avatar } from "../../components/ui";
import EnrolFlow from "../../components/EnrolFlow";
import CourseCard from "../../components/CourseCard";
import NotFound from "./NotFound";

export default function CourseDetail() {
  const { slug } = useParams();
  const { cart } = useApp();
  const [d, setD] = useState(null);
  const [missing, setMissing] = useState(false);
  const [enrol, setEnrol] = useState(null);
  useEffect(() => { setD(null); window.scrollTo(0, 0); api.get(`/courses/${slug}`).then((r) => setD(r.data)).catch(() => setMissing(true)); }, [slug]);
  if (missing) return <NotFound />;
  if (!d) return <Spinner />;
  const c = d.course;
  const inCart = cart.items.some((i) => i.course_id === c.id);
  const buyable = c.is_purchasable && c.fee != null;
  return (
    <>
      <section className={`page-hero slim ph-${c.program.slug}`}>
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Admissions</Link><ChevronRight size={14} /><Link to={`/${c.program.slug}`}>{c.program.name}</Link><ChevronRight size={14} /><span>{c.level?.name}</span></nav>
          <span className="code-badge">{c.code}</span>
          <h1>{c.title}</h1>
          <p>{c.short_description}</p>
          <div className="hero-meta">
            {c.exam_duration && <span><Clock size={16} /> {c.exam_duration} exam</span>}
            {c.pass_mark && <span><Award size={16} /> Pass mark {c.pass_mark}</span>}
            <span><Languages size={16} /> {c.language}</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container two-col">
          <div className="prose">
            <h2>About this exam</h2>
            <p>{c.about}</p>
            {c.learn?.length > 0 && <><h2>What you will learn</h2><ul className="check-list">{c.learn.map((x, i) => <li key={i}><CheckCircle2 size={18} />{x}</li>)}</ul></>}
            {c.structure?.length > 0 && <><h2>Exam structure</h2><ul>{c.structure.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            {c.lessons?.length > 0 && (
              <>
                <h2>Course content</h2>
                <ul className="syllabus">{c.lessons.map((l) => <li key={l.id}>{l.type === "video" ? <PlayCircle size={18} /> : <FileText size={18} />}<span>{l.title}</span>{l.duration_minutes ? <em>{l.duration_minutes} min</em> : null}<Lock size={14} className="muted" /></li>)}</ul>
                <p className="fine">Lectures unlock in your student portal once the admin grants access.</p>
              </>
            )}
            {c.teachers?.length > 0 && (
              <>
                <h2>Your teacher{c.teachers.length > 1 ? "s" : ""}</h2>
                <div className="teacher-list">{c.teachers.map((t) => (
                  <Link key={t.id} to={`/faculty/${t.username}`} className="teacher-chip"><Avatar src={t.avatar_url} name={t.name} size={48} /><div><strong>{t.name}</strong><span>{t.designation}</span></div></Link>
                ))}</div>
              </>
            )}
          </div>
          <aside>
            <div className="side-card sticky buy-card">
              <span className="tag">{c.program.name} · {c.level?.name}</span>
              <div className="buy-price">{buyable ? pkr(c.fee) : "Fee on request"}</div>
              {buyable && c.scholarship_fee && <p className="fine">Scholarship fee {pkr(c.scholarship_fee)} for eligible students — subject to verification by the college.</p>}
              {buyable ? (
                <button className={`btn btn-block btn-lg ${inCart ? "btn-success" : "btn-primary"}`} onClick={() => setEnrol(c)}><ShoppingCart size={18} /> {inCart ? "In cart — change session" : "Enrol now"}</button>
              ) : (
                <Link to={`/contact?course=${c.code}`} className="btn btn-outline btn-block btn-lg"><MessageCircle size={18} /> Enquire about this paper</Link>
              )}
              <ul className="mini-list">
                <li><CheckCircle2 size={16} /> Recorded lectures in your portal</li>
                <li><CheckCircle2 size={16} /> Notes and resources from your teacher</li>
                <li><CheckCircle2 size={16} /> Sessions: {d.sessions.map((s) => s.name).join(", ") || "on request"}</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
      {d.related.length > 0 && (
        <section className="section alt"><div className="container"><h2 className="mb">More papers in {c.level?.name}</h2>
          <div className="course-grid">{d.related.map((r) => <CourseCard key={r.id} course={r} onEnrol={setEnrol} />)}</div></div></section>
      )}
      <EnrolFlow course={enrol} onClose={() => setEnrol(null)} />
    </>
  );
}
