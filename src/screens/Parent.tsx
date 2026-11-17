import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACHIEVEMENTS } from '../core/achievements';
import { DEFAULT_ENGINE } from '../core/adaptive';
import { actions, attemptsFor, earnedFor, progressFor, settingsFor, type DB } from '../core/db';
import { AGE_GROUPS, LEVELS } from '../core/difficulty';
import { dayKey, uid } from '../core/rng';
import { levelFromXp } from '../core/rewards';
import { CATEGORY_IDS, type CategoryId, type Child, type Difficulty, type EngineConfig } from '../core/types';
import { CATEGORY_META } from '../core/worlds';
import { useBackHandler } from '../native';
import { Avatar, Modal, Switch, toast, useDB } from '../ui/ui';
import { AvatarPicker, ChildForm } from './Onboarding';

type Tab = 'progress' | 'children' | 'settings' | 'content';
let lastTab: Tab = 'progress'; // remembered while the app is open (e.g. after a puzzle preview)

export default function Parent({ onExit, onPreview }: { onExit: () => void; onPreview: (c: CategoryId, d: Difficulty) => void }) {
  const db = useDB();
  const [tab, setTabState] = useState<Tab>(lastTab);
  const setTab = (t: Tab) => { lastTab = t; setTabState(t); };
  const [childId, setChildId] = useState(db.activeChildId ?? db.children[0]?.id);
  const child = db.children.find((c) => c.id === childId) ?? db.children[0];
  useBackHandler(onExit);

  return (
    <div className="page parent">
      <header className="row spread wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div>
          <span className="subtle">Parent dashboard</span>
          <h1>Hi {db.parent?.name.split(' ')[0]} 👋</h1>
        </div>
        <button className="btn green" onClick={onExit}>▶ Back to the game</button>
      </header>

      <div className="row wrap" style={{ gap: 12, marginBottom: 18 }}>
        {db.children.length > 1 && (
          <div className="row wrap" style={{ gap: 8 }} role="group" aria-label="Choose child">
            {db.children.map((c) => (
              <button key={c.id} className={`child-pill${c.id === child?.id ? ' on' : ''}`} onClick={() => setChildId(c.id)}>
                <Avatar face={c.avatar} costume={c.costume} size={30} /> {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="tabs" role="tablist" style={{ marginLeft: 'auto' }}>
          {([['progress', '📈 Progress'], ['children', '👧 Children'], ['settings', '⚙️ Settings'], ['content', '🧰 Content & tuning']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'progress' && child && <ProgressTab db={db} child={child} />}
      {tab === 'children' && <ChildrenTab db={db} />}
      {tab === 'settings' && child && <SettingsTab db={db} child={child} />}
      {tab === 'content' && <ContentTab db={db} onPreview={onPreview} />}
    </div>
  );
}

/* ---------- Progress ---------- */

const fmtMin = (sec: number) => (sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`);

function ProgressTab({ db, child }: { db: DB; child: Child }) {
  const attempts = attemptsFor(child.id, db);
  const solved = attempts.filter((a) => a.solved);
  const accuracy = attempts.length ? Math.round((attempts.filter((a) => a.solved && a.mistakes <= a.mistakeTolerance).length / attempts.length) * 100) : 0;
  const playSec = Object.values(db.playTime[child.id] ?? {}).reduce((s, v) => s + v, 0);
  const earned = earnedFor(child.id, db);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const t = Date.now() - (13 - i) * 86400000;
    const k = dayKey(t);
    const day = attempts.filter((a) => dayKey(a.completedAt) === k);
    return {
      day: new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      puzzles: day.filter((a) => a.solved).length,
      minutes: Math.round((db.playTime[child.id]?.[k] ?? 0) / 60),
      score: day.length ? Math.round((day.reduce((s, a) => s + a.score, 0) / day.length) * 100) : null,
    };
  }), [attempts, db.playTime, child.id]);

  const week = (offset: number) => attempts.filter((a) => a.solved && a.completedAt > Date.now() - (offset + 7) * 86400000 && a.completedAt <= Date.now() - offset * 86400000).length;
  const thisWeek = week(0), lastWeek = week(7);

  const cats = CATEGORY_IDS.map((c) => {
    const p = progressFor(child, c, db);
    const list = attempts.filter((a) => a.category === c);
    const recent = list.slice(-6);
    const avg = recent.length ? recent.reduce((s, a) => s + a.score, 0) / recent.length : null;
    const timeRatio = list.filter((a) => a.solved).length ? list.filter((a) => a.solved).reduce((s, a) => s + a.timeSec / a.expectedSec, 0) / list.filter((a) => a.solved).length : null;
    return { c, p, n: list.length, solved: list.filter((a) => a.solved).length, acc: list.length ? Math.round((p.correct / Math.max(1, p.attempts)) * 100) : null, avg, timeRatio };
  });
  const played = cats.filter((x) => x.n >= 3 && x.avg !== null).sort((a, b) => b.avg! - a.avg!);
  const strengths = played.slice(0, 2);
  const practice = played.length > 2 ? played.slice(-2).reverse().filter((x) => !strengths.includes(x)) : [];
  const untried = cats.filter((x) => x.n === 0);

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="kpi-grid">
        <Kpi label="Total play time" value={fmtMin(playSec)} sub={`${fmtMin(db.playTime[child.id]?.[dayKey()] ?? 0)} today`} />
        <Kpi label="Puzzles completed" value={String(solved.length)} sub={`${thisWeek} this week · ${lastWeek} last week`} />
        <Kpi label="Accuracy" value={attempts.length ? `${accuracy}%` : '—'} sub="Solved with few mistakes" />
        <Kpi label="Streak" value={`${child.streak.count} day${child.streak.count === 1 ? '' : 's'}`} sub={`Best: ${child.streak.best}`} />
        <Kpi label="Player level" value={String(levelFromXp(child.xp))} sub={`⭐ ${child.stars} · 🪙 ${child.coins}`} />
      </div>

      {!attempts.length && <div className="card muted">No puzzles played yet. Progress appears here as soon as {child.name} finishes a puzzle.</div>}

      <div className="chart-grid">
        <ChartCard title="Puzzles completed per day" sub="Last 14 days">
          <BarChart data={days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF2F8" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8592AD' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8592AD' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(59,169,245,0.08)' }} formatter={(v) => [v, 'Puzzles']} />
            <Bar dataKey="puzzles" fill="#3BA9F5" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Minutes played per day" sub="Last 14 days">
          <BarChart data={days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF2F8" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8592AD' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8592AD' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(139,92,246,0.08)' }} formatter={(v) => [`${v} min`, 'Played']} />
            <Bar dataKey="minutes" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Performance score over time" sub="Average puzzle score per day (0–100)">
          <LineChart data={days} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF2F8" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8592AD' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8592AD' }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, 'Score']} />
            <Line dataKey="score" stroke="#23A555" strokeWidth={2} dot={{ r: 4, fill: '#23A555', stroke: '#fff', strokeWidth: 2 }} connectNulls />
          </LineChart>
        </ChartCard>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>💪 Strengths</h3>
          {strengths.length ? strengths.map((x) => <InsightRow key={x.c} c={x.c} text={`${LEVELS[x.p.difficulty].name} level · score ${Math.round(x.avg! * 100)}`} />) : <p className="subtle">Needs at least 3 puzzles in a category.</p>}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>🌱 Areas to practise</h3>
          {practice.map((x) => <InsightRow key={x.c} c={x.c} text={`Score ${Math.round(x.avg! * 100)} — a few more tries at ${LEVELS[x.p.difficulty].name} will help`} />)}
          {untried.slice(0, 3).map((x) => <InsightRow key={x.c} c={x.c} text="Not tried yet" />)}
          {!practice.length && !untried.length && <p className="subtle">Nothing stands out yet.</p>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Puzzle types</h3>
        <p className="subtle" style={{ marginBottom: 10 }}>Each type adapts on its own. Difficulty moves up after 3 strong puzzles in a row and down after 2 tough ones.</p>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Type</th><th>Current difficulty</th><th>Played</th><th>Solved</th><th>Accuracy</th><th>Speed</th><th>Last change</th></tr></thead>
            <tbody>
              {cats.map((x) => (
                <tr key={x.c}>
                  <td><span className="row" style={{ gap: 8 }}><span className="cat-dot" style={{ background: CATEGORY_META[x.c].color }} />{CATEGORY_META[x.c].emoji} {CATEGORY_META[x.c].name}</span></td>
                  <td><span className="diff-dots" aria-label={`Level ${x.p.difficulty} of 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= x.p.difficulty ? 'on' : ''} />)}</span> <span className="subtle">{LEVELS[x.p.difficulty].name}</span></td>
                  <td>{x.n}</td>
                  <td>{x.solved}</td>
                  <td>{x.acc === null ? '—' : `${x.acc}%`}</td>
                  <td>{x.timeRatio === null ? '—' : x.timeRatio <= 0.9 ? 'Quick' : x.timeRatio <= 1.4 ? 'On pace' : 'Takes time'}</td>
                  <td>{x.p.lastChange === 'up' ? '⬆️ Harder' : x.p.lastChange === 'down' ? '⬇️ Easier' : x.n ? '— Same' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Achievements ({earned.length}/{ACHIEVEMENTS.length})</h3>
        <div className="ach-list">
          {ACHIEVEMENTS.map((a) => {
            const e = earned.find((x) => x.achievementId === a.id);
            return (
              <div key={a.id} className={`ach-row${e ? ' on' : ''}`}>
                <span style={{ fontSize: 26 }}>{e ? a.emoji : '⬜'}</span>
                <div className="grow"><b>{a.name}</b><div className="subtle">{a.description}</div></div>
                <span className="subtle">{e ? new Date(e.earnedAt).toLocaleDateString() : ''}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card kpi"><span className="subtle">{label}</span><b className="kpi-v">{value}</b><span className="subtle">{sub}</span></div>;
}
function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactElement }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="subtle" style={{ marginBottom: 8 }}>{sub}</p>
      <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}
function InsightRow({ c, text }: { c: CategoryId; text: string }) {
  return <div className="row" style={{ padding: '6px 0' }}><span style={{ fontSize: 26 }}>{CATEGORY_META[c].emoji}</span><div><b>{CATEGORY_META[c].name}</b><div className="subtle">{text}</div></div></div>;
}

/* ---------- Children ---------- */

function ChildrenTab({ db }: { db: DB }) {
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ name: string; age: Child['ageGroup'] } | null>(null);
  const [removing, setRemoving] = useState<Child | null>(null);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="child-grid">
        {db.children.map((c) => (
          <div key={c.id} className="card col" style={{ gap: 12 }}>
            <div className="row">
              <Avatar face={c.avatar} costume={c.costume} size={56} />
              <div className="grow">
                <input className="input" style={{ height: 44 }} defaultValue={c.name} maxLength={20} aria-label="Name" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && (actions.editChild(c.id, { name: e.target.value.trim() }), toast('Name saved'))} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`age-${c.id}`}>Age group</label>
              <select id={`age-${c.id}`} className="input" value={c.ageGroup} onChange={(e) => { actions.editChild(c.id, { ageGroup: e.target.value as Child['ageGroup'] }); toast('Age group updated'); }}>
                {AGE_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.ages})</option>)}
              </select>
              <span className="subtle">Changes the starting level for puzzle types not played yet.</span>
            </div>
            <div className="row wrap">
              {db.activeChildId === c.id ? <span className="chip green">Playing now</span> : <button className="btn sm" onClick={() => actions.setActive(c.id)}>Set as player</button>}
              <button className="btn ghost sm" onClick={() => setRemoving(c)}>Remove</button>
            </div>
          </div>
        ))}
        <button className="card add-child" onClick={() => setAdding(true)}>＋ Add a child</button>
      </div>

      {adding && (
        <Modal label="Add a child" onClose={() => { setAdding(false); setPending(null); }}>
          <h2 style={{ marginBottom: 16 }}>{pending ? `Pick a buddy for ${pending.name}` : 'Add a child'}</h2>
          {!pending ? <ChildForm onDone={(name, age) => setPending({ name, age })} /> : (
            <AvatarPicker value={null} options={['🦊', '🐼', '🐯', '🐰', '🐸', '🐵']} onPick={(a) => { actions.addChild(pending.name, pending.age, a); setAdding(false); setPending(null); toast('Child added'); }} />
          )}
        </Modal>
      )}
      {removing && (
        <Modal label="Remove child" onClose={() => setRemoving(null)}>
          <h2>Remove {removing.name}?</h2>
          <p className="muted" style={{ margin: '10px 0 18px' }}>This permanently deletes {removing.name}’s profile, progress and achievements from this device. It can’t be undone.</p>
          <div className="row"><button className="btn danger" onClick={() => { actions.removeChild(removing.id); setRemoving(null); }}>Remove</button><button className="btn ghost" onClick={() => setRemoving(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */

function SettingsTab({ db, child }: { db: DB; child: Child }) {
  const s = settingsFor(child.id, db);
  const [confirm, setConfirm] = useState(false);
  const [newPin, setNewPin] = useState('');
  const set = (patch: Partial<typeof s>) => actions.setSettings(child.id, patch);
  return (
    <div className="two-col">
      <div className="card col" style={{ gap: 4 }}>
        <h3 style={{ marginBottom: 8 }}>{child.name}’s settings</h3>
        <SettingRow title="Sound effects" desc="Taps, matches and celebrations"><Switch checked={s.sound} onChange={(v) => set({ sound: v })} label="Sound effects" /></SettingRow>
        <SettingRow title="Read instructions aloud" desc="Uses the device voice"><Switch checked={s.audioInstructions} onChange={(v) => set({ audioInstructions: v })} label="Audio instructions" /></SettingRow>
        <SettingRow title="Timers" desc="Only on Medium and harder puzzles. Running out never fails a puzzle."><Switch checked={s.timers} onChange={(v) => set({ timers: v })} label="Timers" /></SettingRow>
        <SettingRow title="Daily screen-time limit" desc="A friendly break screen appears when time is up">
          <select className="input" style={{ height: 44, width: 130 }} value={s.dailyLimitMin} onChange={(e) => set({ dailyLimitMin: Number(e.target.value) })} aria-label="Daily limit">
            {[0, 10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m ? `${m} min` : 'No limit'}</option>)}
          </select>
        </SettingRow>
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 16 }}>
          <button className="btn danger sm" onClick={() => setConfirm(true)}>Reset {child.name}’s progress</button>
        </div>
      </div>
      <div className="card col" style={{ gap: 12 }}>
        <h3>Parent account</h3>
        <p className="muted">{db.parent?.name} · {db.parent?.email}</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (/^\d{4}$/.test(newPin)) { actions.updateParent({ pin: newPin }); setNewPin(''); toast('PIN changed'); } }}>
          <input className="input grow" inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} aria-label="New PIN" type="password" />
          <button className="btn sm" disabled={newPin.length !== 4}>Change PIN</button>
        </form>
        <h3 style={{ marginTop: 8 }}>Privacy</h3>
        <p className="subtle">Puzzle Quest stores only your name and email, and each child’s first name, age group and play history. There are no ads, no chat, no links out of the game, and nothing is shared. Data is saved on this device.</p>
      </div>
      {confirm && (
        <Modal label="Reset progress" onClose={() => setConfirm(false)}>
          <h2>Reset {child.name}’s progress?</h2>
          <p className="muted" style={{ margin: '10px 0 18px' }}>Stars, coins, levels, achievements, costumes and puzzle history will be cleared. The profile stays. This can’t be undone.</p>
          <div className="row"><button className="btn danger" onClick={() => { actions.resetProgress(child.id); setConfirm(false); toast('Progress reset'); }}>Reset progress</button><button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}

function SettingRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return <div className="row spread" style={{ padding: '12px 0', gap: 16 }}><div><b>{title}</b><div className="subtle">{desc}</div></div>{children}</div>;
}

/* ---------- Content & tuning (admin) ---------- */

function ContentTab({ db, onPreview }: { db: DB; onPreview: (c: CategoryId, d: Difficulty) => void }) {
  const [cfg, setCfg] = useState<EngineConfig>(db.engine);
  const [pc, setPc] = useState<CategoryId>('jigsaw');
  const [pd, setPd] = useState<Difficulty>(1);
  const [odd, setOdd] = useState({ items: '', odd: 0, why: '' });
  const [seq, setSeq] = useState({ title: '', steps: '' });

  const stats = CATEGORY_IDS.flatMap((c) => ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => {
    const list = db.attempts.filter((a) => a.category === c && a.difficulty === d);
    if (!list.length) return null;
    const ok = list.filter((a) => a.solved);
    return { c, d, n: list.length, success: Math.round((ok.length / list.length) * 100), time: ok.length ? ok.reduce((s, a) => s + a.timeSec / a.expectedSec, 0) / ok.length : null, hints: list.reduce((s, a) => s + a.hintsUsed, 0) / list.length };
  })).filter(Boolean) as { c: CategoryId; d: Difficulty; n: number; success: number; time: number | null; hints: number }[];

  const oddItems = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(odd.items.replace(/\s/g, ''))].map((s) => s.segment);
  const seqSteps = seq.steps.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [emoji, ...rest] = l.split(/\s+/); return { emoji, label: rest.join(' ') || emoji }; });

  const num = (k: keyof EngineConfig, label: string, min: number, max: number, step: number, help: string) => (
    <div className="field">
      <label htmlFor={k}>{label}: <b>{cfg[k]}</b></label>
      <input id={k} type="range" min={min} max={max} step={step} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} />
      <span className="subtle">{help}</span>
    </div>
  );

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="two-col">
        <div className="card col" style={{ gap: 14 }}>
          <h3>Adaptive engine tuning</h3>
          {num('upStreak', 'Strong puzzles in a row to level up', 2, 5, 1, 'Spec default: 3')}
          {num('downStreak', 'Tough puzzles in a row to step down', 2, 4, 1, 'Spec default: 2')}
          {num('strongScore', '“Strong” score threshold', 0.6, 0.95, 0.05, 'Score at or above this counts as strong')}
          {num('struggleScore', '“Struggle” score threshold', 0.2, 0.6, 0.05, 'Score below this counts as a struggle')}
          {num('slowFactor', 'Time allowed before speed counts', 1, 2, 0.1, 'Multiple of the expected time')}
          <div className="row">
            <button className="btn sm" onClick={() => { actions.setEngine(cfg); toast('Engine settings saved'); }}>Save</button>
            <button className="btn ghost sm" onClick={() => { setCfg(DEFAULT_ENGINE); actions.setEngine(DEFAULT_ENGINE); toast('Defaults restored'); }}>Restore defaults</button>
          </div>
        </div>
        <div className="card col" style={{ gap: 14 }}>
          <h3>Preview any puzzle</h3>
          <p className="subtle">Play a puzzle at any level. Nothing is recorded.</p>
          <div className="row wrap">
            <select className="input grow" value={pc} onChange={(e) => setPc(e.target.value as CategoryId)} aria-label="Category">{CATEGORY_IDS.map((c) => <option key={c} value={c}>{CATEGORY_META[c].name}</option>)}</select>
            <select className="input" value={pd} onChange={(e) => setPd(Number(e.target.value) as Difficulty)} aria-label="Difficulty">{([1, 2, 3, 4, 5] as Difficulty[]).map((d) => <option key={d} value={d}>{d} · {LEVELS[d].name}</option>)}</select>
          </div>
          <button className="btn purple" onClick={() => onPreview(pc, pd)}>▶ Preview</button>
        </div>
      </div>

      <div className="two-col">
        <div className="card col" style={{ gap: 12 }}>
          <h3>Add an “odd one out” puzzle</h3>
          <div className="field"><label htmlFor="oi">Emoji (3–6, no spaces needed)</label><input id="oi" className="input" value={odd.items} onChange={(e) => setOdd({ ...odd, items: e.target.value })} placeholder="🍎🍌🍇🚗" /></div>
          {oddItems.length > 0 && (
            <div className="field"><label>Which one is odd?</label>
              <div className="row wrap">{oddItems.map((e, i) => <button key={i} type="button" className={`opt small${odd.odd === i ? ' right' : ''}`} onClick={() => setOdd({ ...odd, odd: i })}>{e}</button>)}</div>
            </div>
          )}
          <div className="field"><label htmlFor="ow">Why (shown after answering)</label><input id="ow" className="input" value={odd.why} onChange={(e) => setOdd({ ...odd, why: e.target.value })} placeholder="The others are fruit." /></div>
          <button className="btn sm" disabled={oddItems.length < 3 || oddItems.length > 6 || !odd.why} onClick={() => { actions.setCustom({ ...db.custom, oddOneOut: [...db.custom.oddOneOut, { id: uid(), items: oddItems, odd: Math.min(odd.odd, oddItems.length - 1), why: odd.why }] }); setOdd({ items: '', odd: 0, why: '' }); toast('Logic puzzle added'); }}>Add to Logic Island</button>
          {db.custom.oddOneOut.map((o) => (
            <div key={o.id} className="row spread custom-row"><span>{o.items.map((e, i) => <span key={i} style={{ opacity: i === o.odd ? 1 : 0.6, fontSize: i === o.odd ? 24 : 20 }}>{e}</span>)} <span className="subtle">{o.why}</span></span><button className="btn ghost sm" onClick={() => actions.setCustom({ ...db.custom, oddOneOut: db.custom.oddOneOut.filter((x) => x.id !== o.id) })}>Delete</button></div>
          ))}
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <h3>Add a picture story</h3>
          <div className="field"><label htmlFor="st">Story title</label><input id="st" className="input" value={seq.title} onChange={(e) => setSeq({ ...seq, title: e.target.value })} placeholder="Making tea" /></div>
          <div className="field"><label htmlFor="ss">Steps in order — one per line: emoji, then a short label</label><textarea id="ss" className="input" rows={5} value={seq.steps} onChange={(e) => setSeq({ ...seq, steps: e.target.value })} placeholder={'💧 Boil water\n🍵 Add tea\n🥛 Add milk\n☕ Drink'} /></div>
          <button className="btn sm" disabled={!seq.title || seqSteps.length < 2 || seqSteps.length > 6} onClick={() => { actions.setCustom({ ...db.custom, sequences: [...db.custom.sequences, { id: uid(), title: seq.title, steps: seqSteps }] }); setSeq({ title: '', steps: '' }); toast('Story added'); }}>Add to Animal World</button>
          {db.custom.sequences.map((s) => (
            <div key={s.id} className="row spread custom-row"><span><b>{s.title}</b> {s.steps.map((x) => x.emoji).join(' → ')}</span><button className="btn ghost sm" onClick={() => actions.setCustom({ ...db.custom, sequences: db.custom.sequences.filter((x) => x.id !== s.id) })}>Delete</button></div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Puzzle performance (all children)</h3>
        <p className="subtle" style={{ marginBottom: 10 }}>Use this to spot levels that are too hard (low success) or too easy (very fast).</p>
        {stats.length ? (
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>Type</th><th>Level</th><th>Attempts</th><th>Success</th><th>Time vs expected</th><th>Hints / puzzle</th></tr></thead>
              <tbody>{stats.map((s) => (
                <tr key={`${s.c}${s.d}`}><td>{CATEGORY_META[s.c].emoji} {CATEGORY_META[s.c].name}</td><td>{s.d} · {LEVELS[s.d].name}</td><td>{s.n}</td><td>{s.success}%</td><td>{s.time === null ? '—' : `${s.time.toFixed(2)}×`}</td><td>{s.hints.toFixed(1)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted">No attempts yet.</p>}
      </div>
    </div>
  );
}
