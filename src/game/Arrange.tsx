import { useCallback, useEffect, useState } from 'react';
import { sfx } from '../audio';
import type { ArrangeData } from '../core/generators';
import { useDragDrop, type GameApi } from './shared';

export default function Arrange({ data, api }: { data: ArrangeData; api: GameApi }) {
  const { steps, order } = data;
  const [filled, setFilled] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const next = steps[filled.length];

  const place = useCallback((id: string, slot: number) => {
    if (filled.includes(id)) return;
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === filled.length && slot === idx) {
      sfx.place();
      const n = [...filled, id];
      setFilled(n);
      setHint(null);
      api.progress(n.length, steps.length);
      if (n.length === steps.length) setTimeout(api.solved, 700);
    } else {
      sfx.wrong();
      api.mistake();
      setWrong(id);
      setTimeout(() => setWrong(null), 450);
      if (api.guidance === 'strong') { setHint(next.id); }
    }
  }, [api, filled, next, steps]);

  const onDrop = useCallback((id: string, drop: string | null) => { if (drop?.startsWith('slot-')) place(id, Number(drop.slice(5))); }, [place]);
  const onTap = useCallback((id: string) => place(id, filled.length), [place, filled.length]);
  const { bind, over } = useDragDrop(onDrop, onTap);

  useEffect(() => {
    if (!api.hintTick || !next) return;
    setHint(next.id);
    const t = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.hintTick]);

  return (
    <div className="arr">
      <h2 className="arr-title">{data.title}</h2>
      <div className="arr-slots">
        {steps.map((s, i) => {
          const f = filled[i] ? steps.find((x) => x.id === filled[i])! : null;
          return (
            <div key={s.id} data-drop={`slot-${i}`} className={`arr-slot${f ? ' done' : ''}${i === filled.length ? ' current' : ''}${over === `slot-${i}` ? ' over' : ''}`}>
              <span className="arr-num">{i + 1}</span>
              {f ? <><span className="arr-emoji">{f.emoji}</span><span className="arr-label">{f.label}</span></> : <span className="arr-empty">?</span>}
            </div>
          );
        })}
      </div>
      <p className="subtle" style={{ textAlign: 'center' }}>{next ? `What happens ${filled.length === 0 ? 'first' : 'next'}?` : 'The story is complete!'}</p>
      <div className="arr-cards">
        {order.map((id) => {
          if (filled.includes(id)) return null;
          const s = steps.find((x) => x.id === id)!;
          const b = bind(id, api.paused);
          return (
            <div key={id} className="arr-cell">
              <button className={`arr-card${wrong === id ? ' shake' : ''}${hint === id ? ' glow' : ''}`} aria-label={s.label} {...b}>
                <span className="arr-emoji">{s.emoji}</span>
                {api.guidance !== 'none' && <span className="arr-label">{s.label}</span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
