import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { api, errMsg, fieldErrors } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { COUNTRIES } from "../../lib/countries";
import { Field, Btn, Avatar, Spinner, Empty } from "../../components/ui";
import { PageHead } from "./PortalLayout";

export function Profile() {
  const { user, setUser, toast } = useApp();
  const [f, setF] = useState({ ...user });
  const [avatar, setAvatar] = useState(null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [pwErr, setPwErr] = useState({});
  const [pwBusy, setPwBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fields = ["first_name", "last_name", "email", "phone", "father_name", "dob", "gender", "cnic", "city", "country", "address", "qualification", "registration_no", "designation", "specialization", "bio"];
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    const fd = new FormData();
    fields.forEach((k) => fd.append(k, f[k] ?? ""));
    if (avatar) fd.append("avatar", avatar);
    try { const r = await api.post("/auth/profile", fd); setUser(r.data.user); toast("Profile saved"); }
    catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  const savePw = async (e) => {
    e.preventDefault(); setPwBusy(true); setPwErr({});
    try { await api.post("/auth/password", pw); toast("Password changed"); setPw({ current_password: "", password: "", password_confirmation: "" }); }
    catch (er) { setPwErr(fieldErrors(er)); } finally { setPwBusy(false); }
  };
  return (
    <>
      <PageHead title="My profile" sub={`Username: @${user.username} · Role: ${user.role}`} />
      <div className="grid-2-1">
        <form className="card" onSubmit={save}>
          <div className="profile-head"><Avatar src={avatar ? URL.createObjectURL(avatar) : user.avatar_url} name={user.name} size={72} />
            <label className="btn btn-outline btn-sm">Change photo<input type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0])} /></label></div>
          <div className="form-grid">
            <Field label="First name" error={err.first_name}><input value={f.first_name || ""} onChange={set("first_name")} required /></Field>
            <Field label="Last name" error={err.last_name}><input value={f.last_name || ""} onChange={set("last_name")} /></Field>
            <Field label="Email" error={err.email}><input type="email" value={f.email || ""} onChange={set("email")} required /></Field>
            <Field label="Phone / WhatsApp" error={err.phone}><input value={f.phone || ""} onChange={set("phone")} /></Field>
            <Field label="Father's name" error={err.father_name}><input value={f.father_name || ""} onChange={set("father_name")} /></Field>
            <Field label="Date of birth" error={err.dob}><input type="date" value={f.dob || ""} onChange={set("dob")} /></Field>
            <Field label="Gender"><select value={f.gender || ""} onChange={set("gender")}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
            <Field label="CNIC" error={err.cnic}><input value={f.cnic || ""} onChange={set("cnic")} /></Field>
            <Field label="City"><input value={f.city || ""} onChange={set("city")} /></Field>
            <Field label="Country"><select value={f.country || ""} onChange={set("country")}><option value="">—</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Address" full><input value={f.address || ""} onChange={set("address")} /></Field>
            <Field label="Qualification"><input value={f.qualification || ""} onChange={set("qualification")} /></Field>
            {user.role === "student" && <Field label="ACCA / ICAP registration no."><input value={f.registration_no || ""} onChange={set("registration_no")} /></Field>}
            {user.role !== "student" && <>
              <Field label="Designation"><input value={f.designation || ""} onChange={set("designation")} /></Field>
              <Field label="Specialization"><input value={f.specialization || ""} onChange={set("specialization")} /></Field>
              <Field label="Bio" full><textarea rows={4} value={f.bio || ""} onChange={set("bio")} /></Field>
            </>}
          </div>
          <Btn loading={busy}>Save profile</Btn>
        </form>
        <form className="card" onSubmit={savePw}>
          <h3>Change password</h3>
          <Field label="Current password" error={pwErr.current_password}><input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>
          <Field label="New password" error={pwErr.password}><input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required /></Field>
          <Field label="Confirm new password"><input type="password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} required /></Field>
          <Btn loading={pwBusy} className="btn btn-navy">Update password</Btn>
        </form>
      </div>
    </>
  );
}

export function Notifications() {
  const { setUnread } = useApp();
  const [list, setList] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    api.get("/notifications").then((r) => { setList(r.data); api.post("/notifications/read").then(() => setUnread(0)); });
  }, [setUnread]);
  return (
    <>
      <PageHead title="Notifications" sub="Updates about your admissions, payments and courses." />
      {!list ? <Spinner /> : !list.length ? <Empty icon={Bell} title="No notifications yet" /> : (
        <ul className="notif-list card flush">
          {list.map((n) => (
            <li key={n.id} className={`notif notif-${n.type} ${n.read_at ? "" : "unread"}`} onClick={() => n.link && nav(n.link)}>
              <span className="notif-dot" /><div><strong>{n.title}</strong><p>{n.body}</p><small>{dateTime(n.created_at)}</small></div>
              {n.read_at && <CheckCheck size={16} className="muted" />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
