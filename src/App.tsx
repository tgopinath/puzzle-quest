import { lazy, Suspense, useEffect, useState } from 'react';
import { setSoundEnabled } from './audio';
import { actions, activeChild, minutesLeftToday, playedTodaySec, settingsFor } from './core/db';
import type { CategoryId, Difficulty } from './core/types';
import Home from './screens/Home';
import Onboarding from './screens/Onboarding';
import ParentGate from './screens/ParentGate';
import Play from './screens/Play';
import { Avatar, Toaster, useDB } from './ui/ui';

// Charts live only in the parent area, so keep them out of the child's first load.
const Parent = lazy(() => import('./screens/Parent'));

type Route =
  | { name: 'home' }
  | { name: 'play'; category: CategoryId; daily?: boolean; preview?: { difficulty: Difficulty } }
  | { name: 'parent' };

const TICK = 15; // seconds of play time recorded per tick

export default function App() {
  const db = useDB();
  const child = activeChild(db);
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [gate, setGate] = useState<null | 'parent' | 'extend'>(null);

  useEffect(() => { if (child) setSoundEnabled(settingsFor(child.id, db).sound); }, [child, db]);

  // Screen time: count time spent in the child's part of the app while the tab is visible.
  const kidArea = route.name !== 'parent' && !(route.name === 'play' && route.preview);
  useEffect(() => {
    if (!child || !kidArea) return;
    const t = setInterval(() => { if (!document.hidden) actions.addPlayTime(child.id, TICK); }, TICK * 1000);
    return () => clearInterval(t);
  }, [child, kidArea]);

  if (!db.parent || !child) return <div className="app kid-bg"><Onboarding onDone={() => setRoute({ name: 'home' })} /><Toaster /></div>;

  const left = minutesLeftToday(child.id, db);
  const onBreak = kidArea && left !== null && left <= 0;

  return (
    <div className="app kid-bg">
      {route.name === 'home' && !onBreak && (
        <Home key={child.id} child={child} onPlay={(category, daily) => setRoute({ name: 'play', category, daily })} onParent={() => setGate('parent')} />
      )}
      {route.name === 'play' && !onBreak && (
        <Play key={`${child.id}-${route.category}-${route.daily}-${route.preview?.difficulty}`} child={child} category={route.category} daily={route.daily} preview={route.preview} onExit={() => setRoute(route.preview ? { name: 'parent' } : { name: 'home' })} />
      )}
      {route.name === 'parent' && (
        <Suspense fallback={<div className="page muted">Loading…</div>}>
          <Parent onExit={() => setRoute({ name: 'home' })} onPreview={(category, difficulty) => setRoute({ name: 'play', category, preview: { difficulty } })} />
        </Suspense>
      )}

      {onBreak && (
        <div className="page narrow break">
          <div className="card pad-lg col center-text" style={{ gap: 16, marginTop: '8vh' }}>
            <Avatar face={child.avatar} costume={child.costume} size={110} />
            <h1>Time for a break, {child.name}!</h1>
            <p className="muted" style={{ fontSize: 18 }}>You played {Math.round(playedTodaySec(child.id, db) / 60)} minutes today. Your puzzles will be waiting for you tomorrow. 🌙</p>
            <p className="subtle">Go stretch, drink some water, or tell someone about your favourite puzzle!</p>
            <button className="btn ghost" onClick={() => setGate('extend')}>🔒 Grown-up: give 15 more minutes</button>
            <button className="btn ghost sm" onClick={() => setGate('parent')}>🔒 Parent dashboard</button>
          </div>
        </div>
      )}

      {gate && (
        <ParentGate
          onCancel={() => setGate(null)}
          onPass={() => {
            if (gate === 'extend') actions.grantExtraMinutes(child.id, 15);
            else setRoute({ name: 'parent' });
            setGate(null);
          }}
        />
      )}
      <Toaster />
    </div>
  );
}
