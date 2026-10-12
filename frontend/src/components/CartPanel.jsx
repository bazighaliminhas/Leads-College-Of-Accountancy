import { Link, useNavigate } from "react-router-dom";
import { Trash2, ShoppingCart, X, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { pkr } from "../lib/format";
import { Empty } from "./ui";

export function CartSummary({ compact = false, showCheckout = true }) {
  const { cart, removeFromCart, setCartOpen } = useApp();
  const nav = useNavigate();
  if (!cart.count) return <Empty icon={ShoppingCart} title="Your cart is empty" text="Choose a programme and add papers to start your admission." />;
  return (
    <div className="cart-summary">
      <ul className="cart-lines">
        {cart.items.map((i) => (
          <li key={i.id}>
            <div>
              <span className="tag">{i.program} · {i.code}</span>
              <strong>{i.title}</strong>
              {i.session && <small>{i.session} attempt</small>}
            </div>
            <div className="cart-line-right">
              <span>{pkr(i.price)}</span>
              <button className="icon-btn danger" onClick={() => removeFromCart(i.id)} aria-label={`Remove ${i.code}`}><Trash2 size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      <dl className="totals">
        <div><dt>Subtotal ({cart.count} {cart.count === 1 ? "paper" : "papers"})</dt><dd>{pkr(cart.subtotal)}</dd></div>
        {cart.registration.map((r) => <div key={r.program_id}><dt>{r.title}</dt><dd>{pkr(r.price)}</dd></div>)}
        {!cart.registration.length && <div><dt>Admission / registration fee</dt><dd>{pkr(0)}</dd></div>}
        <div className="grand"><dt>Total payable</dt><dd>{pkr(cart.total)}</dd></div>
      </dl>
      {!compact && <p className="fine">The college registration fee is charged once per programme for new students.</p>}
      {showCheckout && (
        <button className="btn btn-primary btn-block btn-lg" onClick={() => { setCartOpen(false); nav("/checkout"); }}>
          <ShieldCheck size={18} /> Checkout
        </button>
      )}
    </div>
  );
}

export function CartDrawer() {
  const { cartOpen, setCartOpen, cart } = useApp();
  return (
    <>
      <div className={`drawer-backdrop ${cartOpen ? "show" : ""}`} onClick={() => setCartOpen(false)} />
      <aside className={`drawer ${cartOpen ? "show" : ""}`} aria-hidden={!cartOpen} aria-label="Cart">
        <div className="drawer-head">
          <h3><ShoppingCart size={20} /> Your cart <span className="count-pill">{cart.count}</span></h3>
          <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close cart"><X /></button>
        </div>
        <div className="drawer-body"><CartSummary /></div>
        <div className="drawer-foot"><Link to="/#courses" onClick={() => setCartOpen(false)}>+ Add more courses</Link></div>
      </aside>
    </>
  );
}

export function MobileCartBar() {
  const { cart, setCartOpen } = useApp();
  if (!cart.count) return null;
  return (
    <div className="mobile-cart-bar">
      <span><strong>{cart.count}</strong> {cart.count === 1 ? "item" : "items"} · {pkr(cart.total)}</span>
      <button className="btn btn-primary btn-sm" onClick={() => setCartOpen(true)}>Checkout</button>
    </div>
  );
}
