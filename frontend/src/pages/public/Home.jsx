import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { ShieldCheck, GraduationCap, PlayCircle, CalendarClock, ChevronLeft, ChevronRight, Search, UserPlus, ShoppingCart, FileText, Upload, Unlock, ArrowRight, Landmark, Smartphone, BookOpenCheck } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import CourseCard from "../../components/CourseCard";
import EnrolFlow from "../../components/EnrolFlow";
import { CartSummary } from "../../components/CartPanel";
import { Spinner, Empty } from "../../components/ui";
import InquiryForm from "./InquiryForm";
import { asset } from "../../lib/api";

const slides = [
  { k: "acca", eyebrow: "ACCA · United Kingdom", title: "Become a globally recognised Chartered Certified Accountant", text: "Foundation (FIA), Applied Skills and Strategic Professional classes — FA1 to SBR — taught by experienced faculty with recorded lectures in your student portal.", stat: [["18", "ACCA papers"], ["PKR 15,000", "papers from"]] },
  { k: "ca", eyebrow: "CA · ICAP Pakistan", title: "Your Chartered Accountancy journey starts with PRC & CAF", text: "Pre-Requisite Competencies, Mandatory Hands-on Courses and CAF Group A coaching — enrol online, pay from any bank or wallet and start learning.", stat: [["PRC · HOC · CAF", "stages offered"], ["PKR 15,000", "per paper"]] },
];

export default function Home() {
  const { site, s } = useApp();
  const [params, setParams] = useSearchParams();
  const loc = useLocation();
  const programs = site?.programs || [];
  const program = params.get("program") || programs[0]?.slug || "acca";
  const level = params.get("level") || "";
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [enrol, setEnrol] = useState(null);
  const [slide, setSlide] = useState(0);
  const catRef = useRef(null);
  const railRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setSlide((x) => (x + 1) % slides.length), 7000); return () => clearInterval(t); }, []);
  useEffect(() => {
    api.get("/courses", { params: { featured: 1 } })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (Array.isArray(r.data?.data) ? r.data.data : []);
        setFeatured(list);
      })
      .catch(() => setFeatured([]));
  }, []);
  useEffect(() => {
    setCourses(null);
    api.get("/courses", { params: { program, level: level || undefined } })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (Array.isArray(r.data?.data) ? r.data.data : []);
        setCourses(list);
      })
      .catch(() => setCourses([]));
  }, [program, level]);
  useEffect(() => {
    if (loc.hash === "#courses" && catRef.current) setTimeout(() => catRef.current.scrollIntoView({ behavior: "smooth" }), 80);
  }, [loc.hash, loc.search]);

  const prog = programs.find((p) => p.slug === program);
  const courseList = Array.isArray(courses) ? courses : (Array.isArray(courses?.data) ? courses.data : []);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courseList.filter((c) => !q || c.code?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q));
  }, [courseList, search]);
  const grouped = useMemo(() => {
    const g = new Map();
    shown.forEach((c) => { const k = c.level?.name || "Courses"; if (!g.has(k)) g.set(k, []); g.get(k).push(c); });
    return [...g.entries()];
  }, [shown]);

  const setFilter = (p, l = "") => { const n = new URLSearchParams(); n.set("program", p); if (l) n.set("level", l); setParams(n, { replace: true }); };
  const cur = slides[slide];

  return (
    <>
      {/* HERO CAROUSEL */}
      <section className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="container hero-inner">
          <div className="hero-copy" key={cur.k}>
            <span className="eyebrow">{cur.eyebrow}</span>
            <h1>{cur.title}</h1>
            <p>{cur.text}</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => { setFilter(cur.k); catRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Enrol now <ArrowRight size={18} /></button>
              <Link to={`/${cur.k}`} className="btn btn-light btn-lg">View {cur.k.toUpperCase()} guide</Link>
            </div>
            <div className="hero-dots">
              {slides.map((x, i) => <button key={x.k} className={i === slide ? "on" : ""} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} />)}
            </div>
          </div>
          <div className="hero-card">
            <img src={asset("lca-crest.png")} alt="Leads College of Accountancy crest" className="hero-crest" />
            <div className="hero-stats">
              {cur.stat.map(([a, b]) => <div key={b}><strong>{a}</strong><span>{b}</span></div>)}
            </div>
            <div className="hero-card-foot"><ShieldCheck size={16} /> Pay from any bank or mobile wallet · upload proof · start learning</div>
          </div>
        </div>
        <button className="hero-arrow left" onClick={() => setSlide((slide + slides.length - 1) % slides.length)} aria-label="Previous slide"><ChevronLeft /></button>
        <button className="hero-arrow right" onClick={() => setSlide((slide + 1) % slides.length)} aria-label="Next slide"><ChevronRight /></button>
      </section>

      {/* TRUST STRIP */}
      <section className="trust">
        <div className="container trust-grid">
          {[[GraduationCap, "ACCA & ICAP pathways", "Complete route coverage"], [BookOpenCheck, "Expert faculty", "Exam-focused teaching"], [PlayCircle, "Recorded lectures", "Watch anytime in your portal"], [CalendarClock, "Flexible sessions", "Choose your exam attempt"]].map(([I, a, b]) => (
            <div className="trust-item" key={a}><I size={26} /><div><strong>{a}</strong><span>{b}</span></div></div>
          ))}
        </div>
      </section>

      {/* ADMISSIONS CATALOGUE */}
      <section className="section catalog" id="courses" ref={catRef}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow red">Online admissions</span>
            <h2>{s("hero_title", "Choose your courses")}</h2>
            <p>{s("hero_subtitle")}</p>
          </div>
          <div className="catalog-layout">
            <div className="catalog-main">
              <div className="filter-block">
                <span className="filter-label">Course categories</span>
                <div className="cat-tabs" role="tablist">
                  {programs.map((p) => (
                    <button key={p.id} role="tab" aria-selected={p.slug === program} className={`cat-tab ${p.slug === program ? "on" : ""}`} onClick={() => setFilter(p.slug)}>
                      <strong>{p.name}</strong><span>{p.awarding_body}</span>
                    </button>
                  ))}
                </div>
              </div>
              {prog && (
                <div className="filter-block">
                  <span className="filter-label">Sub-categories</span>
                  <div className="pills">
                    <button className={`pill ${!level ? "on" : ""}`} onClick={() => setFilter(program)}>All {prog.name} papers</button>
                    {(prog.levels || []).map((l) => (
                      <button key={l.id} className={`pill ${level === l.slug ? "on" : ""}`} onClick={() => setFilter(program, l.slug)}>{l.name} <em>{l.courses_count}</em></button>
                    ))}
                  </div>
                </div>
              )}
              <div className="catalog-tools">
                <div className="search-box"><Search size={18} /><input placeholder="Search by paper code or name, e.g. FR or Taxation" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search courses" /></div>
                <span className="muted">{shown.length} {shown.length === 1 ? "course" : "courses"} · Language: English / Urdu</span>
              </div>

              {!courses ? <Spinner /> : !shown.length ? <Empty icon={Search} title="No courses found" text="Try another category or search term." /> :
                grouped.map(([name, list]) => {
                  const lv = prog?.levels?.find((l) => l.name === name);
                  return (
                    <div className="level-group" key={name}>
                      <div className="level-head"><h3>{name}</h3>{lv?.description && <p>{lv.description}</p>}</div>
                      <div className="course-grid">{list.map((c) => <CourseCard key={c.id} course={c} onEnrol={setEnrol} />)}</div>
                    </div>
                  );
                })}
            </div>
            <aside className="catalog-side">
              <div className="side-card sticky">
                <h3>Checkout</h3>
                <CartSummary compact />
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section steps-section">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow red">Admission process</span>
            <h2>Five simple steps to start learning</h2>
          </div>
          <ol className="steps">
            {[[ShoppingCart, "Choose your papers", "Select ACCA or CA papers and your exam session, then add them to the cart."], [UserPlus, "Register / log in", "Create your student account — your cart is saved automatically."], [FileText, "Fill in your details", "Enter your personal details and registration number, and accept the terms."], [Upload, "Pay & upload proof", "Pay from any bank or app, then upload the screenshot with the transaction ID."], [Unlock, "Get access", "The admin verifies your payment and grants access — your courses open in your dashboard."]].map(([I, t, d], i) => (
              <li key={t}><span className="step-no">{i + 1}</span><I size={26} /><strong>{t}</strong><p>{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {/* POPULAR COURSES RAIL */}
      {featured.length > 0 && (
        <section className="section popular">
          <div className="container">
            <div className="section-head row">
              <div><span className="eyebrow red">Most enrolled</span><h2>Other popular courses</h2></div>
              <div className="rail-arrows">
                <button className="icon-btn round" onClick={() => railRef.current?.scrollBy({ left: -340, behavior: "smooth" })} aria-label="Scroll left"><ChevronLeft /></button>
                <button className="icon-btn round" onClick={() => railRef.current?.scrollBy({ left: 340, behavior: "smooth" })} aria-label="Scroll right"><ChevronRight /></button>
              </div>
            </div>
            <div className="rail" ref={railRef}>{featured.map((c) => <CourseCard key={c.id} course={c} onEnrol={setEnrol} />)}</div>
          </div>
        </section>
      )}

      {/* PAYMENT */}
      <section className="section pay-section">
        <div className="container pay-grid">
          <div>
            <span className="eyebrow red">Easy payment</span>
            <h2>Pay from any bank account or mobile app</h2>
            <p>{s("payment_instructions")}</p>
            <Link to="/how-to-enrol" className="btn btn-outline">See the full payment guide</Link>
          </div>
          <div className="pay-accounts">
            {(site?.payment_accounts || []).map((a) => (
              <div className="pay-account" key={a.id}>
                {a.type === "bank" ? <Landmark size={22} /> : <Smartphone size={22} />}
                <div><strong>{a.provider}</strong><span>{a.account_title}</span><code>{a.account_number}</code>{a.iban && <small>IBAN {a.iban}</small>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-section">
        <div className="container cta-grid">
          <div>
            <h2>Ready to start your accounting journey?</h2>
            <p>Leave your details and an admissions counsellor will call you to help you choose the right entry level, exemptions and papers.</p>
            <Link to="/register" className="btn btn-primary btn-lg">Apply now</Link>
          </div>
          <InquiryForm />
        </div>
      </section>

      <EnrolFlow course={enrol} onClose={() => setEnrol(null)} />
    </>
  );
}
