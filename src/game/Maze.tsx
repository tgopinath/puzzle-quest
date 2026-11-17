import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio';
import { E, mazePath, N, S, W, type MazeData } from '../core/generators';
import type { GameApi } from './shared';
import { useBoardSize } from './useBoardSize';

const DIRS = { up: [0, -1, N], right: [1, 0, E], down: [0, 1, S], left: [-1, 0, W] } as const;
type Dir = keyof typeof DIRS;

export default function Maze({ data, api }: { data: MazeData; api: GameApi }) {
  const { w, h, walls, goal } = data;
  const [pos, setPos] = useState(data.start);
  const [trail, setTrail] = useState<number[]>([data.start]);
  const [got, setGot] = useState<Set<number>>(new Set());
  const [bump, setBump] = useState(false);
  const [hintPath, setHintPath] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [steps, setSteps] = useState(0);
  const done = useRef(false);
  const board = useBoardSize(0.55, 520);
  const cell = board / w;
  const rocks = new Set(data.rocks);

  const move = useCallback((d: Dir) => {
    if (api.paused || done.current) return;
    const [dx, dy, wall] = DIRS[d];
    const x = pos % w, y = Math.floor(pos / w);
    const nx = x + dx, ny = y + dy;
    const target = ny * w + nx;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h || walls[pos] & wall || rocks.has(target)) {
      sfx.wrong();
      api.mistake();
      setBump(true);
      setTimeout(() => setBump(false), 300);
      if (rocks.has(target)) { setNote('A rock is in the way! Try another path.'); setTimeout(() => setNote(null), 1600); }
      return;
    }
    sfx.tap();
    setPos(target);
    setSteps((s) => s + 1);
    setTrail((t) => (t[t.length - 2] === target ? t.slice(0, -1) : [...t, target]));
    setHintPath((p) => (p[0] === target ? p.slice(1) : []));
    let g = got;
    if (data.stars.includes(target) && !got.has(target)) { sfx.coin(); g = new Set(got).add(target); setGot(g); }
    const total = data.stars.length + 1;
    api.progress(g.size + (target === goal && g.size === data.stars.length ? 1 : 0), total);
    if (target === goal) {
      if (g.size < data.stars.length) { setNote('Collect all the stars first! ⭐'); setTimeout(() => setNote(null), 1800); return; }
      done.current = true;
      setTimeout(api.solved, 450);
    }
  }, [api, data.stars, goal, got, h, pos, rocks, w, walls]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const m: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      if (m[e.key]) { e.preventDefault(); move(m[e.key]); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [move]);

  useEffect(() => {
    if (!api.hintTick) return;
    const blocked = new Set(data.rocks);
    const targets = [...data.stars.filter((s) => !got.has(s)), goal];
    const target = targets[0];
    const p = mazePath({ w, h, walls }, pos, target, blocked);
    if (p) setHintPath(p.slice(1, 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.hintTick]);

  // Swipe on the board
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
      // tap on an adjacent cell
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cx = Math.floor((e.clientX - r.left) / cell), cy = Math.floor((e.clientY - r.top) / cell);
      const px = pos % w, py = Math.floor(pos / w);
      if (cx === px + 1 && cy === py) move('right');
      else if (cx === px - 1 && cy === py) move('left');
      else if (cy === py + 1 && cx === px) move('down');
      else if (cy === py - 1 && cx === px) move('up');
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  };

  const lw = Math.max(3, cell * 0.08);
  const px = pos % w, py = Math.floor(pos / w);
  const ctr = (c: number) => [((c % w) + 0.5) * cell, (Math.floor(c / w) + 0.5) * cell];
  const showNeighbours = api.guidance === 'strong';

  return (
    <div className="maze">
      <div className={`maze-board${bump ? ' shake' : ''}`} style={{ width: board, height: board }} onPointerDown={onDown} onPointerUp={onUp} aria-label={`Maze. You are at column ${px + 1}, row ${py + 1}. Use arrow keys or swipe.`} role="application">
        <svg width={board} height={board} viewBox={`0 0 ${board} ${board}`}>
          <rect width={board} height={board} rx="16" fill="#F2FFF6" />
          {hintPath.map((c) => { const [x, y] = ctr(c); return <circle key={`h${c}`} cx={x} cy={y} r={cell * 0.14} fill="#FFC93C" opacity="0.9" />; })}
          <polyline points={trail.map((c) => ctr(c).join(',')).join(' ')} fill="none" stroke="#8B5CF6" strokeOpacity="0.35" strokeWidth={cell * 0.18} strokeLinecap="round" strokeLinejoin="round" />
          {showNeighbours && [N, E, S, W].map((dir) => {
            if (walls[pos] & dir) return null;
            const t = dir === N ? pos - w : dir === E ? pos + 1 : dir === S ? pos + w : pos - 1;
            if (t < 0 || t >= w * h || rocks.has(t)) return null;
            const [x, y] = ctr(t);
            return <rect key={dir} x={x - cell / 2 + lw} y={y - cell / 2 + lw} width={cell - lw * 2} height={cell - lw * 2} rx={cell * 0.15} fill="#3BA9F5" opacity="0.12" />;
          })}
          {walls.map((m, c) => {
            const x = (c % w) * cell, y = Math.floor(c / w) * cell;
            const out = [];
            if (m & N) out.push(<line key="n" x1={x} y1={y} x2={x + cell} y2={y} />);
            if (m & W) out.push(<line key="w" x1={x} y1={y} x2={x} y2={y + cell} />);
            if (c % w === w - 1 && m & E) out.push(<line key="e" x1={x + cell} y1={y} x2={x + cell} y2={y + cell} />);
            if (Math.floor(c / w) === h - 1 && m & S) out.push(<line key="s" x1={x} y1={y + cell} x2={x + cell} y2={y + cell} />);
            if (m & E && c % w !== w - 1) out.push(<line key="e2" x1={x + cell} y1={y} x2={x + cell} y2={y + cell} />);
            if (m & S && Math.floor(c / w) !== h - 1) out.push(<line key="s2" x1={x} y1={y + cell} x2={x + cell} y2={y + cell} />);
            return <g key={c} stroke="#2F9E62" strokeWidth={lw} strokeLinecap="round">{out}</g>;
          })}
          {data.rocks.map((c) => { const [x, y] = ctr(c); return <text key={`r${c}`} x={x} y={y} fontSize={cell * 0.62} textAnchor="middle" dominantBaseline="central">🪨</text>; })}
          {data.stars.filter((s) => !got.has(s)).map((c) => { const [x, y] = ctr(c); return <text key={`s${c}`} x={x} y={y} fontSize={cell * 0.56} textAnchor="middle" dominantBaseline="central">⭐</text>; })}
          {(() => { const [x, y] = ctr(goal); return <text x={x} y={y} fontSize={cell * 0.66} textAnchor="middle" dominantBaseline="central">💎</text>; })()}
          <g style={{ transform: `translate(${(px + 0.5) * cell}px, ${(py + 0.5) * cell}px)`, transition: 'transform 0.14s ease-out' }}>
            <text fontSize={cell * 0.7} textAnchor="middle" dominantBaseline="central">🧭</text>
          </g>
        </svg>
      </div>
      <p className="maze-note" aria-live="polite">{note ?? (done.current && steps <= data.shortest ? '🏆 Shortest route!' : ' ')}</p>
      <div className="dpad" aria-label="Move">
        <button className="icon-btn up" onClick={() => move('up')} aria-label="Up">⬆️</button>
        <button className="icon-btn left" onClick={() => move('left')} aria-label="Left">⬅️</button>
        <button className="icon-btn right" onClick={() => move('right')} aria-label="Right">➡️</button>
        <button className="icon-btn down" onClick={() => move('down')} aria-label="Down">⬇️</button>
      </div>
    </div>
  );
}
