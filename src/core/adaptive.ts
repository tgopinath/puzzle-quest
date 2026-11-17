import { clampDifficulty } from './difficulty';
import type { AttemptResult, Band, CategoryProgress, Difficulty, EngineConfig } from './types';

export const DEFAULT_ENGINE: EngineConfig = {
  strongScore: 0.8,
  struggleScore: 0.45,
  upStreak: 3,
  downStreak: 2,
  slowFactor: 1.2,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Performance score for one attempt, 0..1. Effort-friendly: a few mistakes and a hint barely matter. */
export function scoreAttempt(r: AttemptResult, cfg: EngineConfig = DEFAULT_ENGINE): number {
  if (!r.solved) return 0;
  const tol = Math.max(1, r.mistakeTolerance);
  const mistakePenalty = 0.6 * clamp01((r.mistakes / tol - 0.5) / 2);
  const hintPenalty = Math.min(0.36, 0.12 * r.hintsUsed);
  const retryPenalty = Math.min(0.2, 0.1 * r.retries);
  const ratio = r.expectedSec > 0 ? r.timeSec / r.expectedSec : 1;
  const timePenalty = 0.25 * clamp01((ratio - cfg.slowFactor) / 1.3);
  return clamp01(1 - mistakePenalty - hintPenalty - retryPenalty - timePenalty);
}

export function bandFor(score: number, solved: boolean, cfg: EngineConfig = DEFAULT_ENGINE): Band {
  if (!solved || score < cfg.struggleScore) return 'struggle';
  if (score >= cfg.strongScore) return 'strong';
  return 'ok';
}

export function initialProgress(d: Difficulty): CategoryProgress {
  return {
    difficulty: d,
    history: [],
    completed: 0,
    attempts: 0,
    correct: 0,
    lastChange: null,
    supportNext: false,
    difficultyLog: [{ at: Date.now(), difficulty: d }],
  };
}

export type Decision = 'up' | 'down' | 'same';

/** Decide the next difficulty from the window of results since the last change. */
export function decide(history: { band: Band; score: number }[], cfg: EngineConfig = DEFAULT_ENGINE): Decision {
  const n = history.length;
  const last = (k: number) => history.slice(Math.max(0, n - k));
  if (n >= cfg.upStreak && last(cfg.upStreak).every((h) => h.band === 'strong')) return 'up';
  if (n >= 5) {
    const w = last(5);
    const avg = w.reduce((s, h) => s + h.score, 0) / w.length;
    if (avg >= 0.85 && w.every((h) => h.band !== 'struggle')) return 'up';
  }
  if (n >= cfg.downStreak && last(cfg.downStreak).every((h) => h.band === 'struggle')) return 'down';
  if (n >= 4 && last(4).filter((h) => h.band === 'struggle').length >= 3) return 'down';
  return 'same';
}

export interface EngineOutcome {
  progress: CategoryProgress;
  score: number;
  band: Band;
  decision: Decision;
}

/** Apply one attempt to a category's progress. Pure: returns a new object. */
export function applyAttempt(p: CategoryProgress, r: AttemptResult, cfg: EngineConfig = DEFAULT_ENGINE): EngineOutcome {
  const score = scoreAttempt(r, cfg);
  const band = bandFor(score, r.solved, cfg);
  // Daily challenges and practice at a different level than the category's current one
  // still count toward totals, but don't move the category difficulty.
  const counts = !r.daily && r.difficulty === p.difficulty;
  const history = counts ? [...p.history, { score, band, at: Date.now() }].slice(-8) : p.history;
  let decision: Decision = counts ? decide(history, cfg) : 'same';
  if (decision === 'up' && p.difficulty === 5) decision = 'same';
  if (decision === 'down' && p.difficulty === 1) decision = 'same';

  const difficulty = clampDifficulty(p.difficulty + (decision === 'up' ? 1 : decision === 'down' ? -1 : 0));
  const changed = difficulty !== p.difficulty;
  const progress: CategoryProgress = {
    ...p,
    difficulty,
    history: changed ? [] : history,
    attempts: p.attempts + 1,
    completed: p.completed + (r.solved ? 1 : 0),
    correct: p.correct + (r.solved && r.mistakes <= r.mistakeTolerance ? 1 : 0),
    lastChange: counts ? decision : p.lastChange,
    // After a drop, or after one struggle at level 1, give a gentler supporting puzzle.
    supportNext: decision === 'down' || (counts && band === 'struggle' && p.difficulty === 1),
    difficultyLog: changed ? [...p.difficultyLog, { at: Date.now(), difficulty }].slice(-60) : p.difficultyLog,
  };
  return { progress, score, band, decision };
}

const UP_MSGS = ['Wow! Ready for a bigger challenge!', 'You’re on fire! Level up!', 'Super solver! Let’s go harder!'];
const SAME_MSGS = ['Great job! Keep going!', 'Nice thinking!', 'You did it!', 'Awesome work!'];
const OK_MSGS = ['Good effort! Practice makes perfect!', 'Nice try — you figured it out!', 'You kept going. Brilliant!'];
const DOWN_MSGS = ['Let’s try a little easier puzzle!', 'You’re learning something new!', 'Great effort! Try another challenge!'];

export function encouragement(decision: Decision, band: Band, seed = Date.now()): string {
  const pick = (a: string[]) => a[seed % a.length];
  if (decision === 'up') return pick(UP_MSGS);
  if (decision === 'down') return pick(DOWN_MSGS);
  if (band === 'strong') return pick(SAME_MSGS);
  if (band === 'ok') return pick(OK_MSGS);
  return pick(DOWN_MSGS);
}
