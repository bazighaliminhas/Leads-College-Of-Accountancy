export const pkr = (n) => (n === null || n === undefined || n === "" ? "—" : "PKR " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 }));
export const num = (n) => Number(n || 0).toLocaleString("en-PK");
export const date = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const dateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
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
};
