import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, CalendarDays } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Modal, Btn } from "./ui";
import { pkr } from "../lib/format";

/** Mirchawala-style enrol flow: select session → (conflict: replace / keep) → added: checkout / buy more */
export default function EnrolFlow({ course, onClose }) {
  const { site, addToCart, setCartOpen } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState("session");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const program = site?.programs?.find((p) => p.id === course?.program_id);
  const sessions = program?.exam_sessions || [];

  useEffect(() => { setStep("session"); setSessionId(sessions[0]?.id || ""); }, [course?.id]); // eslint-disable-line

  if (!course) return null;
  const submit = async (replace = false) => {
    setBusy(true);
    const r = await addToCart(course.id, sessionId || null, replace);
    setBusy(false);
    if (r.conflict) setStep("conflict");
    else if (r.ok) setStep("added");
  };

  return (
    <Modal open={!!course} onClose={onClose} title={step === "added" ? "Added to cart" : step === "conflict" ? "Course already in cart" : "Select your session"} size="sm">
      {step === "session" && (
        <div className="enrol-step">
          <div className="enrol-course"><span className="tag">{course.code}</span><strong>{course.title}</strong><span>{pkr(course.fee)}</span></div>
          <p className="muted">Which exam attempt are you preparing for?</p>
          <div className="choice-list">
            {sessions.map((s) => (
              <label key={s.id} className={`choice ${String(sessionId) === String(s.id) ? "is-on" : ""}`}>
                <input type="radio" name="session" value={s.id} checked={String(sessionId) === String(s.id)} onChange={() => setSessionId(s.id)} />
                <CalendarDays size={18} /> {s.name} attempt
              </label>
            ))}
            {!sessions.length && <p className="muted">Sessions will be confirmed by the admissions office.</p>}
          </div>
          <Btn className="btn btn-primary btn-block" loading={busy} onClick={() => submit(false)}>Add to cart</Btn>
        </div>
      )}
      {step === "conflict" && (
        <div className="enrol-step">
          <p><strong>{course.code}</strong> is already in your cart. Do you want to replace it with the session you just selected?</p>
          <div className="btn-row">
            <Btn className="btn btn-primary" loading={busy} onClick={() => submit(true)}>Replace</Btn>
            <button className="btn btn-outline" onClick={onClose}>Keep existing</button>
          </div>
        </div>
      )}
      {step === "added" && (
        <div className="enrol-step center">
          <CheckCircle2 size={52} className="ok-icon" />
          <p><strong>{course.code} {course.title}</strong> has been added to your cart.</p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => { onClose(); nav("/checkout"); }}>Proceed to checkout</button>
            <button className="btn btn-outline" onClick={() => { onClose(); setCartOpen(false); }}>Buy more courses</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
