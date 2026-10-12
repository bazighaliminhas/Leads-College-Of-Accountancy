import axios from "axios";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function visitorId() {
  let v = store.get("lca_visitor");
  if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); store.set("lca_visitor", v); }
  return v;
}

export const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || "") + "/api", headers: { Accept: "application/json" } });

api.interceptors.request.use((cfg) => {
  const token = store.get("lca_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  const cart = store.get("lca_cart");
  if (cart) cfg.headers["X-Cart-Token"] = cart;
  cfg.headers["X-Visitor-Id"] = visitorId();
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && store.get("lca_token")) {
      store.set("lca_token", null);
      window.dispatchEvent(new Event("lca:logout"));
    }
    return Promise.reject(err);
  }
);

export const tokens = {
  get token() { return store.get("lca_token"); },
  setToken(t) { store.set("lca_token", t); },
  get cart() { return store.get("lca_cart"); },
  setCart(t) { store.set("lca_cart", t); },
};

/** Extract a readable error message from an axios error. */
export function errMsg(e, fallback = "Something went wrong. Please try again.") {
  const d = e?.response?.data;
  if (d?.errors) return Object.values(d.errors).flat()[0];
  return d?.message || fallback;
}
export function fieldErrors(e) {
  const out = {};
  Object.entries(e?.response?.data?.errors || {}).forEach(([k, v]) => (out[k] = v[0]));
  return out;
}

/** Build FormData from an object (arrays/objects -> JSON, booleans -> 1/0, files kept). */
export function toForm(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined) return;
    if (v instanceof File || v instanceof Blob) fd.append(k, v);
    else if (Array.isArray(v) || (v && typeof v === "object")) fd.append(k, JSON.stringify(v));
    else if (typeof v === "boolean") fd.append(k, v ? "1" : "0");
    else fd.append(k, v ?? "");
  });
  return fd;
}

export const asset = (p) => (import.meta.env.BASE_URL || "/") + p.replace(/^\//, "");
