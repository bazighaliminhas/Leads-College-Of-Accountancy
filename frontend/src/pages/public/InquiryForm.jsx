import { useState } from "react";
import { api, errMsg, fieldErrors } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import { Field, Btn } from "../../components/ui";

export default function InquiryForm() {
  const { toast, site } = useApp();
  const blank = { name: "", email: "", phone: "", program: "", qualification: "", city: "", message: "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    try { const r = await api.post("/inquiry", f); toast(r.data.message); setF(blank); }
    catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form className="card form-card" onSubmit={submit}>
      <h3>Request a call back</h3>
      <div className="form-grid">
        <Field label="Full name" required error={err.name}><input value={f.name} onChange={set("name")} required /></Field>
        <Field label="Phone / WhatsApp" required error={err.phone}><input value={f.phone} onChange={set("phone")} required /></Field>
        <Field label="Email" required error={err.email}><input type="email" value={f.email} onChange={set("email")} required /></Field>
        <Field label="Programme" error={err.program}>
          <select value={f.program} onChange={set("program")}><option value="">Select</option>{(site?.programs || []).map((p) => <option key={p.id}>{p.name}</option>)}</select>
        </Field>
        <Field label="Last qualification" error={err.qualification}><input value={f.qualification} onChange={set("qualification")} placeholder="e.g. A-Levels 75%" /></Field>
        <Field label="City" error={err.city}><input value={f.city} onChange={set("city")} /></Field>
      </div>
      <Btn loading={busy} className="btn btn-navy btn-block">Request call back</Btn>
    </form>
  );
}
