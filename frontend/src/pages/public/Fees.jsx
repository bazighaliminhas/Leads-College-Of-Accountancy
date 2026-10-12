import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { api } from "../../lib/api";
import { pkr, lines } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import { Spinner } from "../../components/ui";

export default function Fees() {
  const { s } = useApp();
  const [acca, setAcca] = useState(null);
  const [ca, setCa] = useState(null);
  useEffect(() => { api.get("/programs/acca").then((r) => setAcca(r.data)); api.get("/programs/ca").then((r) => setCa(r.data)); }, []);

  const sum = (list, k) => list.reduce((a, c) => a + Number(c[k] ?? c.fee ?? 0), 0);
  const caLevel = (slug) => ca?.levels.find((l) => l.slug === slug)?.courses.filter((c) => c.fee != null) || [];
  const prc = caLevel("prc"), hoc = caLevel("hoc"), cafA = caLevel("caf-a");
  const prcG = sum(prc, "fee") + Number(ca?.registration_fee || 0), prcS = sum(prc, "scholarship_fee") + Number(ca?.registration_fee_scholarship ?? ca?.registration_fee ?? 0);
  const hocG = sum(hoc, "fee"), hocS = sum(hoc, "scholarship_fee");
  const cafG = sum(cafA, "fee"), cafS = sum(cafA, "scholarship_fee");

  return (
    <>
      <section className="page-hero slim"><div className="container"><span className="eyebrow">Learn • Lead • Achieve</span><h1>Fee structure</h1><p>Transparent per-paper fees for ACCA and CA (ICAP). Fees are in Pakistani Rupees.</p></div></section>
      <section className="section"><div className="container fees">
        {!acca || !ca ? <Spinner /> : (
          <>
            <div className="fee-card">
              <div className="fee-head"><h2>ACCA fee structure</h2><Link to="/?program=acca#courses" className="btn btn-primary btn-sm">Enrol in ACCA</Link></div>
              <div className="table-wrap"><table className="table fee-table">
                <thead><tr><th>Code</th><th>Paper name</th><th className="num">Fee</th></tr></thead>
                <tbody>
                  {(acca.levels || []).map((l) => (
                    <FeeRows key={l.id} title={l.name} rows={l.courses || []} first={l.sort_order === 0 ? { code: "Reg", title: "College Registration Fee", fee: acca.registration_fee } : null} />
                  ))}
                </tbody>
              </table></div>
            </div>

            <div className="fee-card">
              <div className="fee-head"><h2>CA (ICAP) fee structure</h2><Link to="/?program=ca#courses" className="btn btn-primary btn-sm">Enrol in CA</Link></div>
              {[["prc", "1. PRC fee structure", prc, true], ["hoc", "2. Mandatory Hands-on Courses (HOC)", hoc], ["caf-a", "3. CAF fee structure (Group A)", cafA]].map(([k, t, rows, reg]) => (
                <div key={k} className="table-wrap mb"><table className="table fee-table">
                  <thead><tr><th colSpan={2}>{t}</th><th className="num">Gross fee</th><th className="num">After scholarship</th></tr></thead>
                  <tbody>
                    {rows.map((c) => <tr key={c.id}><td><strong>{c.code}</strong></td><td><Link to={`/course/${c.slug}`}>{c.title}</Link></td><td className="num">{pkr(c.fee)}</td><td className="num">{pkr(c.scholarship_fee ?? c.fee)}</td></tr>)}
                    {reg && <tr><td><strong>REG</strong></td><td>College Registration Fee</td><td className="num">{pkr(ca.registration_fee)}</td><td className="num">{pkr(ca.registration_fee_scholarship ?? ca.registration_fee)}</td></tr>}
                    <tr className="total-row"><td colSpan={2}>Total fee (PKR)</td><td className="num">{pkr(sum(rows, "fee") + (reg ? Number(ca.registration_fee) : 0))}</td><td className="num">{pkr(sum(rows, "scholarship_fee") + (reg ? Number(ca.registration_fee_scholarship ?? ca.registration_fee) : 0))}</td></tr>
                  </tbody>
                </table></div>
              ))}
              <div className="table-wrap mb"><table className="table fee-table">
                <thead><tr><th>4. Fee summary</th><th className="num">Gross fee</th><th className="num">After scholarship</th></tr></thead>
                <tbody>
                  <tr><td>PRC</td><td className="num">{pkr(prcG)}</td><td className="num">{pkr(prcS)}</td></tr>
                  <tr><td>HOC (Hands-on Courses)</td><td className="num">{pkr(hocG)}</td><td className="num">{pkr(hocS)}</td></tr>
                  <tr><td>CAF Group A</td><td className="num">{pkr(cafG)}</td><td className="num">{pkr(cafS)}</td></tr>
                </tbody>
              </table></div>
              <div className="table-wrap"><table className="table fee-table">
                <thead><tr><th>5. Package fee structure</th><th className="num">Gross fee</th><th className="num">After scholarship</th></tr></thead>
                <tbody>
                  <tr><td>PRC + HOC</td><td className="num">{pkr(prcG + hocG)}</td><td className="num">{pkr(prcS + hocS)}</td></tr>
                  <tr><td>PRC + HOC + CAF Group A</td><td className="num">{pkr(prcG + hocG + cafG)}</td><td className="num">{pkr(prcS + hocS + cafS)}</td></tr>
                </tbody>
              </table></div>
              <p className="fine">CAF Group B, CFAP and QAT classes: fee on request — please contact the admissions office.</p>
            </div>

            <div className="note-card">
              <h3><Info size={20} /> Important notes</h3>
              <ul>{lines(s("fee_notes")).map((l, i) => <li key={i}>{l}</li>)}</ul>
              <p className="fine">Online admission charges the gross fee. Scholarships are approved by the college after verification of documents.</p>
            </div>
          </>
        )}
      </div></section>
    </>
  );
}

function FeeRows({ title, rows, first }) {
  return (
    <>
      <tr className="group-row"><td colSpan={3}>{title}</td></tr>
      {first && <tr><td><strong>{first.code}</strong></td><td>{first.title}</td><td className="num">{pkr(first.fee)}</td></tr>}
      {rows.map((c) => <tr key={c.id}><td><strong>{c.code}</strong></td><td><Link to={`/course/${c.slug}`}>{c.title}</Link></td><td className="num">{pkr(c.fee)}</td></tr>)}
    </>
  );
}
