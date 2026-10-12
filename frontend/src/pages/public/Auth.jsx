import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { errMsg, fieldErrors } from "../../lib/api";
import { Field, Btn, Logo } from "../../components/ui";
import { COUNTRIES } from "../../lib/countries";

export function LoginForm({ onDone, role }) {
  const { login, toast } = useApp();
  const [f, setF] = useState({ login: "", password: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { const u = await login(f.login, f.password, role || undefined); toast(`Welcome back, ${u.first_name || u.name}!`); onDone?.(u); }
    catch (er) { setErr(fieldErrors(er)); if (!Object.keys(fieldErrors(er)).length) toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="auth-form">
      <Field label="Email or username" error={err.login}><input autoComplete="username" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} required /></Field>
      <Field label="Password" error={err.password}>
        <div className="input-icon"><input type={show ? "text" : "password"} autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          <button type="button" onClick={() => setShow(!show)} aria-label="Show password">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
      </Field>
      <Btn loading={busy} className="btn btn-primary btn-block btn-lg"><LogIn size={18} /> Log in</Btn>
      <p className="fine center">Forgot your password? Contact the admissions office — the admin can reset it for you.</p>
    </form>
  );
}

export function RegisterForm({ onDone }) {
  const { register, toast } = useApp();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", phone: "", dob: "", city: "", country: "Pakistan", qualification: "", password: "", password_confirmation: "" });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { const u = await register(f); toast(`Welcome to Leads College, ${u.first_name}!`); onDone?.(u); }
    catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="auth-form">
      <div className="form-grid">
        <Field label="First name" required error={err.first_name}><input value={f.first_name} onChange={set("first_name")} required /></Field>
        <Field label="Last name" required error={err.last_name}><input value={f.last_name} onChange={set("last_name")} required /></Field>
        <Field label="Email address" required error={err.email}><input type="email" value={f.email} onChange={set("email")} required /></Field>
        <Field label="Phone / WhatsApp" required error={err.phone}><input value={f.phone} onChange={set("phone")} required /></Field>
        <Field label="Date of birth" error={err.dob}><input type="date" value={f.dob} onChange={set("dob")} /></Field>
        <Field label="City" error={err.city}><input value={f.city} onChange={set("city")} /></Field>
        <Field label="Country" error={err.country}><select value={f.country} onChange={set("country")}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Last qualification" error={err.qualification}><input value={f.qualification} onChange={set("qualification")} placeholder="e.g. Intermediate (ICS) 72%" /></Field>
        <Field label="Password" required error={err.password} hint="At least 8 characters"><input type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required /></Field>
        <Field label="Confirm password" required><input type="password" autoComplete="new-password" value={f.password_confirmation} onChange={set("password_confirmation")} required /></Field>
      </div>
      <Btn loading={busy} className="btn btn-primary btn-block btn-lg"><UserPlus size={18} /> Create student account</Btn>
    </form>
  );
}

export function Login() {
  const nav = useNavigate();
  const [p] = useSearchParams();
  const next = p.get("next");
  const role = p.get("role");
  return (
    <AuthShell title={role === "teacher" ? "Faculty login" : role === "admin" ? "Admin login" : "Log in to your portal"} sub="Students, teachers and administrators all log in here.">
      <LoginForm onDone={(u) => nav(next || `/${u.role}`)} />
      <p className="center">New student? <Link to={`/register${next ? `?next=${next}` : ""}`}>Create an account</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const nav = useNavigate();
  const [p] = useSearchParams();
  return (
    <AuthShell title="Create your student account" sub="Register once — then enrol in papers, pay online and access your lectures." wide>
      <RegisterForm onDone={() => nav(p.get("next") || "/student")} />
      <p className="center">Already registered? <Link to="/login">Log in</Link></p>
    </AuthShell>
  );
}

function AuthShell({ title, sub, children, wide }) {
  return (
    <section className="auth-page">
      <div className={`auth-card ${wide ? "wide" : ""}`}>
        <Link to="/" className="auth-logo"><Logo /></Link>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
        {children}
      </div>
    </section>
  );
}
