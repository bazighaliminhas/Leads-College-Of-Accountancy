import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { api } from "../../lib/api";
import { pkr } from "../../lib/format";
import { Spinner } from "../../components/ui";
import EnrolFlow from "../../components/EnrolFlow";
import CourseCard from "../../components/CourseCard";
import NotFound from "./NotFound";

export default function ProgramPage({ slug: forced }) {
  const params = useParams();
  const slug = forced || params.slug;
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const [enrol, setEnrol] = useState(null);
  useEffect(() => { setP(null); api.get(`/programs/${slug}`).then((r) => setP(r.data)).catch(() => setMissing(true)); }, [slug]);
  if (missing) return <NotFound />;
  if (!p) return <Spinner />;
  return (
    <>
      <section className={`page-hero ph-${p.slug}`}>
        <div className="container">
          <span className="eyebrow">{p.awarding_body}</span>
          <h1>{p.full_name}</h1>
          <p>{p.tagline}</p>
          <div className="hero-actions">
            <Link to={`/?program=${p.slug}#courses`} className="btn btn-primary btn-lg">Enrol in {p.name} papers <ArrowRight size={18} /></Link>
            <Link to="/fees" className="btn btn-light btn-lg">Fee structure</Link>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container two-col">
          <div className="prose">
            {p.overview?.map((o, i) => (
              <div key={i} className="overview-block">
                <h2>{o.title}</h2>
                {o.paragraphs?.map((x, j) => <p key={j}>{x}</p>)}
                {o.bullets?.length > 0 && <ul>{o.bullets.map((x, j) => <li key={j}>{x}</li>)}</ul>}
                {o.table && (
                  <div className="table-wrap"><table className="table"><thead><tr><th>Background</th><th>Starting point</th></tr></thead>
                    <tbody>{o.table.map((r, j) => <tr key={j}><td><strong>{r[0]}</strong></td><td>{r[1]}</td></tr>)}</tbody></table></div>
                )}
              </div>
            ))}
          </div>
          <aside>
            <div className="side-card sticky">
              <h3>{p.name} at a glance</h3>
              <dl className="kv">
                <div><dt>Levels</dt><dd>{p.levels?.length || 0}</dd></div>
                <div><dt>Papers</dt><dd>{(p.levels || []).reduce((a, l) => a + (l.courses?.length || 0), 0)}</dd></div>
                <div><dt>Registration fee</dt><dd>{pkr(p.registration_fee)}</dd></div>
                <div><dt>Sessions</dt><dd>{(p.exam_sessions || []).map((s) => s.name).join(", ")}</dd></div>
              </dl>
              <Link to={`/?program=${p.slug}#courses`} className="btn btn-primary btn-block">Start admission</Link>
            </div>
          </aside>
        </div>
      </section>
      <section className="section alt">
        <div className="container">
          {(p.levels || []).map((l) => (
            <div className="level-group" key={l.id}>
              <div className="level-head"><h3><BookOpen size={20} /> {l.name}</h3><p>{l.description}</p></div>
              <div className="course-grid">{(l.courses || []).map((c) => <CourseCard key={c.id} course={{ ...c, program: { name: p.name, slug: p.slug }, level: { name: l.name } }} onEnrol={setEnrol} />)}</div>
            </div>
          ))}
        </div>
      </section>
      <EnrolFlow course={enrol} onClose={() => setEnrol(null)} />
    </>
  );
}
