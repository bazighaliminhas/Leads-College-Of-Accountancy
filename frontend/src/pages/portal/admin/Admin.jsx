import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, GraduationCap, BookOpen, Receipt, Hourglass, Wallet, KeyRound, MessageSquare, CheckCircle2, XCircle, FileText, UserCheck, Link2, PlayCircle, Ban, Unlock, Lock, Video, ListChecks, Send, Mail, Sparkles, Plug, RefreshCw, AlertTriangle, Settings2 } from "lucide-react";
import { api, errMsg } from "../../../lib/api";
import { useApp } from "../../../context/AppContext";
import { pkr, dateTime, date } from "../../../lib/format";
import { Badge, Spinner, Modal, Field, Btn, Empty } from "../../../components/ui";
import LessonForm from "../../../components/LessonForm";
import { PageHead, Stat } from "../PortalLayout";
import { LiveWidget, GoogleConnect } from "../live/Live";
import ResourceManager, { AutoForm } from "./ResourceManager";
import { useAdminOptions } from "./options";

const progOpts = (o) => (o.programs || []).map((p) => [p.id, p.name]);
const levelOpts = (o) => (o.levels || []).filter((l) => !o.form?.program_id || String(l.program_id) === String(o.form.program_id)).map((l) => [l.id, l.name]);
const courseOpts = (o) => (o.courses || []).map((c) => [c.id, `${c.code} — ${c.title}`]);
const teacherOpts = (o) => (o.teachers || []).map((t) => [t.id, `${t.name} (${t.email})`]);
const studentOpts = (o) => (o.students || []).map((t) => [t.id, `${t.name} (${t.email})`]);
const sessionOpts = (o) => (o.sessions || []).map((s) => [s.id, `${(o.programs || []).find((p) => p.id === s.program_id)?.name || ""} ${s.name}`]);
const who = (u) => (u ? <><strong>{u.name}</strong><br /><small className="muted">{u.email}</small></> : "—");

/* ---------------- Overview ---------------- */
export function AdminHome() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setD(r.data)); }, []);
  if (!d) return <Spinner />;
  const c = d.counts;
  const max = Math.max(1, ...d.months.map((m) => m.revenue));
  return (
    <>
      <PageHead title="Admin dashboard" sub="Full control over admissions, payments, course access, users and content." />
      {c.awaiting_review > 0 && <div className="alert alert-warn"><Hourglass size={18} /> {c.awaiting_review} payment proof(s) are waiting for your review. <Link to="/admin/orders">Review now →</Link></div>}
      <div className="stats">
        <Stat icon={Receipt} label="Payments to review" value={c.awaiting_review} tone="amber" to="/admin/orders" />
        <Stat icon={KeyRound} label="Access requests pending" value={c.pending_access} tone="red" to="/admin/access" />
        <Stat icon={Wallet} label="Verified revenue" value={pkr(c.revenue)} tone="green" to="/admin/payments" />
        <Stat icon={GraduationCap} label="Students" value={c.students} to="/admin/students" />
        <Stat icon={Users} label="Teachers" value={c.teachers} to="/admin/teachers" />
        <Stat icon={BookOpen} label={`Courses (${c.pending_courses} pending)`} value={c.courses} to="/admin/courses" />
        <Stat icon={UserCheck} label="Active enrolments" value={c.active_enrollments} tone="green" to="/admin/access" />
        <Stat icon={MessageSquare} label="New messages / inquiries" value={`${c.new_messages} / ${c.new_inquiries}`} to="/admin/messages" />
        <Stat icon={Video} label="Upcoming live classes" value={c.live_upcoming} tone="red" to="/admin/live" />
        <Stat icon={ListChecks} label="Quizzes" value={c.quizzes} to="/admin/quizzes" />
        <Stat icon={Send} label="WhatsApp + email sent (7 days)" value={c.messages_sent} tone="green" to="/admin/message-log" />
        <Stat icon={AlertTriangle} label="Failed messages (7 days)" value={c.messages_failed} tone={c.messages_failed ? "amber" : "navy"} to="/admin/integrations" />
      </div>
      <div className="grid-2-1">
        <div className="card">
          <h3>Verified revenue — last 6 months</h3>
          <div className="bars">{d.months.map((m) => (
            <div className="bar" key={m.month}><span className="bar-val">{m.revenue ? pkr(m.revenue).replace("PKR ", "") : ""}</span><div style={{ height: `${(m.revenue / max) * 100}%` }} /><small>{m.month.split(" ")[0]}</small><em>{m.orders} orders</em></div>
          ))}</div>
        </div>
        <div className="card">
          <h3>Active enrolments by programme</h3>
          {!d.by_program.length ? <p className="muted">No active enrolments yet.</p> : d.by_program.map((p) => <div className="kv-row" key={p.name}><span>{p.name}</span><strong>{p.total}</strong></div>)}
          <h3 className="mt">Quick actions</h3>
          <div className="quick">
            <Link to="/admin/teachers" className="btn btn-outline btn-sm">Create teacher login</Link>
            <Link to="/admin/live?new=1" className="btn btn-outline btn-sm">Schedule live class</Link>
            <Link to="/admin/integrations" className="btn btn-outline btn-sm">WhatsApp / email / AI / Google</Link>
            <Link to="/admin/courses" className="btn btn-outline btn-sm">Add course</Link>
            <Link to="/admin/access" className="btn btn-outline btn-sm">Grant course access</Link>
            <Link to="/admin/payment-accounts" className="btn btn-outline btn-sm">Bank / wallet accounts</Link>
            <Link to="/admin/settings" className="btn btn-outline btn-sm">Website settings</Link>
          </div>
        </div>
      </div>
      <LiveWidget list={d.live} role="admin" />
      <div className="grid-2">
        <div className="card flush"><div className="card-head pad"><h3>Recent orders</h3><Link to="/admin/orders">All orders</Link></div>
          <div className="table-wrap"><table className="table compact"><tbody>{d.recent_orders.map((o) => <tr key={o.id}><td><strong>{o.order_no}</strong><br /><small className="muted">{o.user?.name}</small></td><td><Badge status={o.status} /></td><td className="num">{pkr(o.total)}</td></tr>)}</tbody></table></div></div>
        <div className="card flush"><div className="card-head pad"><h3>Latest activity</h3><Link to="/admin/activity">Activity log</Link></div>
          <ul className="activity">{d.recent_activity.map((a) => <li key={a.id}><span className="tag">{a.action}</span> {a.description} <small className="muted">— {a.user?.name || "Guest"} · {dateTime(a.created_at)}</small></li>)}</ul></div>
      </div>
    </>
  );
}

/* ---------------- Orders & payment review ---------------- */
export function AdminOrders() {
  const [review, setReview] = useState(null);
  const [key, setKey] = useState(0);
  return (
    <>
      <ResourceManager resource="orders" title="Orders & admissions" sub="Review payment proofs, verify payments and grant course access." reloadKey={key} canCreate={false}
        filters={[{ name: "status", label: "Status", options: [["payment_submitted", "Payment under review"], ["pending_payment", "Awaiting payment"], ["approved", "Approved"], ["rejected", "Rejected"], ["cancelled", "Cancelled"]] }]}
        columns={[
          { key: "order_no", label: "Order", render: (r) => <><strong>{r.order_no}</strong><br /><small className="muted">{dateTime(r.created_at)}</small></> },
          { key: "first_name", label: "Student", render: (r) => <><strong>{r.first_name} {r.last_name}</strong><br /><small className="muted">{r.email} · {r.phone}</small></>, csv: (r) => `${r.first_name} ${r.last_name}` },
          { key: "items", label: "Papers", render: (r) => r.items.filter((i) => i.item_type === "course").map((i) => <span key={i.id} className="tag">{i.code}</span>), csv: (r) => r.items.map((i) => i.code).join(" ") },
          { key: "total", label: "Total", type: "money" },
          { key: "payments", label: "Proof", render: (r) => r.payments.length ? <span className="tag">{r.payments.length} upload(s)</span> : <span className="muted">—</span>, csv: (r) => r.payments.length },
          { key: "status", label: "Status", type: "status" },
        ]}
        rowActions={(r) => <button className="btn btn-sm btn-primary" onClick={() => setReview(r)}>Review</button>}
        fields={[
          { name: "status", label: "Status", type: "select", options: [["pending_payment", "Awaiting payment"], ["payment_submitted", "Payment under review"], ["approved", "Approved"], ["rejected", "Rejected"], ["cancelled", "Cancelled"]], required: true },
          { name: "first_name", label: "First name", required: true }, { name: "last_name", label: "Last name" },
          { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone", required: true },
          { name: "dob", label: "Date of birth", type: "date" }, { name: "cnic", label: "CNIC" }, { name: "city", label: "City" }, { name: "country", label: "Country" },
          { name: "registration_no", label: "Registration no." }, { name: "qualification", label: "Qualification" }, { name: "address", label: "Address", full: true },
          { name: "subtotal", label: "Subtotal", type: "number", required: true }, { name: "registration_fee", label: "Registration fee", type: "number", required: true }, { name: "total", label: "Total", type: "number", required: true },
          { name: "notes", label: "Student notes", type: "textarea" }, { name: "admin_remarks", label: "Admin remarks", type: "textarea" },
        ]} />
      <OrderReview order={review} onClose={() => setReview(null)} onDone={() => { setReview(null); setKey((k) => k + 1); }} />
    </>
  );
}

function OrderReview({ order, onClose, onDone }) {
  const { toast } = useApp();
  const [remarks, setRemarks] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(null);
  const [waText, setWaText] = useState("");
  const [showWa, setShowWa] = useState(false);
  const [waBusy, setWaBusy] = useState(false);

  useEffect(() => { setRemarks(order?.admin_remarks || ""); setExpires(""); setShowWa(false); setWaText(""); }, [order]);
  if (!order) return null;
  const act = async (kind, grant = true) => {
    if (kind === "reject" && !remarks.trim()) { toast("Please write the reason for rejection in the remarks.", "bad"); return; }
    setBusy(kind + grant);
    try {
      if (kind === "approve") await api.post(`/admin/orders/${order.id}/approve`, { grant_access: grant, remarks, access_expires_on: expires || null });
      else await api.post(`/admin/orders/${order.id}/reject`, { remarks });
      toast(kind === "approve" ? (grant ? "Payment verified and course access granted (WhatsApp sent)" : "Payment verified") : "Order rejected — student notified via WhatsApp");
      onDone();
    } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(null); }
  };

  const sendDirectWa = async () => {
    if (!waText.trim()) return;
    setWaBusy(true);
    try {
      await api.post("/admin/whatsapp/send", { phone: order.phone, message: waText });
      toast("WhatsApp delivered to student successfully!");
      setWaText("");
      setShowWa(false);
    } catch (e) {
      toast(errMsg(e), "bad");
    } finally {
      setWaBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Review ${order.order_no}`} size="xl">
      <div className="review">
        <div>
          <h4>Student details</h4>
          <dl className="kv">
            {[["Name", `${order.first_name} ${order.last_name || ""}`], ["Account", order.user ? `${order.user.name} (@${order.user.username})` : "—"], ["Email", order.email], ["Phone / WhatsApp", order.phone ? <span>{order.phone} <a href={`https://wa.me/${order.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline" style={{ marginLeft: 6 }}>💬 Web</a></span> : "—"], ["Date of birth", date(order.dob)], ["CNIC", order.cnic], ["City / country", `${order.city || "—"}, ${order.country || "—"}`], ["Registration no.", order.registration_no], ["Qualification", order.qualification], ["Address", order.address], ["Notes", order.notes], ["Terms accepted", dateTime(order.agreed_terms_at)], ["IP", order.ip]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
          </dl>
          <h4>Order</h4>
          <div className="table-wrap">
            <table className="table compact"><tbody>
              {order.items.map((i) => <tr key={i.id}><td><span className="tag">{i.code}</span></td><td>{i.title}{i.session_name && <small className="muted"> · {i.session_name}</small>}</td><td className="num">{pkr(i.price)}</td></tr>)}
              <tr className="total-row"><td colSpan={2}>Total</td><td className="num">{pkr(order.total)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div>
          <h4>Payment proofs</h4>
          {!order.payments.length ? <Empty icon={Receipt} title="No payment proof uploaded yet" /> : order.payments.map((p) => (
            <div className="proof" key={p.id}>
              <a href={p.screenshot_url} target="_blank" rel="noreferrer">{/\.pdf$/i.test(p.screenshot_name || "") ? <span className="pdf-proof"><FileText /> Open PDF</span> : <img src={p.screenshot_url} alt="Payment screenshot" className="proof-img" />}</a>
              <dl className="kv small">
                {[["Amount", pkr(p.amount)], ["Method", p.method], ["Paid from", p.paid_from], ["Sender", `${p.account_title || ""} ${p.account_number || ""}`], ["Paid to", p.paid_to], ["Transaction ID", p.transaction_ref], ["Paid on", date(p.paid_on)], ["Submitted", dateTime(p.created_at)], ["Note", p.note]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
              </dl>
              <Badge status={p.status} />
              {Number(p.amount) < Number(order.total) && <p className="field-error">Amount is less than the order total ({pkr(order.total)}).</p>}
            </div>
          ))}
          <Field label="Remarks (shown to the student)"><textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Payment received, welcome! / Screenshot unclear, please re-upload" /></Field>
          <Field label="Course access valid until (optional)"><input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
          <div className="btn-col">
            <Btn loading={busy === "approvetrue"} className="btn btn-success btn-block" onClick={() => act("approve", true)}><CheckCircle2 size={18} /> Verify payment &amp; grant course access</Btn>
            <Btn loading={busy === "approvefalse"} className="btn btn-outline btn-block" onClick={() => act("approve", false)}>Verify payment only (grant access later)</Btn>
            <Btn loading={busy === "rejecttrue"} className="btn btn-danger btn-block" onClick={() => act("reject")}><XCircle size={18} /> Reject payment</Btn>
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border, #e2e8f0)" }}>
            {!showWa ? (
              <button type="button" className="btn btn-outline btn-block btn-sm" onClick={() => { setWaText(`Dear ${order.first_name},\nRegarding your application ${order.order_no} at Leads College of Accountancy: `); setShowWa(true); }}>
                💬 Send Direct WhatsApp to Student (Kapso)
              </button>
            ) : (
              <div style={{ background: "rgba(37, 211, 102, 0.06)", padding: 12, borderRadius: 8, border: "1px solid rgba(37, 211, 102, 0.25)" }}>
                <Field label={`Send WhatsApp to ${order.phone}`}><textarea rows={3} value={waText} onChange={(e) => setWaText(e.target.value)} /></Field>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn loading={waBusy} className="btn btn-primary btn-sm" onClick={sendDirectWa}>Send Message</Btn>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowWa(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Course access (enrolments) ---------------- */
export function AdminAccess() {
  const { toast } = useApp();
  const [key, setKey] = useState(0);
  const [manual, setManual] = useState(false);
  const set = async (r, status) => {
    try { await api.post(`/admin/enrollments/${r.id}/access`, { status, access_expires_on: r.access_expires_on }); toast(status === "active" ? "Access granted — student notified" : `Status changed to ${status}`); setKey((k) => k + 1); }
    catch (e) { toast(errMsg(e), "bad"); }
  };
  return (
    <>
      <ResourceManager resource="enrollments" title="Course access" sub="Give or take back permission for a student to open a course. Students see the change in their dashboard instantly." reloadKey={key}
        headerActions={<button className="btn btn-navy" onClick={() => setManual(true)}><UserCheck size={16} /> Enrol a student manually</button>} canCreate={false}
        filters={[{ name: "status", label: "Status", options: [["pending", "Awaiting permission"], ["active", "Access granted"], ["suspended", "Suspended"], ["completed", "Completed"], ["cancelled", "Cancelled"]] }, { name: "course_id", label: "Course", options: courseOpts }]}
        columns={[
          { key: "user", label: "Student", render: (r) => who(r.user), csv: (r) => r.user?.email },
          { key: "course", label: "Course", render: (r) => <><span className="tag">{r.course?.code}</span> {r.course?.title}</>, csv: (r) => r.course?.code },
          { key: "exam_session", label: "Session", render: (r) => r.exam_session?.name || "—", csv: (r) => r.exam_session?.name },
          { key: "order", label: "Order", render: (r) => r.order?.order_no || "Manual", csv: (r) => r.order?.order_no },
          { key: "progress", label: "Progress", render: (r) => `${r.progress}%`, num: true },
          { key: "granted_at", label: "Granted", render: (r) => r.granted_at ? <>{dateTime(r.granted_at)}<br /><small className="muted">by {r.granter?.name}</small></> : "—" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rowActions={(r) => <>
          {r.status !== "active" && <button className="btn btn-sm btn-success" onClick={() => set(r, "active")}><Unlock size={14} /> Grant</button>}
          {r.status === "active" && <button className="btn btn-sm btn-outline" onClick={() => set(r, "suspended")}><Lock size={14} /> Suspend</button>}
          {!["cancelled"].includes(r.status) && <button className="icon-btn danger" title="Cancel enrolment" onClick={() => confirm("Cancel this enrolment?") && set(r, "cancelled")}><Ban size={16} /></button>}
        </>}
        fields={[
          { name: "user_id", label: "Student", type: "select", options: studentOpts, required: true }, { name: "course_id", label: "Course", type: "select", options: courseOpts, required: true },
          { name: "exam_session_id", label: "Session", type: "select", options: sessionOpts }, { name: "status", label: "Status", type: "select", options: [["pending", "Awaiting permission"], ["active", "Access granted"], ["suspended", "Suspended"], ["completed", "Completed"], ["cancelled", "Cancelled"]], required: true },
          { name: "access_expires_on", label: "Access valid until", type: "date" }, { name: "progress", label: "Progress %", type: "number" }, { name: "remarks", label: "Remarks", type: "textarea" },
        ]} />
      <ManualEnrol open={manual} onClose={() => setManual(false)} onDone={() => { setManual(false); setKey((k) => k + 1); }} />
    </>
  );
}

function ManualEnrol({ open, onClose, onDone }) {
  const opts = useAdminOptions();
  const { toast } = useApp();
  const [f, setF] = useState({ user_id: "", course_ids: [], status: "active", exam_session_id: "" });
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setF({ ...f, course_ids: f.course_ids.includes(id) ? f.course_ids.filter((x) => x !== id) : [...f.course_ids, id] });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/admin/enroll", { ...f, exam_session_id: f.exam_session_id || null }); toast("Student enrolled"); onDone(); } catch (er) { toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Enrol a student manually" size="lg">
      <form onSubmit={submit}>
        <p className="muted">Use this for students who paid at the campus. Access is granted immediately.</p>
        <div className="form-grid">
          <Field label="Student" required><select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })} required><option value="">— select —</option>{studentOpts(opts).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Access"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Grant access now</option><option value="pending">Pending (grant later)</option></select></Field>
          <Field label="Session"><select value={f.exam_session_id} onChange={(e) => setF({ ...f, exam_session_id: e.target.value })}><option value="">—</option>{sessionOpts(opts).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        </div>
        <Field label="Courses" full>
          <div className="check-grid">{(opts.courses || []).map((c) => <label key={c.id} className="check"><input type="checkbox" checked={f.course_ids.includes(c.id)} onChange={() => toggle(c.id)} /> <span className="tag">{c.code}</span> {c.title}</label>)}</div>
        </Field>
        <Btn loading={busy} disabled={!f.user_id || !f.course_ids.length}>Enrol student</Btn>
      </form>
    </Modal>
  );
}

/* ---------------- Users ---------------- */
const userFields = (role) => [
  { name: "first_name", label: "First name", required: true }, { name: "last_name", label: "Last name" },
  { name: "username", label: "Username (login)", required: true }, { name: "email", label: "Email (login)", type: "email", required: true },
  { name: "password", label: "Password", type: "password", required: true },
  { name: "status", label: "Account status", type: "select", options: [["active", "Active"], ["blocked", "Blocked"]], required: true, default: "active" },
  { name: "phone", label: "Phone / WhatsApp" },
  ...(role === "student" ? [{ name: "father_name", label: "Father's name" }, { name: "dob", label: "Date of birth", type: "date" }, { name: "cnic", label: "CNIC" }, { name: "registration_no", label: "ACCA / ICAP registration no." }, { name: "qualification", label: "Qualification" }] : []),
  ...(role === "teacher" ? [
    { name: "course_ids", label: "Courses this teacher teaches", type: "courses", full: true, hint: "The teacher can only see, upload lectures, create quizzes and schedule live classes for these courses." },
    { name: "designation", label: "Designation" }, { name: "specialization", label: "Specialization" }, { name: "qualification", label: "Qualification" }, { name: "bio", label: "Bio (shown on website)", type: "textarea" },
    { name: "send_credentials", label: "Login details", type: "checkbox", checkLabel: "Send username, password and course list to the teacher by WhatsApp + email", full: true }] : []),
  { name: "city", label: "City" }, { name: "country", label: "Country" }, { name: "address", label: "Address", full: true },
  { name: "avatar", label: "Photo", type: "image" },
];
const userCols = [
  { key: "name", label: "Name", render: (r) => <><strong>{r.name}</strong><br /><small className="muted">@{r.username}</small></> },
  { key: "email", label: "Email / phone", render: (r) => <>{r.email}<br /><small className="muted">{r.phone}</small></>, csv: (r) => r.email },
  { key: "last_login_at", label: "Last login", type: "date" },
  { key: "status", label: "Status", type: "status" },
];

export function AdminUsers({ role }) {
  const [assign, setAssign] = useState(null);
  const titles = { student: ["Students", "Edit student details, usernames and passwords, or block accounts."], teacher: ["Teachers", "Create a teacher login and tick the courses they teach — that is exactly what the teacher sees and can upload lectures, quizzes and live classes for."], admin: ["Administrators", "People with full access to this admin panel."] };
  return (
    <>
      <ResourceManager key={role} resource="users" title={titles[role][0]} sub={titles[role][1]} fixed={{ role }} defaults={{ status: "active" }} fields={userFields(role)}
        filters={[{ name: "status", label: "Status", options: [["active", "Active"], ["blocked", "Blocked"]] }]}
        columns={[...userCols.slice(0, 2), ...(role === "student" ? [{ key: "registration_no", label: "Reg. no." }, { key: "city", label: "City" }] : role === "teacher" ? [{ key: "teaching_courses", label: "Teaches", render: (r) => r.teaching_courses?.length ? <div className="tag-wrap">{r.teaching_courses.map((c) => <span key={c.id} className="tag" title={c.title}>{c.code}</span>)}</div> : <span className="badge badge-warn">No course assigned</span>, csv: (r) => (r.teaching_courses || []).map((c) => c.code).join(" ") }] : []), ...userCols.slice(2)]}
        rowActions={role === "teacher" ? (r) => <button className="btn btn-sm btn-outline" onClick={() => setAssign(r)}><Link2 size={14} /> Courses</button> : undefined} />
      {assign && <TeacherCourses teacher={assign} onClose={() => setAssign(null)} />}
    </>
  );
}

function TeacherCourses({ teacher, onClose }) {
  const opts = useAdminOptions();
  const { toast } = useApp();
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/r/course-teachers", { params: { teacher_id: teacher.id, per_page: 500 } }).then((r) => { setRows(r.data.data); setSel(r.data.data.map((x) => x.course_id)); }); }, [teacher.id]);
  const save = async () => {
    setBusy(true);
    try {
      const cur = rows.map((x) => x.course_id);
      for (const id of sel.filter((x) => !cur.includes(x))) await api.post("/admin/r/course-teachers", { course_id: id, teacher_id: teacher.id, can_upload: true });
      for (const r of rows.filter((x) => !sel.includes(x.course_id))) await api.delete(`/admin/r/course-teachers/${r.id}`);
      toast("Course assignments saved"); onClose();
    } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Courses assigned to ${teacher.name}`} size="lg" footer={<Btn loading={busy} onClick={save}>Save assignments</Btn>}>
      <p className="muted">The teacher can upload videos, notes and announcements for the selected courses.</p>
      {!rows ? <Spinner /> : (opts.programs || []).map((p) => (
        <div key={p.id} className="mb"><h4>{p.name}</h4><div className="check-grid">
          {(opts.courses || []).filter((c) => c.program_id === p.id).map((c) => <label key={c.id} className="check"><input type="checkbox" checked={sel.includes(c.id)} onChange={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} /> <span className="tag">{c.code}</span> {c.title}</label>)}
        </div></div>
      ))}
    </Modal>
  );
}

/* ---------------- Courses & lessons ---------------- */
export function AdminCourses() {
  const opts = useAdminOptions();
  const { toast } = useApp();
  const [assign, setAssign] = useState(null);
  const [key, setKey] = useState(0);
  return (
    <>
      <ResourceManager resource="courses" title="Courses" sub="All ACCA and CA papers. Approve courses added by teachers by setting them to Published." reloadKey={key} defaults={{ status: "published", is_purchasable: true, language: "English / Urdu" }}
        filters={[{ name: "program_id", label: "Programme", options: progOpts }, { name: "level_id", label: "Level", options: levelOpts }, { name: "status", label: "Status", options: [["published", "Published"], ["pending", "Pending approval"], ["draft", "Draft"]] }]}
        columns={[
          { key: "code", label: "Code", render: (r) => <span className="tag">{r.code}</span> },
          { key: "title", label: "Course", render: (r) => <><strong>{r.title}</strong><br /><small className="muted">{r.program?.name} · {r.level?.name}</small></> },
          { key: "teachers", label: "Teachers", render: (r) => r.teachers?.map((t) => t.name).join(", ") || <span className="muted">none</span>, csv: (r) => r.teachers?.map((t) => t.name).join("; ") },
          { key: "fee", label: "Fee", type: "money" },
          { key: "lessons_count", label: "Lectures", num: true },
          { key: "enrollments_count", label: "Students", num: true },
          { key: "status", label: "Status", type: "status" },
        ]}
        rowActions={(r) => <>
          {r.status === "pending" && <button className="btn btn-sm btn-success" onClick={async () => { await api.post(`/admin/r/courses/${r.id}`, { status: "published" }); toast("Course published"); setKey((k) => k + 1); }}>Approve</button>}
          <button className="btn btn-sm btn-outline" onClick={() => setAssign(r)}><Users size={14} /> Teachers</button>
          <Link className="btn btn-sm btn-primary" to={`/admin/courses/${r.id}`}><PlayCircle size={14} /> Content</Link>
        </>}
        fields={[
          { name: "program_id", label: "Programme", type: "select", options: progOpts, required: true }, { name: "level_id", label: "Level", type: "select", options: levelOpts },
          { name: "code", label: "Paper code", required: true }, { name: "title", label: "Title", required: true }, { name: "slug", label: "URL slug", hint: "Auto-generated if empty" },
          { name: "fee", label: "Fee (PKR)", type: "number", hint: "Leave empty for 'fee on request'" }, { name: "scholarship_fee", label: "Fee after scholarship (PKR)", type: "number" },
          { name: "status", label: "Status", type: "select", options: [["published", "Published"], ["pending", "Pending approval"], ["draft", "Draft"]], required: true },
          { name: "is_purchasable", label: "Online enrolment", type: "checkbox", checkLabel: "Students can add to cart", default: true }, { name: "is_featured", label: "Featured", type: "checkbox", checkLabel: "Show in popular courses" },
          { name: "exam_duration", label: "Exam duration" }, { name: "pass_mark", label: "Pass mark" }, { name: "exam_format", label: "Exam format", full: true },
          { name: "class_duration", label: "Class duration" }, { name: "language", label: "Language" }, { name: "sort_order", label: "Sort order", type: "number" },
          { name: "short_description", label: "Short description", full: true }, { name: "about", label: "About this exam", type: "textarea" },
          { name: "learn", label: "What you will learn", type: "lines" }, { name: "structure", label: "Exam structure", type: "lines" }, { name: "image", label: "Cover image", type: "image" },
        ]} />
      {assign && <AssignTeachers course={assign} teachers={opts.teachers || []} onClose={() => { setAssign(null); setKey((k) => k + 1); }} />}
    </>
  );
}

function AssignTeachers({ course, teachers, onClose }) {
  const { toast } = useApp();
  const [sel, setSel] = useState(course.teachers.map((t) => t.id));
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.post(`/admin/courses/${course.id}/teachers`, { teacher_ids: sel }); toast("Teachers assigned"); onClose(); } catch (e) { toast(errMsg(e), "bad"); } finally { setBusy(false); } };
  return (
    <Modal open onClose={onClose} title={`Teachers for ${course.code}`} footer={<Btn loading={busy} onClick={save}>Save</Btn>}>
      {!teachers.length ? <Empty title="No teachers yet" text="Create a teacher login first." action={<Link to="/admin/teachers" className="btn btn-primary btn-sm">Add teacher</Link>} /> :
        <div className="check-grid one">{teachers.map((t) => <label key={t.id} className="check"><input type="checkbox" checked={sel.includes(t.id)} onChange={() => setSel(sel.includes(t.id) ? sel.filter((x) => x !== t.id) : [...sel, t.id])} /> {t.name} <small className="muted">{t.email}</small></label>)}</div>}
    </Modal>
  );
}

export function AdminLessons() {
  const course = new URLSearchParams(location.search).get("course_id");
  return (
    <ResourceManager resource="lessons" title="Lessons & videos" sub="Every lecture, video and note uploaded for every course." fixed={course ? { course_id: course } : {}}
      filters={course ? [{ name: "type", label: "Type", options: ["video", "document", "text"] }] : [{ name: "course_id", label: "Course", options: courseOpts }, { name: "type", label: "Type", options: ["video", "document", "text"] }]}
      columns={[
        { key: "course", label: "Course", render: (r) => <span className="tag">{r.course?.code}</span>, csv: (r) => r.course?.code },
        { key: "title", label: "Lesson", render: (r) => <><strong>{r.title}</strong><br /><small className="muted">{r.chapter}</small></> },
        { key: "type", label: "Type" },
        { key: "files", label: "Files", render: (r) => <>{r.video_path && <span className="tag">video</span>} {r.video_url && <span className="tag">link</span>} {r.attachment_name && <span className="tag">notes</span>}</>, noExport: true },
        { key: "uploader", label: "Uploaded by", render: (r) => r.uploader?.name || "—", csv: (r) => r.uploader?.name },
        { key: "is_published", label: "Published", type: "bool" },
      ]}
      renderForm={(row, done) => <AdminLessonForm row={row} course={course} done={done} />} />
  );
}

function AdminLessonForm({ row, course, done }) {
  const opts = useAdminOptions();
  const [cid, setCid] = useState(row.course_id || course || "");
  const [full, setFull] = useState(row.id ? null : {});
  useEffect(() => { if (row.id) api.get(`/admin/r/lessons/${row.id}`).then((r) => setFull(r.data)); }, [row.id]);
  if (!full) return <Spinner />;
  return (
    <>
      <Field label="Course" required><select value={cid} onChange={(e) => setCid(e.target.value)}><option value="">— select —</option>{courseOpts(opts).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      {cid ? <LessonForm endpoint={row.id ? `/admin/r/lessons/${row.id}` : "/admin/r/lessons"} lesson={row.id ? full : null} courseId={cid} onSaved={done} /> : <p className="muted">Select a course first.</p>}
    </>
  );
}

/* ---------------- Settings ---------------- */
export function AdminSettings() {
  const { toast } = useApp();
  const [list, setList] = useState(null);
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/admin/settings").then((r) => { setList(r.data); setVals(Object.fromEntries(r.data.map((s) => [s.key, s.value ?? ""]))); }); }, []);
  if (!list) return <Spinner />;

  const groups = list.reduce((m, s) => { (m[s.group] ||= []).push(s); return m; }, {});
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api.post("/admin/settings", { settings: vals }); toast("Settings saved — refresh the website to see changes"); } catch (er) { toast(errMsg(er), "bad"); } finally { setBusy(false); } };
  return (
    <form onSubmit={save}>
      <PageHead title="Website settings" sub="Contact details, promo text, fee notes, payment instructions, terms and privacy policy." actions={<Btn loading={busy}>Save settings</Btn>} />

      <div className="alert alert-info"><Plug size={18} /> WhatsApp, email, AI and Google Meet are managed in <Link to="/admin/integrations">Integrations</Link>.</div>

      {Object.entries(groups).map(([g, items]) => (
        <div className="card" key={g}><h3 className="cap">{g}</h3><div className="form-grid">
          {items.map((s) => {
            const long = String(vals[s.key] || "").length > 80 || ["terms", "privacy", "fee_notes", "payment_instructions", "hero_subtitle"].includes(s.key);
            return <Field key={s.key} label={s.label || s.key} full={long} hint={s.key}>{long ? <textarea rows={["terms", "privacy", "fee_notes"].includes(s.key) ? 8 : 3} value={vals[s.key]} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} /> : <input value={vals[s.key]} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} />}</Field>;
          })}
        </div></div>
      ))}
      <Btn loading={busy}>Save settings</Btn>
    </form>
  );
}

/* ---------------- Simple resources ---------------- */
export const simple = {
  programs: () => <ResourceManager resource="programs" title="Programmes" sub="ACCA and CA programme details, registration fees and overview content."
    columns={[{ key: "name", label: "Name" }, { key: "full_name", label: "Full name" }, { key: "registration_fee", label: "Registration fee", type: "money" }, { key: "status", label: "Status" }]}
    fields={[{ name: "name", label: "Short name", required: true }, { name: "slug", label: "Slug (URL)", required: true }, { name: "full_name", label: "Full name" }, { name: "awarding_body", label: "Awarding body" }, { name: "tagline", label: "Tagline", full: true },
      { name: "registration_fee", label: "College registration fee", type: "number", required: true }, { name: "registration_fee_scholarship", label: "Registration fee after scholarship", type: "number" }, { name: "registration_no_label", label: "Registration no. label" },
      { name: "status", label: "Status", type: "select", options: ["active", "inactive"], required: true, default: "active" }, { name: "sort_order", label: "Sort order", type: "number" },
      { name: "description", label: "Description", type: "textarea" }, { name: "overview", label: "Overview sections (JSON)", type: "json", hint: '[{"title":"…","paragraphs":["…"],"bullets":["…"]}]' }]} />,
  levels: () => <ResourceManager resource="levels" title="Levels / sub-categories" filters={[{ name: "program_id", label: "Programme", options: progOpts }]}
    columns={[{ key: "program", label: "Programme", render: (r) => r.program?.name }, { key: "name", label: "Level" }, { key: "slug", label: "Slug" }, { key: "sort_order", label: "Order", num: true }]}
    fields={[{ name: "program_id", label: "Programme", type: "select", options: progOpts, required: true }, { name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }, { name: "sort_order", label: "Order", type: "number" }, { name: "description", label: "Description", type: "textarea" }]} />,
  sessions: () => <ResourceManager resource="exam-sessions" title="Exam sessions" sub="Attempts students can choose when enrolling (e.g. December 2026)." filters={[{ name: "program_id", label: "Programme", options: progOpts }]} defaults={{ status: "open" }}
    columns={[{ key: "program", label: "Programme", render: (r) => r.program?.name }, { key: "name", label: "Session" }, { key: "starts_on", label: "Starts", render: (r) => date(r.starts_on) }, { key: "status", label: "Status", type: "status" }]}
    fields={[{ name: "program_id", label: "Programme", type: "select", options: progOpts, required: true }, { name: "name", label: "Name", required: true }, { name: "starts_on", label: "Starts on", type: "date" }, { name: "status", label: "Status", type: "select", options: ["open", "closed"], required: true }, { name: "sort_order", label: "Order", type: "number" }]} />,
  payments: () => <ResourceManager resource="payments" title="Payments" sub="Every payment proof uploaded by students." filters={[{ name: "status", label: "Status", options: [["submitted", "Submitted"], ["verified", "Verified"], ["rejected", "Rejected"]] }]}
    columns={[{ key: "order", label: "Order", render: (r) => r.order?.order_no, csv: (r) => r.order?.order_no }, { key: "user", label: "Student", render: (r) => who(r.user), csv: (r) => r.user?.email },
      { key: "screenshot_url", label: "Proof", render: (r) => <a href={r.screenshot_url} target="_blank" rel="noreferrer">{/\.pdf$/i.test(r.screenshot_name || "") ? "PDF" : <img src={r.screenshot_url} alt="" className="thumb-sm" />}</a>, noExport: true },
      { key: "amount", label: "Amount", type: "money" }, { key: "method", label: "Method", render: (r) => <>{r.method}<br /><small className="muted">{r.paid_from}</small></> }, { key: "transaction_ref", label: "Transaction ID" },
      { key: "paid_on", label: "Paid on", render: (r) => date(r.paid_on) }, { key: "status", label: "Status", type: "status" }]}
    fields={[{ name: "order_id", label: "Order ID", type: "number", required: true }, { name: "user_id", label: "Student", type: "select", options: studentOpts, required: true }, { name: "method", label: "Method", required: true }, { name: "paid_from", label: "Paid from" },
      { name: "account_title", label: "Sender account title" }, { name: "account_number", label: "Sender account no." }, { name: "paid_to", label: "Paid to" }, { name: "transaction_ref", label: "Transaction ID", required: true },
      { name: "amount", label: "Amount", type: "number", required: true }, { name: "paid_on", label: "Paid on", type: "date" }, { name: "status", label: "Status", type: "select", options: ["submitted", "verified", "rejected"], required: true },
      { name: "screenshot", label: "Screenshot (replace)", type: "file", accept: "image/*,application/pdf" }, { name: "note", label: "Student note", type: "textarea" }, { name: "remarks", label: "Admin remarks", type: "textarea" }]} />,
  accounts: () => <ResourceManager resource="payment-accounts" title="Payment accounts" sub="Bank accounts and mobile wallets shown to students at checkout." defaults={{ type: "bank", is_active: true }}
    columns={[{ key: "type", label: "Type" }, { key: "provider", label: "Bank / app" }, { key: "account_title", label: "Title" }, { key: "account_number", label: "Account no." }, { key: "iban", label: "IBAN" }, { key: "is_active", label: "Active", type: "bool" }]}
    fields={[{ name: "type", label: "Type", type: "select", options: [["bank", "Bank account"], ["wallet", "Mobile wallet"]], required: true }, { name: "provider", label: "Bank / app name", required: true }, { name: "account_title", label: "Account title", required: true },
      { name: "account_number", label: "Account / mobile number", required: true }, { name: "iban", label: "IBAN" }, { name: "branch", label: "Branch" }, { name: "instructions", label: "Instructions", type: "textarea" },
      { name: "is_active", label: "Show at checkout", type: "checkbox", default: true }, { name: "sort_order", label: "Order", type: "number" }]} />,
  announcements: () => <ResourceManager resource="announcements" title="Announcements" defaults={{ audience: "all", is_published: true }} filters={[{ name: "audience", label: "Audience", options: ["all", "students", "teachers", "course"] }]}
    columns={[{ key: "title", label: "Title" }, { key: "audience", label: "Audience", render: (r) => r.audience === "course" ? `Course ${r.course?.code}` : r.audience }, { key: "author", label: "By", render: (r) => r.author?.name }, { key: "is_published", label: "Published", type: "bool" }, { key: "created_at", label: "Date", type: "date" }]}
    fields={[{ name: "title", label: "Title", required: true }, { name: "audience", label: "Audience", type: "select", options: ["all", "students", "teachers", "course"], required: true }, { name: "course_id", label: "Course", type: "select", options: courseOpts, showIf: (f) => f.audience === "course" },
      { name: "is_published", label: "Published", type: "checkbox", default: true }, { name: "body", label: "Message", type: "textarea", required: true }]} />,
  notifications: () => <ResourceManager resource="notifications" title="User notifications" sub="Send a direct notification to any user. Also dispatches an instant WhatsApp message to their phone."
    columns={[{ key: "user", label: "User", render: (r) => who(r.user) }, { key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "read_at", label: "Read", render: (r) => r.read_at ? dateTime(r.read_at) : "Unread" }, { key: "created_at", label: "Sent", type: "date" }]}
    fields={[{ name: "user_id", label: "User ID", type: "number", required: true, hint: "See Students / Teachers list for IDs. Recipient receives portal notification + WhatsApp message." }, { name: "type", label: "Type", type: "select", options: ["info", "success", "error", "admin"] }, { name: "title", label: "Title", required: true }, { name: "link", label: "Link (e.g. /student/courses)" }, { name: "body", label: "Message", type: "textarea" }]} />,
  messages: () => <ResourceManager resource="contact-messages" title="Contact messages" canCreate={false} filters={[{ name: "status", label: "Status", options: ["new", "read", "replied"] }]}
    columns={[{ key: "name", label: "From", render: (r) => <><strong>{r.name}</strong><br /><small className="muted">{r.email} {r.phone}</small></> }, { key: "subject", label: "Subject" }, { key: "message", label: "Message", render: (r) => String(r.message).slice(0, 90) }, { key: "created_at", label: "Date", type: "date" }, { key: "status", label: "Status", type: "status" }, { key: "chat", label: "WhatsApp", render: (r) => r.phone ? <a href={`https://wa.me/${r.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">💬 WhatsApp</a> : <span className="muted">—</span> }]}
    fields={[{ name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone" }, { name: "subject", label: "Subject" }, { name: "status", label: "Status", type: "select", options: ["new", "read", "replied"], required: true }, { name: "message", label: "Message", type: "textarea", required: true }]} />,
  inquiries: () => <ResourceManager resource="inquiries" title="Admission inquiries" sub="Call-back requests from the website." filters={[{ name: "status", label: "Status", options: ["new", "contacted", "closed"] }]}
    columns={[{ key: "name", label: "Name" }, { key: "phone", label: "Phone / email", render: (r) => <>{r.phone}<br /><small className="muted">{r.email}</small></> }, { key: "program", label: "Programme" }, { key: "qualification", label: "Qualification" }, { key: "city", label: "City" }, { key: "created_at", label: "Date", type: "date" }, { key: "status", label: "Status", type: "status" }, { key: "chat", label: "WhatsApp", render: (r) => r.phone ? <a href={`https://wa.me/${r.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">💬 WhatsApp</a> : <span className="muted">—</span> }]}
    fields={[{ name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "phone", label: "Phone", required: true }, { name: "program", label: "Programme" }, { name: "qualification", label: "Qualification" }, { name: "city", label: "City" }, { name: "status", label: "Status", type: "select", options: ["new", "contacted", "closed"], required: true }, { name: "message", label: "Message", type: "textarea" }]} />,
  subscribers: () => <ResourceManager resource="subscribers" title="Newsletter subscribers" columns={[{ key: "email", label: "Email" }, { key: "ip", label: "IP" }, { key: "created_at", label: "Subscribed", type: "date" }]} fields={[{ name: "email", label: "Email", type: "email", required: true }]} />,
  carts: () => <ResourceManager resource="carts" title="Shopping carts" sub="Every cart saved on the website — including carts that were never checked out." canCreate={false} filters={[{ name: "status", label: "Status", options: ["active", "converted"] }]}
    columns={[{ key: "user", label: "User", render: (r) => r.user ? who(r.user) : <span className="muted">Guest</span>, csv: (r) => r.user?.email || "guest" }, { key: "items", label: "Items", render: (r) => r.items.map((i) => <span key={i.id} className="tag">{i.course?.code}</span>), csv: (r) => r.items.map((i) => i.course?.code).join(" ") },
      { key: "ip", label: "IP" }, { key: "updated_at", label: "Last update", type: "date" }, { key: "status", label: "Status", type: "status" }]}
    fields={[{ name: "status", label: "Status", type: "select", options: ["active", "converted"], required: true }]} />,
  progress: () => <ResourceManager resource="lesson-progress" title="Lesson progress" sub="Which student watched / completed which lesson." canCreate={false}
    columns={[{ key: "user", label: "Student", render: (r) => r.user?.name }, { key: "lesson", label: "Lesson", render: (r) => r.lesson?.title }, { key: "views", label: "Views", num: true }, { key: "completed_at", label: "Completed", type: "date" }, { key: "updated_at", label: "Last seen", type: "date" }]}
    fields={[{ name: "views", label: "Views", type: "number" }, { name: "completed_at", label: "Completed at", type: "date" }]} />,
  orderItems: () => <ResourceManager resource="order-items" title="Order items" canCreate={false}
    columns={[{ key: "order", label: "Order", render: (r) => r.order?.order_no }, { key: "item_type", label: "Type" }, { key: "code", label: "Code" }, { key: "title", label: "Title" }, { key: "session_name", label: "Session" }, { key: "price", label: "Price", type: "money" }]}
    fields={[{ name: "order_id", label: "Order ID", type: "number", required: true }, { name: "item_type", label: "Type", type: "select", options: ["course", "registration_fee"], required: true }, { name: "code", label: "Code" }, { name: "title", label: "Title", required: true }, { name: "session_name", label: "Session" }, { name: "price", label: "Price", type: "number", required: true }]} />,
  activity: () => <ResourceManager resource="activity-logs" title="Activity log" sub="Every action on the website and API — logins, page views, cart, orders, uploads and admin changes." canCreate={false} canEdit={false} perPage={50}
    filters={[{ name: "action", label: "Action", options: (o) => o.actions || [] }, { name: "method", label: "Method", options: ["GET", "POST", "PUT", "DELETE"] }]}
    columns={[{ key: "created_at", label: "When", type: "date" }, { key: "user", label: "User", render: (r) => r.user ? `${r.user.name} (${r.user.role})` : <span className="muted">Guest {r.visitor_id?.slice(0, 8)}</span>, csv: (r) => r.user?.name || r.visitor_id },
      { key: "action", label: "Action", render: (r) => <span className="tag">{r.action}</span> }, { key: "description", label: "Description", render: (r) => <span className="wrap">{r.description}</span> }, { key: "status_code", label: "HTTP", num: true }, { key: "ip", label: "IP" }]} />,
  quizAttempts: () => <ResourceManager resource="quiz-attempts" title="Quiz attempts" sub="Every quiz submitted by students, with scores." canCreate={false} filters={[{ name: "passed", label: "Result", options: [["1", "Passed"], ["0", "Not passed"]] }]}
    columns={[{ key: "user", label: "Student", render: (r) => who(r.user), csv: (r) => r.user?.email }, { key: "quiz", label: "Quiz", render: (r) => <><span className="tag">{r.quiz?.course?.code}</span> {r.quiz?.title}</>, csv: (r) => r.quiz?.title },
      { key: "score", label: "Score", render: (r) => `${r.score}/${r.total}`, num: true }, { key: "percentage", label: "%", num: true }, { key: "passed", label: "Passed", type: "bool" }, { key: "submitted_at", label: "Submitted", type: "date" }]}
    fields={[{ name: "score", label: "Score", type: "number" }, { name: "total", label: "Total", type: "number" }, { name: "percentage", label: "Percentage", type: "number" }, { name: "passed", label: "Passed", type: "checkbox" }]} />,
  messageLogs: () => <ResourceManager resource="message-logs" title="Message log" sub="Every WhatsApp and email the website has sent — with delivery status and errors." canCreate={false} canEdit={false} perPage={50}
    filters={[{ name: "channel", label: "Channel", options: [["whatsapp", "WhatsApp"], ["email", "Email"]] }, { name: "status", label: "Status", options: ["queued", "sent", "failed", "skipped"] }]}
    columns={[{ key: "created_at", label: "When", type: "date" }, { key: "channel", label: "Channel", render: (r) => <span className={`tag ${r.channel === "whatsapp" ? "tag-wa" : ""}`}>{r.channel}</span> }, { key: "recipient", label: "To", render: (r) => <>{r.recipient}{r.user && <><br /><small className="muted">{r.user.name}</small></>}</> },
      { key: "subject", label: "Message", render: (r) => <span className="wrap">{r.subject}</span> }, { key: "status", label: "Status", type: "status" }, { key: "error", label: "Error", render: (r) => r.error ? <span className="wrap small bad-text">{String(r.error).slice(0, 140)}</span> : "—" }]} />,
};
