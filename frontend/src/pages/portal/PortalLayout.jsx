import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, X, Home, ExternalLink } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Logo, Spinner, Avatar } from "../../components/ui";

export default function PortalLayout({ role, nav }) {
  const { user, authReady, logout, unread } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const go = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  if (!authReady) return <Spinner label="Loading your portal…" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;

  return (
    <div className={`portal ${open ? "side-open" : ""}`}>
      <aside className="portal-side">
        <div className="side-top"><Link to="/"><Logo light /></Link><button className="icon-btn light hide-lg" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
        <div className="side-role">{role === "admin" ? "Admin panel" : role === "teacher" ? "Teacher portal" : "Student portal"}</div>
        <nav className="side-nav">
          {nav.map((g) => (
            <div key={g.group || "main"} className="side-group">
              {g.group && <span className="side-group-title">{g.group}</span>}
              {g.items.map(([to, label, Icon, badge]) => (
                <NavLink key={to} to={to} end={to === `/${role}`} className="side-link"><Icon size={18} /><span>{label}</span>{badge ? <em>{badge}</em> : null}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <Link to="/" className="side-link"><Home size={18} /><span>Website</span><ExternalLink size={14} /></Link>
          <button className="side-link" onClick={() => { logout(); go("/"); }}><LogOut size={18} /><span>Log out</span></button>
        </div>
      </aside>
      <div className="side-overlay" onClick={() => setOpen(false)} />
      <div className="portal-main">
        <header className="portal-top">
          <button className="icon-btn hide-lg" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="top-title" />
          <Link to={`/${role}/notifications`} className="icon-btn bell" aria-label="Notifications"><Bell size={20} />{unread > 0 && <span className="dot">{unread > 9 ? "9+" : unread}</span>}</Link>
          <Link to={`/${role}/profile`} className="top-user"><Avatar src={user.avatar_url} name={user.name} size={36} /><span className="hide-sm"><strong>{user.name}</strong><small>@{user.username}</small></span></Link>
        </header>
        <main className="portal-content"><Suspense fallback={<Spinner />}><Outlet /></Suspense></main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function Stat({ icon: Icon, label, value, tone = "navy", to }) {
  const inner = <><span className={`stat-icon t-${tone}`}><Icon size={22} /></span><div><strong>{value}</strong><span>{label}</span></div></>;
  return to ? <Link to={to} className="stat">{inner}</Link> : <div className="stat">{inner}</div>;
}
