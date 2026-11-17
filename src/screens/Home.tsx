import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio';
import { ACHIEVEMENTS } from '../core/achievements';
import { actions, attemptsFor, earnedFor } from '../core/db';
import { hashSeed } from '../core/rng';
import { levelProgress } from '../core/rewards';
import { dayKey } from '../core/rng';
import type { CategoryId, Child } from '../core/types';
import { CATEGORY_META, COSTUMES, isUnlocked, WORLDS, type World } from '../core/worlds';
import { Avatar, Modal, toast, useDB } from '../ui/ui';
import { AvatarPicker } from './Onboarding';

export interface HomeProps {
  child: Child;
  onPlay: (c: CategoryId, daily?: boolean) => void;
  onParent: () => void;
}

export function dailyCategory(child: Child): CategoryId {
  const unlocked = WORLDS.filter((_, i) => isUnlocked(child, i));
  return unlocked[hashSeed(dayKey() + child.id) % unlocked.length].category;
}

export default function Home({ child, onPlay, onParent }: HomeProps) {
  const db = useDB();
  const [world, setWorld] = useState<World | null>(null);
  const [modal, setModal] = useState<'trophies' | 'shop' | 'me' | null>(null);
  const lp = levelProgress(child.xp);
  const attempts = attemptsFor(child.id, db);
  const solved = attempts.filter((a) => a.solved).length;
  const earned = new Set(earnedFor(child.id, db).map((e) => e.achievementId));
  const last = [...attempts].reverse().find((a) => !a.daily);
  const continueCat: CategoryId = last?.category ?? 'jigsaw';
  const daily = dailyCategory(child);
  const dailyDone = child.dailyDone === dayKey();

  return (
    <div className="page home">
      <header className="home-top">
        <button className="me-btn" onClick={() => setModal('me')} aria-label="My profile">
          <Avatar face={child.avatar} costume={child.costume} size={60} />
          <div className="col" style={{ gap: 4, alignItems: 'flex-start' }}>
            <b className="me-name">{child.name}</b>
            <div className="row" style={{ gap: 8 }}>
              <span className="lvl">Lv {lp.level}</span>
              <div className="bar" style={{ width: 90 }}><i style={{ width: `${lp.pct * 100}%` }} /></div>
            </div>
          </div>
        </button>
        <div className="home-stats">
          <span className="stat" title="Stars">⭐ <b>{child.stars}</b></span>
          <span className="stat" title="Coins">🪙 <b>{child.coins}</b></span>
          <span className="stat" title="Day streak">🔥 <b>{child.streak.count}</b></span>
          <span className="stat hide-sm" title="Puzzles solved">🧩 <b>{solved}</b></span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={() => setModal('trophies')} aria-label="Trophies">🏆</button>
          <button className="icon-btn" onClick={() => setModal('shop')} aria-label="Costume shop">🎩</button>
          <button className="icon-btn" onClick={onParent} aria-label="Grown-ups area">🔒</button>
        </div>
      </header>

      <div className="home-grid">
        <section className="home-main">
          <div className="hero-row">
            <button className="hero-card continue" onClick={() => { sfx.tap(); onPlay(continueCat); }}>
              <span className="hero-emoji">{CATEGORY_META[continueCat].emoji}</span>
              <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}>
                <span className="hero-kicker">{last ? 'Continue playing' : 'Start here'}</span>
                <b className="hero-title">{WORLDS.find((w) => w.category === continueCat)!.name}</b>
              </span>
              <span className="hero-go">▶</span>
            </button>
            <button className={`hero-card daily${dailyDone ? ' done' : ''}`} onClick={() => { if (dailyDone) toast('You did today’s challenge! Come back tomorrow ☀️'); else { sfx.tap(); onPlay(daily, true); } }}>
              <span className="hero-emoji">{dailyDone ? '✅' : '☀️'}</span>
              <span className="col" style={{ gap: 2, alignItems: 'flex-start' }}>
                <span className="hero-kicker">Daily challenge · +15 🪙</span>
                <b className="hero-title">{dailyDone ? 'Done for today!' : CATEGORY_META[daily].name}</b>
              </span>
              <span className="hero-go">{dailyDone ? '' : '▶'}</span>
            </button>
          </div>

          <div className="card map-card">
            <div className="row spread" style={{ marginBottom: 6 }}>
              <h2>Adventure map</h2>
              <span className="subtle">{WORLDS.filter((_, i) => isUnlocked(child, i)).length} of {WORLDS.length} worlds open</span>
            </div>
            <AdventureMap child={child} onOpen={(w) => { sfx.tap(); setWorld(w); }} />
          </div>
        </section>

        <aside className="home-side">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Pick a puzzle</h3>
            <div className="cat-grid">
              {WORLDS.map((w, i) => {
                const open = isUnlocked(child, i);
                const m = CATEGORY_META[w.category];
                return (
                  <button key={w.id} className={`cat-btn${open ? '' : ' locked'}`} style={{ ['--c' as string]: m.color }} onClick={() => open ? onPlay(w.category) : toast(`Finish 3 levels in ${WORLDS[i - 1].name} to open this!`)} aria-label={`${m.name}${open ? '' : ', locked'}`}>
                    <span className="cat-emoji">{open ? m.emoji : '🔒'}</span>
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="row spread" style={{ marginBottom: 10 }}>
              <h3>Trophies</h3>
              <button className="btn ghost sm" onClick={() => setModal('trophies')}>See all</button>
            </div>
            <div className="trophy-strip">
              {ACHIEVEMENTS.slice(0, 8).map((a) => (
                <span key={a.id} className={`trophy-mini${earned.has(a.id) ? ' on' : ''}`} title={a.name}>{a.emoji}</span>
              ))}
            </div>
            <p className="subtle" style={{ marginTop: 8 }}>{earned.size} of {ACHIEVEMENTS.length} earned</p>
          </div>
        </aside>
      </div>

      {world && <WorldSheet world={world} child={child} onClose={() => setWorld(null)} onPlay={() => { setWorld(null); onPlay(world.category); }} />}
      {modal === 'trophies' && <Trophies earned={earned} onClose={() => setModal(null)} />}
      {modal === 'shop' && <Shop child={child} onClose={() => setModal(null)} />}
      {modal === 'me' && <MeSheet child={child} onClose={() => setModal(null)} />}
    </div>
  );
}

function AdventureMap({ child, onOpen }: { child: Child; onOpen: (w: World) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = width > 720 ? 4 : 2;
  const rows = Math.ceil(WORLDS.length / cols);
  const rowH = cols === 4 ? 190 : 170;
  const height = rows * rowH;
  const pos = WORLDS.map((_, i) => {
    const r = Math.floor(i / cols);
    let c = i % cols;
    if (r % 2 === 1) c = cols - 1 - c; // snake path
    return { x: ((c + 0.5) / cols) * width, y: r * rowH + rowH / 2 + (c % 2 ? 14 : -14) };
  });
  const d = pos.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const q = pos[i - 1];
    const sameRow = Math.abs(q.y - p.y) < rowH / 2;
    return acc + (sameRow
      ? ` C${(q.x + p.x) / 2},${q.y - 40} ${(q.x + p.x) / 2},${p.y + 40} ${p.x},${p.y}`
      : ` C${q.x + (q.x > width / 2 ? 90 : -90)},${q.y} ${p.x + (p.x > width / 2 ? 90 : -90)},${p.y} ${p.x},${p.y}`);
  }, '');
  const unlockedCount = WORLDS.filter((_, i) => isUnlocked(child, i)).length;

  return (
    <div ref={ref} className="map" style={{ height }}>
      <svg width={width} height={height} className="map-path" aria-hidden>
        <path d={d} fill="none" stroke="#E3D9FF" strokeWidth="22" strokeLinecap="round" />
        <path d={d} fill="none" stroke="#B9A4FF" strokeWidth="4" strokeDasharray="2 14" strokeLinecap="round" />
      </svg>
      {WORLDS.map((w, i) => {
        const open = isUnlocked(child, i);
        const done = Math.min(w.levels, child.worldLevels[w.id] ?? 0);
        const current = open && i === unlockedCount - 1;
        return (
          <button
            key={w.id}
            className={`world-node${open ? '' : ' locked'}${current ? ' current' : ''}`}
            style={{ left: pos[i].x, top: pos[i].y, ['--c' as string]: w.color }}
            onClick={() => onOpen(w)}
            aria-label={`${w.name}, ${open ? `${done} of ${w.levels} levels` : 'locked'}`}
          >
            <span className="world-ball">
              <span className="world-emoji">{open ? w.emoji : '🔒'}</span>
              {current && <span className="world-me"><Avatar face={child.avatar} costume={child.costume} size={34} /></span>}
            </span>
            <span className="world-name">{w.name}</span>
            {open && <span className="world-prog">{done}/{w.levels}</span>}
          </button>
        );
      })}
    </div>
  );
}

function WorldSheet({ world, child, onClose, onPlay }: { world: World; child: Child; onClose: () => void; onPlay: () => void }) {
  const idx = WORLDS.indexOf(world);
  const open = isUnlocked(child, idx);
  const done = child.worldLevels[world.id] ?? 0;
  return (
    <Modal label={world.name} onClose={onClose}>
      <div className="col center-text" style={{ gap: 14 }}>
        <div className="world-hero" style={{ background: world.color }}>{open ? world.emoji : '🔒'}</div>
        <h2>{world.name}</h2>
        <p className="muted">{world.tagline}</p>
        <div className="level-dots" aria-label={`${Math.min(done, world.levels)} of ${world.levels} levels done`}>
          {Array.from({ length: world.levels }, (_, i) => (
            <span key={i} className={`ldot${i < done ? ' on' : ''}${open && i === done ? ' next' : ''}`}>{i < done ? '⭐' : i + 1}</span>
          ))}
        </div>
        {open ? (
          <button className="btn green lg block" onClick={onPlay} autoFocus>{done >= world.levels ? 'Play bonus puzzle ▶' : `Play level ${done + 1} ▶`}</button>
        ) : (
          <p className="chip yellow" style={{ whiteSpace: 'normal' }}>Finish {world.unlockAfter} levels in {WORLDS[idx - 1].name} to open this world!</p>
        )}
      </div>
    </Modal>
  );
}

function Trophies({ earned, onClose }: { earned: Set<string>; onClose: () => void }) {
  return (
    <Modal label="Trophies" onClose={onClose} wide>
      <div className="row spread" style={{ marginBottom: 16 }}><h2>🏆 Trophy room</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✖️</button></div>
      <div className="trophy-grid">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`trophy${earned.has(a.id) ? ' on' : ''}`}>
            <span className="trophy-emoji">{earned.has(a.id) ? a.emoji : '❔'}</span>
            <b>{a.name}</b>
            <span className="subtle">{a.description}</span>
            <span className="chip yellow">{a.reward.type === 'coins' ? `🪙 ${a.reward.value}` : a.reward.type === 'avatar' ? `New buddy ${a.reward.value}` : `Costume ${COSTUMES.find((c) => c.id === a.reward.value)?.emoji}`}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Shop({ child, onClose }: { child: Child; onClose: () => void }) {
  return (
    <Modal label="Costume shop" onClose={onClose} wide>
      <div className="row spread" style={{ marginBottom: 8 }}><h2>🎩 Costume shop</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✖️</button></div>
      <div className="row" style={{ marginBottom: 16, gap: 16 }}>
        <Avatar face={child.avatar} costume={child.costume} size={84} />
        <div><b>You have 🪙 {child.coins}</b><p className="subtle">Earn coins by finishing puzzles — trying hard counts too!</p></div>
      </div>
      <div className="shop-grid">
        {COSTUMES.map((c) => {
          const owned = child.ownedCostumes.includes(c.id);
          const wearing = child.costume === c.id;
          return (
            <div key={c.id} className={`shop-item${wearing ? ' on' : ''}`}>
              <span style={{ fontSize: 44 }}>{c.emoji}</span>
              <b>{c.name}</b>
              {owned ? (
                <button className="btn sm" onClick={() => actions.editChild(child.id, { costume: wearing ? null : c.id })}>{wearing ? 'Take off' : 'Wear'}</button>
              ) : (
                <button className="btn yellow sm" disabled={child.coins < c.price} onClick={() => { if (actions.buyCostume(child.id, c.id, c.price)) { sfx.coin(); toast(`You got the ${c.name}!`); } }}>🪙 {c.price}</button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function MeSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const db = useDB();
  const lp = levelProgress(child.xp);
  return (
    <Modal label="My profile" onClose={onClose}>
      <div className="col center-text" style={{ gap: 14 }}>
        <Avatar face={child.avatar} costume={child.costume} size={96} />
        <h2>{child.name}</h2>
        <p className="muted">Player level {lp.level} · {lp.toNext} XP to the next level</p>
        <p><b>⭐ {child.stars}</b> stars · <b>🪙 {child.coins}</b> coins · <b>🔥 {child.streak.count}</b>-day streak</p>
        <h3>Change my buddy</h3>
        <AvatarPicker value={child.avatar} options={child.unlockedAvatars} onPick={(a) => actions.editChild(child.id, { avatar: a })} />
        <p className="subtle">Earn trophies to unlock more buddies!</p>
        {db.children.length > 1 && (
          <>
            <h3>Switch player</h3>
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              {db.children.map((c) => (
                <button key={c.id} className={`btn ${c.id === child.id ? 'purple' : 'ghost'} sm`} onClick={() => { actions.setActive(c.id); onClose(); }}>{c.avatar} {c.name}</button>
              ))}
            </div>
          </>
        )}
        <button className="btn ghost block" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
