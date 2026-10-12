import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { STATUS, initials } from "../lib/format";
import { asset } from "../lib/api";

export function Logo({ light = false, compact = false }) {
  return (
    <span className={`logo ${light ? "logo-light" : ""}`}>
      <img src={asset("lca-crest.png")} alt="" className="logo-crest" />
      {!compact && (
        <span className="logo-text">
          <strong>Leads College</strong>
          <small>of Accountancy</small>
        </span>
      )}
    </span>
  );
}

export function Modal({ open, onClose, title, children, size = "md", footer }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Badge({ status, children, tone }) {
  const [label, t] = STATUS[status] || [status, "muted"];
  return <span className={`badge badge-${tone || t}`}>{children || label}</span>;
}

export function Spinner({ label = "Loading…", block = true }) {
  return <div className={block ? "spinner-block" : "spinner-inline"}><Loader2 className="spin" size={22} /> <span>{label}</span></div>;
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="empty-icon"><Icon size={28} /></div>}
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Avatar({ src, name, size = 40 }) {
  return src ? <img className="avatar" src={src} alt={name} style={{ width: size, height: size }} /> :
    <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>;
}

export function Field({ label, error, hint, children, full, required }) {
  return (
    <label className={`field ${full ? "field-full" : ""} ${error ? "has-error" : ""}`}>
      <span className="field-label">{label}{required && <em>*</em>}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Btn({ loading, children, className = "btn btn-primary", ...p }) {
  return <button className={className} disabled={loading || p.disabled} {...p}>{loading && <Loader2 size={16} className="spin" />}{children}</button>;
}
