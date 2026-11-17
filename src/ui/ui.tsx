import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { store } from '../core/db';
import { useBackHandler } from '../native';
import type { Item, ShapeKind } from '../core/generators';
import { COSTUMES } from '../core/worlds';

export const useDB = () => useSyncExternalStore(store.subscribe, store.get);

export function Avatar({ face, costume, size = 56 }: { face: string; costume?: string | null; size?: number }) {
  const hat = COSTUMES.find((c) => c.id === costume)?.emoji;
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden>
      <span className="face" style={{ fontSize: size * 0.62 }}>{face}</span>
      {hat && <span className="hat" style={{ fontSize: size * 0.42 }}>{hat}</span>}
    </span>
  );
}

export function Stars({ n, of = 3, size = 28, animate }: { n: number; of?: number; size?: number; animate?: boolean }) {
  return (
    <span className={`stars${animate ? ' animate' : ''}`} style={{ fontSize: size }} role="img" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={`s${i < n ? ' on' : ''}`}>⭐</span>)}
    </span>
  );
}

export function Modal({ children, onClose, wide, label }: { children: ReactNode; onClose?: () => void; wide?: boolean; label: string }) {
  useBackHandler(onClose);
  useEffect(() => {
    if (!onClose) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

export function Confetti({ count = 80 }: { count?: number }) {
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2 + Math.random() * 1.6,
    color: ['#FFC93C', '#3BA9F5', '#8B5CF6', '#34C46A', '#FF7A7A', '#F783AC'][i % 6], rot: Math.random() * 360,
  })), [count]);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, transform: `rotate(${b.rot}deg)` }} />)}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

/* ---------- Toasts ---------- */
type ToastFn = (msg: string) => void;
let pushToast: ToastFn = () => {};
export const toast: ToastFn = (m) => pushToast(m);
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    pushToast = (msg) => {
      const id = Math.random();
      setItems((x) => [...x, { id, msg }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 2600);
    };
  }, []);
  return <div className="toast-wrap" aria-live="polite">{items.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>;
}

/* ---------- Shapes ---------- */
const PATHS: Record<ShapeKind, string> = {
  circle: 'M50 8a42 42 0 1 0 0.01 0Z',
  square: 'M12 12H88V88H12Z',
  triangle: 'M50 8L92 88H8Z',
  star: 'M50 6l12.4 27.6 30 3.2-22.4 20.2 6.4 29.6L50 71.4 23.6 86.6 30 57 7.6 36.8l30-3.2Z',
  heart: 'M50 88C20 66 6 50 6 32 6 18 17 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 13 0 24 10 24 24 0 18-14 34-44 56Z',
  diamond: 'M50 4L94 50 50 96 6 50Z',
  hexagon: 'M28 10H72L94 50 72 90H28L6 50Z',
  pentagon: 'M50 6L94 38 77 90H23L6 38Z',
  arrow: 'M8 38H56V14L94 50 56 86V62H8Z',
  lshape: 'M14 8H44V60H88V90H14Z',
  moon: 'M62 6A44 44 0 1 0 94 70 34 34 0 1 1 62 6Z',
  cross: 'M36 8H64V36H92V64H64V92H36V64H8V36H36Z',
};

export function Shape({ kind, color, size = 64, outline, rotate = 0 }: { kind: ShapeKind; color?: string; size?: number | string; outline?: boolean; rotate?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: `rotate(${rotate}deg)`, transition: 'transform 0.25s', display: 'block' }} aria-hidden>
      <path d={PATHS[kind]} fill={outline ? 'rgba(31,42,68,0.05)' : color} stroke={outline ? '#9AA7C2' : 'rgba(0,0,0,0.12)'} strokeWidth={outline ? 4 : 3} strokeDasharray={outline ? '8 6' : undefined} strokeLinejoin="round" />
    </svg>
  );
}

export function ItemView({ item, size = 56 }: { item: Item; size?: number }) {
  if (item.shape) return <Shape kind={item.shape} color={item.color} size={size} />;
  if (item.emoji) return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{item.emoji}</span>;
  return <span style={{ fontSize: size * 0.5, fontFamily: 'var(--font-display)', fontWeight: 700 }}>{item.text}</span>;
}
