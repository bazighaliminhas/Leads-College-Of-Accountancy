import { useState } from "react";
import { Upload, Landmark, Smartphone, ImageIcon } from "lucide-react";
import { api, errMsg, fieldErrors } from "../lib/api";
import { useApp } from "../context/AppContext";
import { PAY_METHODS } from "../lib/countries";
import { pkr } from "../lib/format";
import { Field, Btn } from "./ui";

/** Student uploads payment proof (screenshot) for an order — any bank / any app. */
export default function PaymentForm({ order, onDone, regLabel = "ACCA / ICAP registration number" }) {
  const { site, user, toast } = useApp();
  const accounts = site?.payment_accounts || [];
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ method: PAY_METHODS[0], paid_from: "", account_title: user?.name || "", account_number: "", paid_to: accounts[0] ? `${accounts[0].provider} — ${accounts[0].account_number}` : "", transaction_ref: "", amount: order.total, paid_on: today, registration_no: order.registration_no || user?.registration_no || "", note: "" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pick = (e) => {
    const fl = e.target.files?.[0]; setFile(fl || null);
    setPreview(fl && fl.type.startsWith("image/") ? URL.createObjectURL(fl) : null);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setErr({ screenshot: "Please upload the payment screenshot or receipt." }); return; }
    setBusy(true); setErr({});
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v ?? ""));
    fd.append("screenshot", file);
    try {
      const r = await api.post(`/student/orders/${order.id}/payment`, fd);
      toast("Payment proof submitted. The admin will verify it shortly.");
      onDone?.(r.data.order);
    } catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="pay-form">
      <div className="pay-amount"><span>Amount to pay</span><strong>{pkr(order.total)}</strong><small>Order {order.order_no}</small></div>
      <div className="pay-accounts compact">
        {accounts.map((a) => (
          <div className="pay-account" key={a.id}>{a.type === "bank" ? <Landmark size={20} /> : <Smartphone size={20} />}
            <div><strong>{a.provider}</strong><span>{a.account_title}</span><code>{a.account_number}</code>{a.iban && <small>IBAN {a.iban}</small>}</div></div>
        ))}
      </div>
      <p className="fine">You can pay from any bank account or mobile app. After paying, fill in the details below and upload the screenshot.</p>
      <div className="form-grid">
        <Field label="Payment method" required error={err.method}><select value={f.method} onChange={set("method")}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Paid from (bank / app name)" required error={err.paid_from}><input value={f.paid_from} onChange={set("paid_from")} placeholder="e.g. HBL, Meezan, JazzCash" required /></Field>
        <Field label="Sender account title" required error={err.account_title}><input value={f.account_title} onChange={set("account_title")} required /></Field>
        <Field label="Sender account / mobile no." error={err.account_number} hint="Optional — last 4 digits are enough"><input value={f.account_number} onChange={set("account_number")} /></Field>
        <Field label="Paid to (college account)" error={err.paid_to}>
          <select value={f.paid_to} onChange={set("paid_to")}>{accounts.map((a) => <option key={a.id}>{`${a.provider} — ${a.account_number}`}</option>)}<option>Other</option></select>
        </Field>
        <Field label="Transaction ID / reference no." required error={err.transaction_ref}><input value={f.transaction_ref} onChange={set("transaction_ref")} required /></Field>
        <Field label="Amount paid (PKR)" required error={err.amount}><input type="number" min="1" value={f.amount} onChange={set("amount")} required /></Field>
        <Field label="Payment date" required error={err.paid_on}><input type="date" max={today} value={f.paid_on} onChange={set("paid_on")} required /></Field>
        <Field label={regLabel} error={err.registration_no} hint="If you are already registered with ACCA / ICAP"><input value={f.registration_no} onChange={set("registration_no")} /></Field>
        <Field label="Note for admin" error={err.note}><input value={f.note} onChange={set("note")} placeholder="Optional" /></Field>
        <Field label="Payment screenshot / receipt" required full error={err.screenshot} hint="JPG, PNG, WEBP or PDF — max 8 MB">
          <label className="file-drop">
            <input type="file" accept="image/*,application/pdf" onChange={pick} />
            {preview ? <img src={preview} alt="Payment screenshot preview" /> : <span>{file ? <><ImageIcon size={20} /> {file.name}</> : <><Upload size={20} /> Click to upload the screenshot</>}</span>}
          </label>
        </Field>
      </div>
      <Btn loading={busy} className="btn btn-primary btn-lg btn-block"><Upload size={18} /> Submit payment proof</Btn>
    </form>
  );
}
