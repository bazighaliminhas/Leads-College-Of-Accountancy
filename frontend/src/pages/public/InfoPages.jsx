import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Target, Users, PlayCircle, ShieldCheck, ShoppingCart, UserPlus, FileText, Upload, Unlock, Landmark, Smartphone } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { api, errMsg, fieldErrors } from "../../lib/api";
import { lines } from "../../lib/format";
import { Field, Btn } from "../../components/ui";

export function About() {
  const { site } = useApp();
  return (
    <>
      <section className="page-hero slim"><div className="container"><span className="eyebrow">About us</span><h1>Leads College of Accountancy</h1><p>Part of Lahore Leads University — preparing future accountants for ACCA and CA (ICAP).</p></div></section>
      <section className="section"><div className="container two-col">
        <div className="prose">
          <h2>Learn • Lead • Achieve</h2>
          <p>Leads College of Accountancy offers structured coaching for the two most sought-after accountancy routes in Pakistan: the ACCA Qualification from the United Kingdom and the Chartered Accountancy (CA) qualification awarded by the Institute of Chartered Accountants of Pakistan (ICAP).</p>
          <p>Students enrol online, choose the papers and exam session they need, and study through a dedicated student portal where teachers upload recorded lectures, notes and announcements for each paper.</p>
          <h2>What we offer</h2>
          <ul>
            {(site?.programs || []).map((p) => <li key={p.id}><strong>{p.name}:</strong> {p.levels.map((l) => l.name).join(", ")}</li>)}
          </ul>
        </div>
        <div className="value-grid">
          {[[Target, "Exam-focused teaching", "Classes built around each paper's syllabus and exam structure."], [Users, "Assigned faculty", "Every paper has a teacher responsible for its lectures and resources."], [PlayCircle, "Recorded lectures", "Watch lessons in your portal as many times as you need."], [ShieldCheck, "Transparent admissions", "Clear per-paper fees and a simple online payment process."]].map(([I, t, d]) => (
            <div className="value" key={t}><I size={24} /><strong>{t}</strong><p>{d}</p></div>
          ))}
        </div>
      </div></section>
    </>
  );
}

export function Contact() {
  const { s, toast } = useApp();
  const [params] = useSearchParams();
  const blank = { name: "", email: "", phone: "", subject: params.get("course") ? `Enquiry about ${params.get("course")}` : "", message: "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { const r = await api.post("/contact", f); toast(r.data.message); setF({ ...blank, subject: "" }); }
    catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <>
      <section className="page-hero slim"><div className="container"><span className="eyebrow">Student support</span><h1>Contact the admissions office</h1><p>Questions about exemptions, fees, payments or your portal? We're here to help.</p></div></section>
      <section className="section"><div className="container two-col">
        <form className="card form-card" onSubmit={submit}>
          <h3>Send us a message</h3>
          <div className="form-grid">
            <Field label="Full name" required error={err.name}><input value={f.name} onChange={set("name")} required /></Field>
            <Field label="Email" required error={err.email}><input type="email" value={f.email} onChange={set("email")} required /></Field>
            <Field label="Phone / WhatsApp" error={err.phone}><input value={f.phone} onChange={set("phone")} /></Field>
            <Field label="Subject" error={err.subject}><input value={f.subject} onChange={set("subject")} /></Field>
            <Field label="Message" required full error={err.message}><textarea rows={5} value={f.message} onChange={set("message")} required /></Field>
          </div>
          <Btn loading={busy} className="btn btn-primary">Send message</Btn>
        </form>
        <div className="contact-cards">
          <div className="contact-card"><MapPin /><div><strong>Campus</strong><p>{s("contact_address")}</p></div></div>
          <div className="contact-card"><Phone /><div><strong>Phone</strong><p><a href={`tel:${s("contact_phone")}`}>{s("contact_phone")}</a></p></div></div>
          <div className="contact-card"><Mail /><div><strong>Email</strong><p><a href={`mailto:${s("contact_email")}`}>{s("contact_email")}</a></p></div></div>
          <div className="contact-card"><Clock /><div><strong>Office hours</strong><p>{s("office_hours")}</p></div></div>
        </div>
      </div></section>
    </>
  );
}

export function Legal({ kind }) {
  const { s } = useApp();
  const t = kind === "privacy" ? "Privacy policy" : "Terms & conditions";
  return (
    <>
      <section className="page-hero slim"><div className="container"><h1>{t}</h1></div></section>
      <section className="section"><div className="container narrow prose">
        <ol>{lines(s(kind)).map((l, i) => <li key={i}>{l}</li>)}</ol>
        {kind === "terms" && <><h2>Fees &amp; refunds</h2><ul>{lines(s("fee_notes")).map((l, i) => <li key={i}>{l}</li>)}</ul></>}
      </div></section>
    </>
  );
}

export function HowToEnrol() {
  const { site, s } = useApp();
  return (
    <>
      <section className="page-hero slim"><div className="container"><span className="eyebrow">Student support</span><h1>How to enrol &amp; pay</h1><p>The full admission process, from choosing papers to opening your first lecture.</p></div></section>
      <section className="section"><div className="container narrow">
        <ol className="timeline">
          {[[ShoppingCart, "Choose your papers", "Open the admissions page, pick ACCA or CA, choose the sub-category (level) and click “Enrol now” on each paper. Select your exam session and the paper goes into your cart."],
            [UserPlus, "Register or log in", "At checkout, create a student account (or log in). Your cart is stored safely and stays with your account."],
            [FileText, "Enter your details", "Fill in your name, contact details, date of birth, city, country and your ACCA / ICAP registration number if you have one. Read and accept the terms."],
            [Upload, "Pay and upload the proof", "Pay the total from any bank account or mobile app to one of the college accounts below. Upload the screenshot or receipt with the transaction ID, amount and date."],
            [Unlock, "Admin verifies and grants access", "The admin checks your payment and grants permission. You get a notification, and the paper opens under “My Courses” in your dashboard."]].map(([I, t, d], i) => (
            <li key={t}><span className="tl-icon"><I size={20} /></span><div><strong>Step {i + 1}: {t}</strong><p>{d}</p></div></li>
          ))}
        </ol>
        <h2 className="mb">College accounts</h2>
        <p className="muted">{s("payment_instructions")}</p>
        <div className="pay-accounts">
          {(site?.payment_accounts || []).map((a) => (
            <div className="pay-account" key={a.id}>{a.type === "bank" ? <Landmark size={22} /> : <Smartphone size={22} />}
              <div><strong>{a.provider}</strong><span>{a.account_title}</span><code>{a.account_number}</code>{a.iban && <small>IBAN {a.iban}</small>}{a.branch && <small>{a.branch}</small>}{a.instructions && <small>{a.instructions}</small>}</div></div>
          ))}
        </div>
        <div className="center mt"><Link to="/#courses" className="btn btn-primary btn-lg">Start your admission</Link></div>
      </div></section>
    </>
  );
}
