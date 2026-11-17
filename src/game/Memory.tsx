import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio';
import type { MemoryData } from '../core/generators';
import type { GameApi } from './shared';

export default function Memory({ data, api }: { data: MemoryData; api: GameApi }) {
  const { cards } = data;
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [peeking, setPeeking] = useState(data.peekMs > 0);
  const [hinted, setHinted] = useState<number[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    if (!data.peekMs) return;
    const t = setTimeout(() => setPeeking(false), data.peekMs);
    return () => clearTimeout(t);
  }, [data.peekMs]);

  useEffect(() => {
    if (!api.hintTick) return;
    const left = cards.map((c, i) => ({ c, i })).filter(({ c }) => !matched.has(c.face));
    if (!left.length) return;
    const face = left[0].c.face;
    const pair = left.filter(({ c }) => c.face === face).map(({ i }) => i);
    setHinted(pair);
    const t = setTimeout(() => setHinted([]), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.hintTick]);

  const flip = (i: number) => {
    if (api.paused || peeking || busy.current || open.includes(i) || matched.has(cards[i].face)) return;
    sfx.flip();
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next;
    busy.current = true;
    if (cards[a].face === cards[b].face) {
      setTimeout(() => {
        sfx.place();
        const m = new Set(matched).add(cards[a].face);
        setMatched(m);
        setOpen([]);
        busy.current = false;
        api.progress(m.size, cards.length / 2);
        if (m.size === cards.length / 2) setTimeout(api.solved, 400);
      }, 350);
    } else {
      setTimeout(() => {
        sfx.wrong();
        api.mistake();
        setOpen([]);
        busy.current = false;
      }, 900);
    }
  };

  const size = cards.length > 16 ? 'clamp(52px, 13vw, 92px)' : 'clamp(64px, 18vw, 120px)';
  return (
    <div className="mem" style={{ gridTemplateColumns: `repeat(${data.columns}, ${size})` }}>
      {cards.map((c, i) => {
        const up = peeking || open.includes(i) || matched.has(c.face) || hinted.includes(i);
        return (
          <button
            key={c.id}
            className={`mem-card${up ? ' up' : ''}${matched.has(c.face) ? ' matched' : ''}`}
            style={{ width: size, height: size }}
            onClick={() => flip(i)}
            aria-label={up ? c.face : `Card ${i + 1}, face down`}
          >
            <span className="mem-inner">
              <span className="mem-back">?</span>
              <span className="mem-face">{c.face}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
