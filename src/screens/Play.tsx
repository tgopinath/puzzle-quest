import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setSoundEnabled, sfx, speak, stopSpeaking } from '../audio';
import { actions, progressFor, settingsFor, store, type AttemptOutcome } from '../core/db';
import { LEVELS } from '../core/difficulty';
import { generatePuzzle, type Puzzle } from '../core/generators';
import type { CategoryId, Child, Difficulty } from '../core/types';
import { CATEGORY_META, worldFor } from '../core/worlds';
import Arrange from '../game/Arrange';
import Choice from '../game/Choice';
import Jigsaw from '../game/Jigsaw';
import Maze from '../game/Maze';
import Memory from '../game/Memory';
import Shapes from '../game/Shapes';
import type { GameApi } from '../game/shared';
import { useBackHandler } from '../native';
import { Confetti, Modal, Stars } from '../ui/ui';

export interface PlayProps {
  child: Child;
  category: CategoryId;
  daily?: boolean;
  preview?: { difficulty: Difficulty }; // admin preview: nothing is recorded
  onExit: () => void;
}

function makePuzzle(child: Child, category: CategoryId, daily: boolean, preview?: { difficulty: Difficulty }): Puzzle {
  const db = store.get();
  const prog = progressFor(child, category, db);
  const d = preview?.difficulty ?? prog.difficulty;
  const seed = daily ? `daily:${new Date().toDateString()}:${child.id}` : `${child.id}:${category}:${prog.attempts}:${Date.now() % 1e6}`;
  return generatePuzzle(category, d, seed, { support: !daily && !preview && prog.supportNext, ageGroup: child.ageGroup, custom: db.custom });
}

export default function Play({ child, category, daily = false, preview, onExit }: PlayProps) {
  const settings = settingsFor(child.id);
  const [puzzle, setPuzzle] = useState(() => makePuzzle(child, category, daily, preview));
  const [runKey, setRunKey] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintTick, setHintTick] = useState(0);
  const [retries, setRetries] = useState(0);
  const [paused, setPaused] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 1 });
  const [outcome, setOutcome] = useState<AttemptOutcome | 'preview' | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [timerOn, setTimerOn] = useState(settings.timers && LEVELS[puzzle.difficulty].timerAllowed);
  const [elapsed, setElapsed] = useState(0);
  const live = useRef({ mistakes, hintsUsed, retries });
  live.current = { mistakes, hintsUsed, retries };
  const finished = useRef(false);
  const acc = useRef(0); // ms accumulated while running
  const since = useRef<number | null>(performance.now());

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  const elapsedSec = useCallback(() => (acc.current + (since.current ? performance.now() - since.current : 0)) / 1000, []);
  const running = !paused && !outcome && !timeUp;
  useEffect(() => {
    if (running) { since.current ??= performance.now(); }
    else if (since.current) { acc.current += performance.now() - since.current; since.current = null; }
  }, [running]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(elapsedSec()), 250);
    const vis = () => document.hidden && setPaused(true);
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [elapsedSec]);

  const kind = puzzle.payload.kind;
  const isChoice = kind === 'pattern' || kind === 'number' || kind === 'logic';
  useEffect(() => {
    if (settings.audioInstructions && !isChoice) speak(puzzle.instruction);
    return stopSpeaking;
  }, [puzzle, runKey, settings.audioInstructions, isChoice]);

  const timeLimit = timerOn ? Math.round(puzzle.expectedSec * 2) : null;
  useEffect(() => { if (timeLimit && elapsed >= timeLimit && running) setTimeUp(true); }, [elapsed, timeLimit, running]);

  const finish = useCallback((solved: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (preview) { if (solved) { sfx.win(); setOutcome('preview'); } return; }
    const { mistakes: m, hintsUsed: h, retries: r } = live.current;
    const out = actions.recordAttempt(child.id, puzzle.id, {
      category, difficulty: puzzle.difficulty, solved, mistakes: m, mistakeTolerance: puzzle.mistakeTolerance,
      hintsUsed: h, retries: r, timeSec: Math.round(elapsedSec()), expectedSec: puzzle.expectedSec, daily,
    });
    if (solved) { sfx.win(); setTimeout(sfx.coin, 700); setOutcome(out); }
  }, [child.id, category, daily, elapsedSec, preview, puzzle]);

  const resetRun = () => {
    setMistakes(0); setHintsUsed(0); setHintTick(0); setProg({ done: 0, total: 1 });
    acc.current = 0; since.current = performance.now(); setElapsed(0); setTimeUp(false); finished.current = false;
  };

  const nextPuzzle = () => {
    const fresh = store.get().children.find((c) => c.id === child.id) ?? child;
    const p = makePuzzle(fresh, category, false, preview);
    setPuzzle(p);
    setTimerOn(settings.timers && LEVELS[p.difficulty].timerAllowed);
    setRetries(0); setOutcome(null); setPaused(false); resetRun(); setRunKey((k) => k + 1);
  };

  const restart = () => { setRetries((r) => r + 1); resetRun(); setPaused(false); setRunKey((k) => k + 1); };

  const skip = () => {
    // Giving up counts as "could not complete" so the engine can offer an easier puzzle.
    if (!preview && elapsedSec() > 8) finish(false);
    setPaused(false);
    if (daily) onExit(); else nextPuzzle();
  };

  const leave = () => {
    if (!preview && (mistakes >= puzzle.mistakeTolerance || timeUp)) finish(false);
    stopSpeaking();
    onExit();
  };

  const api: GameApi = useMemo(() => ({
    mistake: () => setMistakes((m) => m + 1),
    solved: () => finish(true),
    progress: (done, total) => setProg({ done, total }),
    hintTick,
    guidance: puzzle.guidance,
    paused: paused || !!outcome || timeUp,
  }), [finish, hintTick, puzzle.guidance, paused, outcome, timeUp]);


  // Android back: pause first (the pause menu then offers the way out).
  useBackHandler(() => setPaused(true));

  const hintsLeft = puzzle.hints - hintsUsed;
  const takeHint = () => {
    if (hintsLeft <= 0 || !running) return;
    sfx.hint();
    setHintsUsed((h) => h + 1);
    setHintTick((t) => t + 1);
  };

  const meta = CATEGORY_META[category];
  const world = worldFor(category);
  const pct = Math.min(1, prog.done / Math.max(1, prog.total));

  const body = (() => {
    const p = puzzle.payload;
    switch (p.kind) {
      case 'jigsaw': return <Jigsaw key={runKey} data={p.data} api={api} seed={puzzle.seed} />;
      case 'memory': return <Memory key={runKey} data={p.data} api={api} />;
      case 'shapes': return <Shapes key={runKey} data={p.data} api={api} />;
      case 'arrange': return <Arrange key={runKey} data={p.data} api={api} />;
      case 'maze': return <Maze key={runKey} data={p.data} api={api} />;
      default: return <Choice key={runKey} data={p.data} api={api} audio={settings.audioInstructions} />;
    }
  })();

  return (
    <div className="play" style={{ ['--world' as string]: world.color }}>
      <header className="play-top">
        <button className="icon-btn" onClick={() => setPaused(true)} aria-label="Pause">⏸️</button>
        <div className="play-title grow">
          <div className="row" style={{ gap: 8 }}>
            <span className="play-cat">{meta.emoji} {daily ? 'Daily Challenge' : world.name}</span>
            <span className="chip purple">{LEVELS[puzzle.difficulty].name}</span>
            {puzzle.support && <span className="chip green">Warm-up</span>}
          </div>
          <div className="bar sky" aria-label={`Progress ${Math.round(pct * 100)}%`}><i style={{ width: `${pct * 100}%` }} /></div>
        </div>
        {timeLimit && (
          <span className={`play-timer${timeLimit - elapsed < 15 ? ' low' : ''}`} aria-label="Time left">⏱️ {Math.max(0, Math.ceil(timeLimit - elapsed))}s</span>
        )}
        <button className="icon-btn" onClick={() => speak(puzzle.instruction)} aria-label="Read instructions aloud">🔊</button>
        <button className="icon-btn" onClick={restart} aria-label="Restart puzzle">🔄</button>
        <button className="icon-btn hint-btn" onClick={takeHint} disabled={hintsLeft <= 0} aria-label={`Hint${Number.isFinite(hintsLeft) ? `, ${hintsLeft} left` : ''}`}>
          💡{Number.isFinite(puzzle.hints) && <span className="badge">{Math.max(0, hintsLeft)}</span>}
        </button>
      </header>

      <p className="play-instruction">{puzzle.instruction}</p>
      <main className="play-body">{body}</main>

      {paused && !outcome && (
        <Modal label="Paused" onClose={() => setPaused(false)}>
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
            <div style={{ fontSize: 56 }}>😴</div>
            <h2>Taking a little break</h2>
            <button className="btn green lg block" onClick={() => setPaused(false)}>▶ Keep playing</button>
            <button className="btn ghost block" onClick={restart}>🔄 Start this puzzle again</button>
            <button className="btn ghost block" onClick={skip}>🎲 Try a different puzzle</button>
            <button className="btn ghost block" onClick={leave}>🗺️ Back to the map</button>
          </div>
        </Modal>
      )}

      {timeUp && !outcome && (
        <Modal label="Time is up">
          <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 16 }}>
            <div style={{ fontSize: 56 }}>⏰</div>
            <h2>Time’s up!</h2>
            <p className="muted">That’s okay — you can keep going without the clock.</p>
            <button className="btn green lg block" onClick={() => { setTimerOn(false); setTimeUp(false); }}>Keep going</button>
            <button className="btn ghost block" onClick={skip}>Try another puzzle</button>
          </div>
        </Modal>
      )}

      {outcome && <Result outcome={outcome} daily={daily} onNext={daily ? onExit : nextPuzzle} onMap={() => { stopSpeaking(); onExit(); }} />}
    </div>
  );
}

function Result({ outcome, daily, onNext, onMap }: { outcome: AttemptOutcome | 'preview'; daily: boolean; onNext: () => void; onMap: () => void }) {
  useEffect(() => { if (outcome !== 'preview') speak(outcome.message); }, [outcome]);
  if (outcome === 'preview') {
    return (
      <Modal label="Preview finished">
        <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2>Preview solved ✅</h2>
          <p className="muted">Nothing was recorded.</p>
          <div className="row"><button className="btn" onClick={onNext}>Another</button><button className="btn ghost" onClick={onMap}>Close</button></div>
        </div>
      </Modal>
    );
  }
  const o = outcome;
  return (
    <>
      <Confetti />
      <Modal label="Puzzle complete">
        <div className="result">
          <div className="result-burst">🎉</div>
          <h1>{o.stars === 3 ? 'Amazing!' : o.stars === 2 ? 'Great job!' : 'You did it!'}</h1>
          <Stars n={o.stars} size={48} animate />
          <p className="result-msg">{o.message}</p>
          <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="chip yellow">🪙 +{o.coins}</span>
            <span className="chip purple">✨ +{o.xp} XP</span>
            {o.levelUp && <span className="chip green">🎖️ Player level {o.levelUp}!</span>}
          </div>
          {o.decision === 'up' && <p className="result-next">🚀 Next puzzle: a bigger challenge!</p>}
          {o.decision === 'down' && <p className="result-next">🌱 Next: a fun warm-up puzzle</p>}
          {o.unlockedWorld && <div className="result-unlock">🗝️ New world unlocked: <b>{o.unlockedWorld}</b></div>}
          {o.achievements.map((a) => (
            <div key={a.id} className="result-ach"><span style={{ fontSize: 34 }}>{a.emoji}</span><div><b>{a.name}</b><div className="subtle">{a.description}</div></div></div>
          ))}
          <div className="col" style={{ width: '100%', marginTop: 8 }}>
            <button className="btn green lg block" onClick={onNext} autoFocus>{daily ? 'Back to map' : 'Next puzzle ▶'}</button>
            {!daily && <button className="btn ghost block" onClick={onMap}>🗺️ Map</button>}
          </div>
        </div>
      </Modal>
    </>
  );
}
