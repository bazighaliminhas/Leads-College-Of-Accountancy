import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { api } from "../../lib/api";
import { Spinner, Avatar, Empty } from "../../components/ui";
import CourseCard from "../../components/CourseCard";
import EnrolFlow from "../../components/EnrolFlow";
import NotFound from "./NotFound";

export function Faculty() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api.get("/faculty")
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : (Array.isArray(r.data?.data) ? r.data.data : []);
        setList(data);
      })
      .catch(() => setList([]));
  }, []);
  return (
    <>
      <section className="page-hero slim"><div className="container"><span className="eyebrow">Our faculty</span><h1>Learn from experienced ACCA & CA teachers</h1><p>Each paper is taught by a teacher assigned by the college, with recorded lectures and notes in your student portal.</p></div></section>
      <section className="section"><div className="container">
        {!list ? <Spinner /> : !list.length ? <Empty icon={Users} title="Faculty profiles coming soon" /> :
          <div className="faculty-grid">{list.map((t) => (
            <Link key={t.id} to={`/faculty/${t.username}`} className="faculty-card">
              <Avatar src={t.avatar_url} name={t.name} size={96} />
              <h3>{t.name}</h3>
              <span className="muted">{t.designation}</span>
              {t.specialization && <p>{t.specialization}</p>}
              <div className="tags">{(t.teaching_courses || []).slice(0, 6).map((c) => <span key={c.id} className="tag">{c.code}</span>)}{(t.teaching_courses?.length || 0) > 6 && <span className="tag">+{t.teaching_courses.length - 6}</span>}</div>
            </Link>
          ))}</div>}
      </div></section>
    </>
  );
}

export function TeacherProfile() {
  const { username } = useParams();
  const [t, setT] = useState(null);
  const [missing, setMissing] = useState(false);
  const [enrol, setEnrol] = useState(null);
  useEffect(() => { api.get(`/faculty/${username}`).then((r) => setT(r.data)).catch(() => setMissing(true)); }, [username]);
  if (missing) return <NotFound />;
  if (!t) return <Spinner />;
  return (
    <>
      <section className="page-hero slim"><div className="container teacher-hero"><Avatar src={t.avatar_url} name={t.name} size={120} /><div><span className="eyebrow">{t.designation}</span><h1>{t.name}</h1><p>{t.specialization}</p></div></div></section>
      <section className="section"><div className="container">
        {t.bio && <div className="prose mb"><h2>About</h2><p>{t.bio}</p>{t.qualification && <p><strong>Qualification:</strong> {t.qualification}</p>}</div>}
        <h2 className="mb">Courses taught</h2>
        <div className="course-grid">{(t.teaching_courses || []).map((c) => <CourseCard key={c.id} course={{ ...c, teachers: [t] }} onEnrol={setEnrol} />)}</div>
      </div></section>
      <EnrolFlow course={enrol} onClose={() => setEnrol(null)} />
    </>
  );
}
