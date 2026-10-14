export const pkr = (n) => (n === null || n === undefined || n === "" ? "—" : "PKR " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 }));
export const num = (n) => Number(n || 0).toLocaleString("en-PK");
export const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const dateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const dayTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—");
export const time = (d) => (d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—");
export const longDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—");
/** "in 2 days", "in 3 h", "now", "2 h ago" */
export const fromNow = (d) => {
  if (!d) return "";
  const m = Math.round((new Date(d) - Date.now()) / 60000);
  const a = Math.abs(m);
  const s = a < 1 ? "now" : a < 60 ? `${a} min` : a < 1440 ? `${Math.round(a / 60)} h` : `${Math.round(a / 1440)} day${Math.round(a / 1440) > 1 ? "s" : ""}`;
  return s === "now" ? "now" : m > 0 ? `in ${s}` : `${s} ago`;
};
/** value for <input type="datetime-local"> in the browser's timezone */
export const toLocalInput = (d) => { if (!d) return ""; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
export const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
export const initials = (n) => String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

export const STATUS = {
  pending_payment: ["Awaiting payment", "warn"],
  payment_submitted: ["Payment under review", "info"],
  approved: ["Approved", "ok"],
  rejected: ["Rejected", "bad"],
  cancelled: ["Cancelled", "muted"],
  submitted: ["Submitted", "info"],
  verified: ["Verified", "ok"],
  pending: ["Awaiting admin permission", "warn"],
  active: ["Access granted", "ok"],
  suspended: ["Suspended", "bad"],
  completed: ["Completed", "ok"],
  published: ["Published", "ok"],
  draft: ["Draft", "muted"],
  blocked: ["Blocked", "bad"],
  open: ["Open", "ok"],
  closed: ["Closed", "muted"],
  new: ["New", "info"],
  read: ["Read", "muted"],
  replied: ["Replied", "ok"],
  contacted: ["Contacted", "ok"],
  converted: ["Converted", "ok"],
  scheduled: ["Scheduled", "info"],
  live: ["Live now", "bad"],
  upcoming: ["Upcoming", "info"],
  past: ["Finished", "muted"],
  queued: ["Queued", "warn"],
  sent: ["Sent", "ok"],
  failed: ["Failed", "bad"],
  skipped: ["Skipped", "muted"],
};
