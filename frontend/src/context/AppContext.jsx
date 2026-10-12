import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, tokens, errMsg } from "../lib/api";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const emptyCart = { items: [], registration: [], subtotal: 0, registration_fee: 0, total: 0, count: 0 };

export function AppProvider({ children }) {
  const [site, setSite] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [cart, setCart] = useState(emptyCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  const toast = useCallback((message, type = "ok") => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const applyCart = useCallback((d) => {
    if (d?.token) tokens.setCart(d.token);
    setCart({ ...emptyCart, ...d });
  }, []);

  const refreshCart = useCallback(() => api.get("/cart").then((r) => applyCart(r.data)).catch(() => {}), [applyCart]);

  const refreshMe = useCallback(async () => {
    if (!tokens.token) { setUser(null); setAuthReady(true); return null; }
    try {
      const r = await api.get("/auth/me");
      setUser(r.data.user); setUnread(r.data.unread);
      return r.data.user;
    } catch { setUser(null); return null; } finally { setAuthReady(true); }
  }, []);

  useEffect(() => {
    api.get("/site").then((r) => setSite(r.data)).catch(() => setSite({ settings: {}, programs: [], payment_accounts: [] }));
    refreshMe().then(refreshCart);
    const onOut = () => { setUser(null); refreshCart(); };
    window.addEventListener("lca:logout", onOut);
    return () => window.removeEventListener("lca:logout", onOut);
  }, [refreshMe, refreshCart]);

  const login = async (login, password, role) => {
    const r = await api.post("/auth/login", { login, password, role });
    tokens.setToken(r.data.token); setUser(r.data.user);
    await refreshCart(); refreshMe();
    return r.data.user;
  };
  const register = async (payload) => {
    const r = await api.post("/auth/register", payload);
    tokens.setToken(r.data.token); setUser(r.data.user);
    await refreshCart();
    return r.data.user;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    tokens.setToken(null); tokens.setCart(null); setUser(null); setCart(emptyCart); refreshCart();
  };

  /** returns {ok} | {conflict:true} */
  const addToCart = async (course_id, exam_session_id, replace = false) => {
    try {
      const r = await api.post("/cart/items", { course_id, exam_session_id, replace });
      applyCart(r.data);
      return { ok: true };
    } catch (e) {
      if (e.response?.status === 409) return { conflict: true };
      toast(errMsg(e), "bad");
      return { ok: false };
    }
  };
  const removeFromCart = async (id) => { const r = await api.delete(`/cart/items/${id}`); applyCart(r.data); };
  const clearCart = async () => { const r = await api.delete("/cart"); applyCart(r.data); };

  const s = (k, d = "") => site?.settings?.[k] ?? d;

  const value = useMemo(() => ({
    site, s, user, setUser, authReady, unread, setUnread, refreshMe,
    cart, cartOpen, setCartOpen, refreshCart, addToCart, removeFromCart, clearCart, applyCart,
    login, register, logout, toast,
  }), [site, user, authReady, unread, cart, cartOpen]); // eslint-disable-line

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  );
}
