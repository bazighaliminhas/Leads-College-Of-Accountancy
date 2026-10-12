import { useRef, useState, useEffect } from "react";
import { Modal } from "./ui";
import { useApp } from "../context/AppContext";
import { lines } from "../lib/format";

/** Agree button stays disabled until the student scrolls to the bottom (same as the reference flow). */
export default function TermsModal({ open, onClose, onAgree }) {
  const { s } = useApp();
  const ref = useRef(null);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => { if (open) setAtEnd(false); }, [open]);
  const onScroll = () => {
    const el = ref.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setAtEnd(true);
  };
  return (
    <Modal open={open} onClose={onClose} title="Terms, Privacy & Refund Policy" size="md"
      footer={<>
        <span className="fine">{atEnd ? "Thank you for reading." : "Scroll to the end to continue."}</span>
        <button className="btn btn-primary" disabled={!atEnd} onClick={() => { onAgree(); onClose(); }}>I have read &amp; agree</button>
      </>}>
      <div className="terms-scroll" ref={ref} onScroll={onScroll}>
        <h4>Terms &amp; conditions</h4>
        <ol>{lines(s("terms")).map((l, i) => <li key={i}>{l}</li>)}</ol>
        <h4>Fee &amp; refund policy</h4>
        <ul>{lines(s("fee_notes")).map((l, i) => <li key={i}>{l}</li>)}</ul>
        <h4>Privacy</h4>
        <ul>{lines(s("privacy")).map((l, i) => <li key={i}>{l}</li>)}</ul>
        <p className="fine">By agreeing you confirm that the information you provide is correct and that you accept the policies of Leads College of Accountancy.</p>
      </div>
    </Modal>
  );
}
