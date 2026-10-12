import { Link } from "react-router-dom";
import { useState } from "react";
import { Facebook, Instagram, Linkedin, Youtube, MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Logo } from "./ui";
import { api, errMsg } from "../lib/api";

export default function Footer() {
  const { s, site, toast } = useApp();
  const [email, setEmail] = useState("");
  const sub = async (e) => {
    e.preventDefault();
    try { const r = await api.post("/newsletter", { email }); toast(r.data.message); setEmail(""); } catch (er) { toast(errMsg(er), "bad"); }
  };
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>{s("site_tagline", "Learn • Lead • Achieve")} — Leads College of Accountancy prepares students for ACCA and CA (ICAP) with experienced faculty, recorded lectures and a complete online student portal.</p>
          <div className="socials">
            <a href={s("social_facebook")} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
            <a href={s("social_instagram")} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
            <a href={s("social_linkedin")} target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={18} /></a>
            <a href={s("social_youtube")} target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={18} /></a>
          </div>
        </div>
        <div>
          <h4>Quick links</h4>
          <Link to="/#courses">Online admissions</Link>
          {(site?.programs || []).map((p) => <Link key={p.id} to={`/${p.slug}`}>{p.name} qualification</Link>)}
          <Link to="/faculty">Faculty</Link>
          <Link to="/fees">Fee structure</Link>
          <Link to="/terms">Terms &amp; conditions</Link>
          <Link to="/privacy">Privacy policy</Link>
        </div>
        <div>
          <h4>Resources</h4>
          <Link to="/login">Student portal (LMS)</Link>
          <Link to="/how-to-enrol">How to enrol &amp; pay</Link>
          <a href="https://portal.accaglobal.com" target="_blank" rel="noreferrer">myACCA portal</a>
          <a href="https://www.accaglobal.com/gb/en/student/exam-support-resources.html" target="_blank" rel="noreferrer">ACCA study resources</a>
          <a href="https://www.icap.org.pk" target="_blank" rel="noreferrer">ICAP website</a>
          <Link to="/login?role=teacher">Faculty login</Link>
        </div>
        <div>
          <h4>Contact us</h4>
          <p className="f-line"><MapPin size={16} /> {s("contact_address")}</p>
          <p className="f-line"><Phone size={16} /> <a href={`tel:${s("contact_phone")}`}>{s("contact_phone")}</a></p>
          <p className="f-line"><Mail size={16} /> <a href={`mailto:${s("contact_email")}`}>{s("contact_email")}</a></p>
          <p className="f-line"><Clock size={16} /> {s("office_hours")}</p>
          <form className="newsletter" onSubmit={sub}>
            <input type="email" required placeholder="Email for updates" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for newsletter" />
            <button aria-label="Subscribe"><Send size={16} /></button>
          </form>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span>© {new Date().getFullYear()} Leads College of Accountancy — Lahore Leads University. All rights reserved.</span>
          <span>ACCA &amp; CA (ICAP) coaching</span>
        </div>
      </div>
    </footer>
  );
}
