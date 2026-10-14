import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShoppingCart, Menu, X, ChevronDown, Phone, LayoutDashboard, LogOut, UserRound, Mail } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Logo } from "./ui";

export default function Header() {
  const { site, s, cart, setCartOpen, user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState(null);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => { setOpen(false); setDrop(null); }, [loc.pathname, loc.search]);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const programs = site?.programs || [];
  const portal = user ? `/${user.role}` : "/login";

  return (
    <header className="site-header">
      <div className="promo-bar">
        <div className="container promo-inner">
          <span className="promo-pill">Admissions open</span>
          <span className="promo-text">{s("promo_text", "Admissions open for ACCA & CA (ICAP)")}</span>
          <span className="promo-contact">
            <a href={`tel:${s("contact_phone")}`}><Phone size={13} /> {s("contact_phone")}</a>
            <a href={`mailto:${s("contact_email")}`} className="hide-sm"><Mail size={13} /> {s("contact_email")}</a>
          </span>
        </div>
      </div>
      <div className="nav-wrap">
        <div className={`menu-backdrop ${open ? "show" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
        <div className="container nav">
          <Link to="/" className="brand" aria-label="Leads College of Accountancy — home"><Logo /></Link>

          <nav className={`menu ${open ? "menu-open" : ""}`} aria-label="Main">
            <NavLink to="/about" className="menu-link">About</NavLink>
            <div className={`menu-drop ${drop === "q" ? "is-open" : ""}`} onMouseEnter={() => setDrop("q")} onMouseLeave={() => setDrop(null)}>
              <button className="menu-link" onClick={() => setDrop(drop === "q" ? null : "q")} aria-expanded={drop === "q"}>Qualifications <ChevronDown size={15} /></button>
              <div className="mega">
                {programs.map((p) => (
                  <div className="mega-col" key={p.id}>
                    <Link to={`/${p.slug}`} className="mega-title">{p.name}<span>{p.awarding_body}</span></Link>
                    {(p.levels || []).map((l) => (
                      <Link key={l.id} to={`/?program=${p.slug}&level=${l.slug}#courses`} className="mega-link">
                        {l.name} <em>{l.courses_count}</em>
                      </Link>
                    ))}
                  </div>
                ))}
                <div className="mega-col mega-cta">
                  <strong>Not sure where to start?</strong>
                  <p>Talk to an admissions counsellor about exemptions and the right entry level.</p>
                  <Link to="/contact" className="btn btn-sm btn-primary">Get free counselling</Link>
                </div>
              </div>
            </div>
            <NavLink to="/faculty" className="menu-link">Faculty</NavLink>
            <NavLink to="/fees" className="menu-link">Fee Structure</NavLink>
            <div className={`menu-drop ${drop === "s" ? "is-open" : ""}`} onMouseEnter={() => setDrop("s")} onMouseLeave={() => setDrop(null)}>
              <button className="menu-link" onClick={() => setDrop(drop === "s" ? null : "s")} aria-expanded={drop === "s"}>Student Support <ChevronDown size={15} /></button>
              <div className="dropdown">
                <Link to="/how-to-enrol">How to enrol</Link>
                <Link to="/contact">Contact us</Link>
                <Link to="/terms">Terms &amp; conditions</Link>
                <Link to="/privacy">Privacy policy</Link>
                <Link to={portal}>Student portal</Link>
              </div>
            </div>
            <div className="menu-mobile-actions">
              {user ? <>
                <Link to={portal} className="btn btn-primary btn-block"><LayoutDashboard size={16} /> My dashboard</Link>
                <button className="btn btn-ghost btn-block" onClick={() => { logout(); nav("/"); }}><LogOut size={16} /> Log out</button>
              </> : <>
                <Link to="/login" className="btn btn-outline btn-block">Log in</Link>
                <Link to="/register" className="btn btn-primary btn-block">Register</Link>
              </>}
            </div>
          </nav>

          <div className="nav-actions">
            <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label={`Cart, ${cart.count} items`}>
              <ShoppingCart size={20} /> <span className="hide-sm">Cart</span>
              <span className="cart-count">{cart.count}</span>
            </button>
            {user ? (
              <div className={`menu-drop user-drop ${drop === "u" ? "is-open" : ""}`} onMouseEnter={() => setDrop("u")} onMouseLeave={() => setDrop(null)}>
                <button className="btn btn-navy btn-sm hide-sm" onClick={() => nav(portal)}><UserRound size={16} /> {user.first_name || user.name}</button>
                <div className="dropdown dropdown-right">
                  <Link to={portal}>Dashboard</Link>
                  <Link to={`${portal}/profile`}>My profile</Link>
                  <button onClick={() => { logout(); nav("/"); }}>Log out</button>
                </div>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm hide-sm">Log in</Link>
                <Link to="/register" className="btn btn-primary btn-sm hide-sm">Apply now</Link>
              </>
            )}
            <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
          </div>
        </div>
      </div>
    </header>
  );
}
