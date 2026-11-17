import { useCallback, useEffect, useMemo, useState } from 'react';
import { sfx } from '../audio';
import type { JigsawData } from '../core/generators';
import { makeRng } from '../core/rng';
import { useDragDrop, type GameApi } from './shared';
import { useBoardSize } from './useBoardSize';

export default function Jigsaw({ data, api, seed }: { data: JigsawData; api: GameApi; seed: string }) {
  const { rows, cols, image } = data;
  const total = rows * cols;
  const [placed, setPlaced] = useState<boolean[]>(() => Array(total).fill(false));
  const tray = useMemo(() => makeRng(seed + 'tray').shuffle(Array.from({ length: total }, (_, i) => i)), [seed, total]);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrongSlot, setWrongSlot] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const board = useBoardSize(0.5);
  const cell = board / cols;
  const pieceSize = Math.max(44, Math.min(96, cell));

  const tryPlace = useCallback((piece: number, slot: number) => {
    if (slot === piece) {
      if (placed[piece]) return;
      sfx.place();
      const n = placed.slice();
      n[piece] = true;
      setPlaced(n);
      const done = n.filter(Boolean).length;
      api.progress(done, total);
      if (done === total) setTimeout(api.solved, 350);
      setSelected(null);
      if (hint === piece) setHint(null);
    } else {
      sfx.wrong();
      api.mistake();
      setWrongSlot(slot);
      setTimeout(() => setWrongSlot(null), 450);
    }
  }, [api, hint, placed, total]);

  const onDrop = useCallback((id: string, drop: string | null) => {
    if (drop?.startsWith('slot-')) tryPlace(Number(id), Number(drop.slice(5)));
  }, [tryPlace]);
  const onTap = useCallback((id: string) => { sfx.pick(); setSelected((s) => (s === Number(id) ? null : Number(id))); }, []);
  const { bind, dragging, over } = useDragDrop(onDrop, onTap);

  useEffect(() => {
    if (!api.hintTick) return;
    const left = tray.filter((i) => !placed[i]);
    if (!left.length) return;
    const h = left[0];
    setHint(h);
    setSelected(h);
    const t = setTimeout(() => setHint(null), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.hintTick]);

  const bgPos = (i: number) => `${cols > 1 ? ((i % cols) / (cols - 1)) * 100 : 0}% ${rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 100 : 0}%`;
  const pieceStyle = (i: number, size: number) => ({
    width: size, height: size, backgroundImage: `url("${image}")`, backgroundSize: `${cols * 100}% ${rows * 100}%`, backgroundPosition: bgPos(i),
  });
  const activePiece = dragging !== null ? Number(dragging) : selected;

  return (
    <div className="jig">
      <div className="jig-board-wrap" style={{ width: board }}>
        <div className="jig-board" style={{ width: board, height: board, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {data.ghost && <img className="jig-ghost" src={image} alt="" />}
          {Array.from({ length: total }, (_, i) => {
            const guide = api.guidance === 'strong' && activePiece === i;
            return (
              <div
                key={i}
                data-drop={`slot-${i}`}
                className={`jig-slot${placed[i] ? ' done' : ''}${over === `slot-${i}` ? ' over' : ''}${wrongSlot === i ? ' shake' : ''}${hint === i || guide ? ' glow hint' : ''}`}
                onClick={() => selected !== null && !placed[i] && tryPlace(selected, i)}
                role="button"
                aria-label={placed[i] ? `Spot ${i + 1}, filled` : `Spot ${i + 1}`}
              >
                {placed[i] && <div className="jig-placed" style={pieceStyle(i, cell)} />}
              </div>
            );
          })}
          {peek && <img className="jig-peek" src={image} alt="The finished picture" />}
        </div>
        <button className="btn ghost sm" style={{ marginTop: 12 }} onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onKeyDown={(e) => e.key === 'Enter' && setPeek((p) => !p)}>
          👀 Hold to peek
        </button>
      </div>
      <div className="jig-tray" style={{ maxWidth: Math.max(board, 320) }} aria-label="Puzzle pieces">
        {tray.map((i) => {
          if (placed[i]) return null;
          const b = bind(String(i), api.paused);
          return (
            <div key={i} className="jig-cell" style={{ width: pieceSize, height: pieceSize }}>
              <button
                className={`jig-piece${selected === i ? ' sel' : ''}${hint === i ? ' glow' : ''}`}
                aria-label={`Piece ${i + 1}`}
                {...b}
                style={{ ...pieceStyle(i, pieceSize), ...b.style }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
