import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, CheckCircle2, LayoutDashboard, Lock } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { api, errMsg, fieldErrors } from "../../lib/api";
import { pkr } from "../../lib/format";
import { COUNTRIES } from "../../lib/countries";
import { Field, Btn, Empty } from "../../components/ui";
import { CartSummary } from "../../components/CartPanel";
import TermsModal from "../../components/TermsModal";
import PaymentForm from "../../components/PaymentForm";
import { LoginForm, RegisterForm } from "./Auth";

export default function Checkout() {
  const { cart, user, site, toast, refreshCart } = useApp();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [done, setDone] = useState(false);
  const [authTab, setAuthTab] = useState("register");
  const step = done ? 4 : order ? 3 : user ? 2 : 1;

  const regLabel = useMemo(() => {
    const ids = [...new Set(cart.items.map((i) => i.program))];
    const ps = (site?.programs || []).filter((p) => ids.includes(p.name));
    return ps.map((p) => p.registration_no_label).filter(Boolean).join(" / ") || "ACCA / ICAP registration number";
  }, [cart, site]);

  if (!order && !cart.count) {
    return <section className="section"><div className="container narrow"><Empty icon={ShoppingCart} title="Your cart is empty" text="Add ACCA or CA papers to your cart to start your admission." action={<Link to="/#courses" className="btn btn-primary">Browse courses</Link>} /></div></section>;
  }

  return (
    <section className="section checkout">
      <div className="container">
        <h1 className="page-title">Checkout</h1>
        <ol className="stepper">
          {["Account", "Your details", "Payment", "Done"].map((t, i) => <li key={t} className={step > i + 1 ? "done" : step === i + 1 ? "on" : ""}><span>{i + 1}</span>{t}</li>)}
        </ol>
        <div className="checkout-layout">
          <div className="checkout-main card">
            {step === 1 && (
              <>
                <h2>Create an account or log in</h2>
                <p className="muted">Your cart is saved. Register as a new student or log in to continue.</p>
                <div className="seg">
                  <button className={authTab === "register" ? "on" : ""} onClick={() => setAuthTab("register")}>New student</button>
                  <button className={authTab === "login" ? "on" : ""} onClick={() => setAuthTab("login")}>I have an account</button>
                </div>
                {authTab === "register" ? <RegisterForm /> : <LoginForm />}
              </>
            )}
            {step === 2 && (user.role !== "student"
              ? <Empty icon={Lock} title="Student account required" text={`You are logged in as ${user.role}. Please log in with a student account to enrol.`} />
              : <DetailsForm regLabel={regLabel} onPlaced={(o) => { setOrder(o); refreshCart(); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
            {step === 3 && (
              <>
                <h2>Pay &amp; upload proof</h2>
                <p className="muted">Order <strong>{order.order_no}</strong> has been saved. Pay {pkr(order.total)} from any bank or app, then upload the screenshot.</p>
                <PaymentForm order={order} regLabel={regLabel} onDone={() => { setDone(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                <button className="btn btn-link mt" onClick={() => { toast("You can upload the payment proof later from My Orders."); nav("/student/orders"); }}>I'll pay later — go to my orders</button>
              </>
            )}
            {step === 4 && (
              <div className="center success">
                <CheckCircle2 size={64} className="ok-icon" />
                <h2>Admission request submitted!</h2>
                <p>Order <strong>{order.order_no}</strong> and your payment proof have been received.</p>
                <p className="muted">The admin will verify your payment and grant access to your courses. You will see the status and a notification in your dashboard.</p>
                <Link className="btn btn-primary btn-lg" to="/student"><LayoutDashboard size={18} /> Go to my dashboard</Link>
              </div>
            )}
          </div>
          <aside className="checkout-side">
            <div className="side-card sticky">
              <h3>Order summary</h3>
              {order ? <OrderLines order={order} /> : <CartSummary compact showCheckout={false} />}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function OrderLines({ order }) {
  return (
    <div className="cart-summary">
      <ul className="cart-lines">{order.items.map((i) => <li key={i.id}><div><span className="tag">{i.code}</span><strong>{i.title}</strong>{i.session_name && <small>{i.session_name} attempt</small>}</div><span>{pkr(i.price)}</span></li>)}</ul>
      <dl className="totals"><div className="grand"><dt>Total payable</dt><dd>{pkr(order.total)}</dd></div></dl>
    </div>
  );
}

function DetailsForm({ onPlaced, regLabel }) {
  const { user, toast } = useApp();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", phone: "", dob: "", cnic: "", city: "", country: "Pakistan", address: "", registration_no: "", qualification: "", notes: "", agree: false });
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user) setF((x) => ({ ...x, ...Object.fromEntries(["first_name", "last_name", "email", "phone", "dob", "cnic", "city", "country", "address", "registration_no", "qualification"].map((k) => [k, user[k] || x[k]])) }));
  }, [user]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!f.agree) { setErr({ agree: "Please read and accept the terms." }); return; }
    setBusy(true); setErr({});
    try { const r = await api.post("/student/checkout", f); toast("Order saved. Now upload your payment proof."); onPlaced(r.data.order); }
    catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <h2>Your details</h2>
      <p className="muted">These details are saved with your admission record.</p>
      <div className="form-grid">
        <Field label="First name" required error={err.first_name}><input value={f.first_name} onChange={set("first_name")} required /></Field>
        <Field label="Last name" required error={err.last_name}><input value={f.last_name} onChange={set("last_name")} required /></Field>
        <Field label="Email address" required error={err.email}><input type="email" value={f.email} onChange={set("email")} required /></Field>
        <Field label="Phone / WhatsApp" required error={err.phone}><input value={f.phone} onChange={set("phone")} required /></Field>
        <Field label="Date of birth" required error={err.dob}><input type="date" value={f.dob || ""} onChange={set("dob")} required /></Field>
        <Field label="CNIC / B-Form" error={err.cnic}><input value={f.cnic || ""} onChange={set("cnic")} placeholder="35202-0000000-0" /></Field>
        <Field label="City" required error={err.city}><input value={f.city || ""} onChange={set("city")} required /></Field>
        <Field label="Country" required error={err.country}><select value={f.country || "Pakistan"} onChange={set("country")}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label={regLabel} error={err.registration_no} hint="Leave empty if you have not registered yet"><input value={f.registration_no || ""} onChange={set("registration_no")} /></Field>
        <Field label="Last qualification" error={err.qualification}><input value={f.qualification || ""} onChange={set("qualification")} /></Field>
        <Field label="Address" full error={err.address}><input value={f.address || ""} onChange={set("address")} /></Field>
        <Field label="Notes" full error={err.notes}><textarea rows={2} value={f.notes} onChange={set("notes")} placeholder="Anything the admissions office should know (optional)" /></Field>
      </div>
      <label className={`agree ${err.agree ? "has-error" : ""}`}>
        <input type="checkbox" checked={f.agree} onChange={(e) => (e.target.checked ? setTerms(true) : setF({ ...f, agree: false }))} />
        <span>I agree to the <button type="button" className="btn-link" onClick={() => setTerms(true)}>Terms, Privacy and Refund Policy</button></span>
      </label>
      {err.agree && <p className="field-error">{err.agree}</p>}
      <Btn loading={busy} className="btn btn-primary btn-lg btn-block"><Lock size={18} /> Continue to payment</Btn>
      <TermsModal open={terms} onClose={() => setTerms(false)} onAgree={() => setF((x) => ({ ...x, agree: true }))} />
    </form>
  );
}
