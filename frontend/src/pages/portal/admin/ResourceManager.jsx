import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Eye, ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";
import { api, errMsg, fieldErrors } from "../../../lib/api";
import { useApp } from "../../../context/AppContext";
import { Modal, Spinner, Empty, Field, Btn, Badge } from "../../../components/ui";
import { dateTime, pkr } from "../../../lib/format";
import { useAdminOptions } from "./options";

/**
 * Generic, config-driven CRUD table for any admin resource.
 * columns: [{key, label, render?(row), type?: 'money'|'date'|'status'|'bool'}]
 * fields:  [{name, label, type, options?, required?, full?, hint?, showIf?(form)}]
 */
export default function ResourceManager({ resource, title, sub, columns, fields = [], filters = [], fixed = {}, defaults = {}, canCreate = true, canEdit = true, canDelete = true, rowActions, renderForm, headerActions, reloadKey, perPage = 25 }) {
  const { toast } = useApp();
  const opts = useAdminOptions();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState({});
  const [edit, setEdit] = useState(null); // {} for new, row for edit
  const [view, setView] = useState(null);

  const load = useCallback(() => {
    api.get(`/admin/r/${resource}`, { params: { page, search: q || undefined, per_page: perPage, ...fixed, ...flt } })
      .then((r) => setData(r.data)).catch((e) => toast(errMsg(e), "bad"));
  }, [resource, page, q, JSON.stringify(fixed), JSON.stringify(flt), perPage]); // eslint-disable-line
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); setQ(search); }, 350); return () => clearTimeout(t); }, [search]);

  const del = async (row) => {
    if (!confirm(`Delete this record (#${row.id})? This cannot be undone.`)) return;
    try { await api.delete(`/admin/r/${resource}/${row.id}`); toast("Deleted"); load(); } catch (e) { toast(errMsg(e), "bad"); }
  };

  const exportCsv = () => {
    const rows = data?.data || [];
    const cols = columns.filter((c) => !c.noExport);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(c.csv ? c.csv(r) : typeof r[c.key] === "object" ? JSON.stringify(r[c.key]) : r[c.key])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${resource}-page${page}.csv`; a.click();
  };

  const cell = (c, r) => {
    if (c.render) return c.render(r, { reload: load });
    const v = r[c.key];
    if (c.type === "money") return pkr(v);
    if (c.type === "date") return dateTime(v);
    if (c.type === "status") return <Badge status={v} />;
    if (c.type === "bool") return v ? "Yes" : "No";
    return v ?? "—";
  };

  return (
    <>
      <div className="page-head">
        <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
        <div className="page-actions">
          {headerActions}
          <button className="btn btn-ghost btn-sm" onClick={load} aria-label="Refresh"><RefreshCw size={16} /></button>
          <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={16} /> CSV</button>
          {canCreate && <button className="btn btn-primary" onClick={() => setEdit({ ...defaults })}><Plus size={16} /> Add new</button>}
        </div>
      </div>
      <div className="toolbar">
        <div className="search-box"><Search size={18} /><input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" /></div>
        {filters.map((f) => (
          <select key={f.name} value={flt[f.name] || ""} onChange={(e) => { setPage(1); setFlt({ ...flt, [f.name]: e.target.value || undefined }); }} aria-label={f.label}>
            <option value="">{f.label}: all</option>
            {resolveOptions(f.options, opts).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {data && <span className="muted">{data.total} records</span>}
      </div>
      <div className="card flush">
        {!data ? <Spinner /> : !data.data.length ? <Empty title="No records found" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>#</th>{columns.map((c) => <th key={c.key} className={c.type === "money" || c.num ? "num" : ""}>{c.label}</th>)}<th className="num">Actions</th></tr></thead>
            <tbody>{data.data.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.id}</td>
                {columns.map((c) => <td key={c.key} className={c.type === "money" || c.num ? "num" : ""}>{cell(c, r)}</td>)}
                <td className="num nowrap">
                  {rowActions?.(r, load)}
                  <button className="icon-btn" onClick={() => setView(r)} aria-label="View"><Eye size={16} /></button>
                  {canEdit && <button className="icon-btn" onClick={() => setEdit(r)} aria-label="Edit"><Pencil size={16} /></button>}
                  {canDelete && <button className="icon-btn danger" onClick={() => del(r)} aria-label="Delete"><Trash2 size={16} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {data && data.last_page > 1 && (
        <div className="pager">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /> Prev</button>
          <span>Page {data.current_page} of {data.last_page}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next <ChevronRight size={16} /></button>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${title.replace(/s$/, "")} #${edit.id}` : `Add ${title.replace(/s$/, "")}`} size="lg">
        {edit && (renderForm ? renderForm(edit, () => { setEdit(null); load(); }) :
          <AutoForm resource={resource} row={edit} fields={fields} fixed={fixed} onSaved={() => { setEdit(null); load(); }} />)}
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={`Record #${view?.id}`} size="lg">
        {view && <RecordView row={view} />}
      </Modal>
    </>
  );
}

export function resolveOptions(o, opts) {
  const list = typeof o === "function" ? o(opts || {}) : o || [];
  return list.map((x) => (Array.isArray(x) ? x : [x, x]));
}

export function AutoForm({ resource, row, fields, fixed = {}, onSaved }) {
  const { toast } = useApp();
  const opts = useAdminOptions();
  const init = {};
  fields.forEach((f) => {
    let v = row[f.name];
    if (f.type === "lines") v = Array.isArray(v) ? v.join("\n") : v || "";
    if (f.type === "json") v = v ? JSON.stringify(v, null, 2) : "";
    if (f.type === "checkbox") v = v === undefined ? !!f.default : !!v;
    if (f.type === "password" || f.type === "file" || f.type === "image") v = "";
    if (f.type === "date" && v) v = String(v).slice(0, 10);
    if (f.type === "courses") v = (row.teaching_courses || []).map((c) => c.id);
    if (f.type === "datetime" && v) v = String(v).slice(0, 16);
    init[f.name] = v ?? f.default ?? "";
  });
  const [form, setForm] = useState(init);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr({});
    const fd = new FormData();
    Object.entries(fixed).forEach(([k, v]) => fd.append(k, v));
    for (const f of fields) {
      if (f.readOnly) continue;
      if (f.showIf && !f.showIf(form)) continue;
      const v = form[f.name];
      if (f.type === "file" || f.type === "image") { if (v instanceof File) fd.append(f.name, v); continue; }
      if (f.type === "password" && !v) continue;
      if (f.type === "checkbox") { fd.append(f.name, v ? "1" : "0"); continue; }
      if (f.type === "courses") { fd.append(f.name, JSON.stringify(v || [])); continue; }
      if (f.type === "lines") { const arr = String(v || "").split("\n").map((x) => x.trim()).filter(Boolean); fd.append(f.name, JSON.stringify(arr)); continue; }
      if (f.type === "json") { if (v) fd.append(f.name, v); continue; }
      fd.append(f.name, v ?? "");
    }
    try {
      await api.post(row.id ? `/admin/r/${resource}/${row.id}` : `/admin/r/${resource}`, fd);
      toast(row.id ? "Saved" : "Created"); onSaved?.();
    } catch (er) { setErr(fieldErrors(er)); toast(errMsg(er), "bad"); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {fields.filter((f) => !f.showIf || f.showIf(form)).map((f) => (
          <Field key={f.name} label={f.label} required={f.required && !(f.type === "password" && row.id)} error={err[f.name]} hint={f.type === "password" && row.id ? "Leave empty to keep the current password" : f.hint} full={f.full || ["textarea", "lines", "json"].includes(f.type)}>
            <Input f={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} opts={opts} row={row} form={form} />
          </Field>
        ))}
      </div>
      <Btn loading={busy}>{row.id ? "Save changes" : "Create"}</Btn>
    </form>
  );
}

function Input({ f, value, onChange, opts, row, form }) {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value), required: f.required && !(f.type === "password" && row.id), disabled: f.readOnly };
  switch (f.type) {
    case "textarea": return <textarea rows={f.rows || 4} {...common} />;
    case "lines": return <textarea rows={f.rows || 5} {...common} placeholder="One item per line" />;
    case "json": return <textarea rows={8} className="mono" {...common} />;
    case "select": return <select {...common}><option value="">{f.placeholder || "— select —"}</option>{resolveOptions(f.options, { ...opts, form }).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
    case "checkbox": return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.checkLabel || "Yes"}</label>;
    case "file": case "image": return <input type="file" accept={f.type === "image" ? "image/*" : f.accept} onChange={(e) => onChange(e.target.files?.[0] || "")} />;
    case "number": return <input type="number" step="any" {...common} />;
    case "datetime": return <input type="datetime-local" {...common} />;
    case "courses": {
      const sel = value || [];
      const flip = (id) => onChange(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
      return (
        <div className="course-picker">
          {(opts.programs || []).map((p) => (
            <div key={p.id} className="cp-group"><span className="cp-title">{p.name}</span>
              <div className="cp-chips">{(opts.courses || []).filter((c) => c.program_id === p.id).map((c) => (
                <button type="button" key={c.id} className={`chip ${sel.includes(c.id) ? "on" : ""}`} onClick={() => flip(c.id)} title={c.title}>{c.code}</button>
              ))}</div>
            </div>
          ))}
          <small className="muted">{sel.length ? `${sel.length} course${sel.length > 1 ? "s" : ""} selected` : "No course selected yet"}</small>
        </div>
      );
    }
    case "date": return <input type="date" {...common} />;
    case "email": return <input type="email" {...common} />;
    case "password": return <input type="password" autoComplete="new-password" {...common} />;
    default: return <input type="text" {...common} />;
  }
}

export function RecordView({ row }) {
  const fmt = (v) => {
    if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "object") return <pre className="mono small">{JSON.stringify(v, null, 2)}</pre>;
    if (/_url$/.test(String(v)) || /^https?:\/\//.test(String(v))) return <a href={v} target="_blank" rel="noreferrer">{String(v).slice(0, 80)}</a>;
    return String(v);
  };
  return (
    <dl className="record">
      {Object.entries(row).map(([k, v]) => <div key={k}><dt>{k.replace(/_/g, " ")}</dt><dd>{k === "screenshot_url" && v ? <a href={v} target="_blank" rel="noreferrer"><img src={v} alt="screenshot" className="proof-img" /></a> : fmt(v)}</dd></div>)}
    </dl>
  );
}
