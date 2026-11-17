import { useCallback, useEffect, useState } from 'react';
import { sfx } from '../audio';
import { ROTATABLE, type ShapesData } from '../core/generators';
import { Shape } from '../ui/ui';
import { useDragDrop, type GameApi } from './shared';

export default function Shapes({ data, api }: { data: ShapesData; api: GameApi }) {
  const { pieces, outlines } = data;
  const [rot, setRot] = useState<Record<string, number>>(() => Object.fromEntries(pieces.map((p) => [p.id, p.startRot])));
  const [placed, setPlaced] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const size = pieces.length > 6 ? 'clamp(56px, 15vw, 96px)' : 'clamp(68px, 20vw, 120px)';

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 1600); };

  const tryPlace = useCallback((pid: string, oid: string) => {
    const o = outlines.find((x) => x.id === oid);
    if (!o || placed.has(pid)) return;
    if (o.pieceId === pid) {
      if ((rot[pid] ?? 0) % 360 !== 0) { sfx.wrong(); flash('Almost! Turn it so it fits ↻'); setWrong(oid); setTimeout(() => setWrong(null), 450); return; }
      sfx.place();
      const n = new Set(placed).add(pid);
      setPlaced(n);
      setSelected(null);
      api.progress(n.size, pieces.length);
      if (n.size === pieces.length) setTimeout(api.solved, 350);
    } else {
      sfx.wrong();
      api.mistake();
      setWrong(oid);
      setTimeout(() => setWrong(null), 450);
    }
  }, [api, outlines, pieces.length, placed, rot]);

  const onDrop = useCallback((id: string, drop: string | null) => { if (drop) tryPlace(id, drop); }, [tryPlace]);
  const onTap = useCallback((id: string) => { sfx.pick(); setSelected((s) => (s === id ? null : id)); }, []);
  const { bind, over } = useDragDrop(onDrop, onTap);

  useEffect(() => {
    if (!api.hintTick) return;
    const p = pieces.find((x) => !placed.has(x.id));
    if (!p) return;
    setHint(p.id);
    setSelected(p.id);
    if (data.rotation && rot[p.id] % 360 !== 0) flash('Tip: turn this shape first!');
    const t = setTimeout(() => setHint(null), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.hintTick]);

  const rotate = (pid: string) => { sfx.tap(); setRot((r) => ({ ...r, [pid]: (r[pid] + 90) % 360 })); };
  const hintOutline = hint ? outlines.find((o) => o.pieceId === hint)?.id : null;
  const guideOutline = api.guidance === 'strong' && selected ? outlines.find((o) => o.pieceId === selected)?.id : null;

  return (
    <div className="shp">
      <div className="shp-board" aria-label="Outlines">
        {outlines.map((o) => {
          const filled = o.pieceId && placed.has(o.pieceId) ? pieces.find((p) => p.id === o.pieceId) : null;
          return (
            <div
              key={o.id}
              data-drop={o.id}
              role="button"
              aria-label={filled ? `${o.kind} filled` : `${o.kind} outline`}
              className={`shp-slot${over === o.id ? ' over' : ''}${wrong === o.id ? ' shake' : ''}${hintOutline === o.id || guideOutline === o.id ? ' glow' : ''}`}
              style={{ width: size, height: size }}
              onClick={() => selected && tryPlace(selected, o.id)}
            >
              {filled ? <Shape kind={filled.kind} color={filled.color} size="100%" /> : <Shape kind={o.kind} outline size="100%" />}
            </div>
          );
        })}
      </div>
      <p className="shp-note" aria-live="polite">{note ?? (data.rotation ? 'Tap a shape, then ↻ to turn it.' : ' ')}</p>
      <div className="shp-tray" aria-label="Shapes">
        {pieces.map((p) => {
          if (placed.has(p.id)) return null;
          const b = bind(p.id, api.paused);
          return (
            <div key={p.id} className="shp-cell" style={{ width: size }}>
              <div style={{ width: size, height: size }}>
                <button className={`shp-piece${selected === p.id ? ' sel' : ''}${hint === p.id ? ' glow' : ''}`} aria-label={`${p.kind} shape`} {...b} style={{ width: size, height: size, ...b.style }}>
                  <Shape kind={p.kind} color={p.color} size="100%" rotate={rot[p.id]} />
                </button>
              </div>
              {data.rotation && ROTATABLE.includes(p.kind) && <button className="shp-rot" onClick={() => rotate(p.id)} aria-label={`Turn ${p.kind}`}>↻</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
