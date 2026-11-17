import { useMemo, useState } from 'react';
import { actions } from '../core/db';
import { useBackHandler } from '../native';
import { useDB } from '../ui/ui';

/** PIN pad that keeps the grown-up area away from children. "Forgot PIN" uses a multiplication question. */
export default function ParentGate({ onPass, onCancel, title = 'Grown-ups only' }: { onPass: () => void; onCancel: () => void; title?: string }) {
  const db = useDB();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [mode, setMode] = useState<'pin' | 'forgot' | 'newpin'>('pin');
  const q = useMemo(() => ({ a: 6 + Math.floor(Math.random() * 7), b: 12 + Math.floor(Math.random() * 8) }), [mode]);
  const [ans, setAns] = useState('');
  useBackHandler(onCancel);

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setErr(false);
    if (next.length === 4) {
      if (mode === 'newpin') { actions.updateParent({ pin: next }); onPass(); return; }
      if (next === db.parent?.pin) onPass();
      else setTimeout(() => { setErr(true); setPin(''); }, 200);
    }
  };

  return (
    <div className="overlay gate">
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: 380 }}>
        <div className="col center-text" style={{ gap: 14 }}>
          <div style={{ fontSize: 44 }}>🔒</div>
          <h2>{mode === 'newpin' ? 'Choose a new PIN' : title}</h2>
          {mode === 'forgot' ? (
            <form className="col" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (Number(ans) === q.a * q.b) { setMode('newpin'); setPin(''); } else { setErr(true); setAns(''); } }}>
              <p className="muted">To reset the PIN, answer: what is <b>{q.a} × {q.b}</b>?</p>
              <input className="input" inputMode="numeric" value={ans} onChange={(e) => { setAns(e.target.value.replace(/\D/g, '')); setErr(false); }} aria-label="Answer" autoFocus />
              {err && <span className="chip coral">Not quite — try again</span>}
              <button className="btn purple block">Check</button>
            </form>
          ) : (
            <>
              <p className="muted">{mode === 'newpin' ? 'Enter 4 new digits.' : 'Enter your 4-digit parent PIN.'}</p>
              <div className={`pin-dots${err ? ' shake' : ''}`} aria-live="polite" aria-label={`${pin.length} digits entered`}>
                {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
              </div>
              {err && <span className="chip coral">Wrong PIN</span>}
              <div className="pin-pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> : (
                  <button key={i} className="pin-key" onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))} aria-label={k === '⌫' ? 'Delete' : k}>{k}</button>
                ))}
              </div>
            </>
          )}
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn ghost sm" onClick={onCancel}>Cancel</button>
            {mode === 'pin' && <button className="btn ghost sm" onClick={() => { setMode('forgot'); setErr(false); }}>Forgot PIN?</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
