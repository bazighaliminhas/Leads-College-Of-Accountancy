import { Link } from "react-router-dom";
import { Clock, Award, ShoppingCart, Check, MessageCircle } from "lucide-react";
import { pkr } from "../lib/format";
import { useApp } from "../context/AppContext";
import { Avatar } from "./ui";

export default function CourseCard({ course, onEnrol }) {
  const { cart } = useApp();
  const inCart = cart.items.some((i) => i.course_id === course.id);
  const teacher = course.teachers?.[0];
  const buyable = course.is_purchasable && course.fee != null;
  return (
    <article className="course-card">
      <Link to={`/course/${course.slug}`} className={`cc-head cc-${course.program?.slug || "x"}`}>
        <span className="cc-program">{course.program?.name}</span>
        <span className="cc-code">{course.code}</span>
        <span className="cc-level">{course.level?.name}</span>
      </Link>
      <div className="cc-body">
        <h3><Link to={`/course/${course.slug}`}>{course.title}</Link></h3>
        <p className="cc-desc">{course.short_description}</p>
        <div className="cc-meta">
          {course.exam_duration && <span><Clock size={14} /> {course.exam_duration} exam</span>}
          {course.pass_mark && <span><Award size={14} /> Pass {course.pass_mark}</span>}
        </div>
        {teacher && (
          <div className="cc-teacher"><Avatar src={teacher.avatar_url} name={teacher.name} size={28} /><span>{teacher.name}</span></div>
        )}
      </div>
      <div className="cc-foot">
        <div className="cc-price">
          {buyable ? <><strong>{pkr(course.fee)}</strong><small>per paper</small></> : <><strong className="muted">Fee on request</strong><small>Contact admissions</small></>}
        </div>
        {buyable ? (
          <button className={`btn btn-sm ${inCart ? "btn-success" : "btn-primary"}`} onClick={() => onEnrol(course)}>
            {inCart ? <><Check size={16} /> In cart</> : <><ShoppingCart size={16} /> Enrol now</>}
          </button>
        ) : (
          <Link className="btn btn-sm btn-outline" to={`/contact?course=${course.code}`}><MessageCircle size={16} /> Enquire</Link>
        )}
      </div>
    </article>
  );
}
