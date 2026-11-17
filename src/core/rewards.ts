import { dayKey } from './rng';
import type { AttemptResult, Band, Child } from './types';

/** Stars reward effort: finishing always earns at least one. */
export function starsFor(r: AttemptResult, band: Band): number {
  if (!r.solved) return 0;
  if (band === 'strong') return 3;
  if (band === 'ok') return 2;
  return 1;
}

export function coinsFor(r: AttemptResult, stars: number): number {
  if (!r.solved) return 2; // trying counts
  return 5 + stars * 3 + (r.retries > 0 ? 3 : 0) + (r.daily ? 15 : 0) + (r.difficulty - 1) * 2;
}

export function xpFor(r: AttemptResult, stars: number): number {
  return (r.solved ? 10 : 4) + stars * 5 + r.difficulty * 3;
}

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;
export const xpForLevel = (lvl: number) => (lvl - 1) * (lvl - 1) * 40;

export function levelProgress(xp: number): { level: number; pct: number; toNext: number } {
  const level = levelFromXp(xp);
  const a = xpForLevel(level), b = xpForLevel(level + 1);
  return { level, pct: (xp - a) / (b - a), toNext: b - xp };
}

export function bumpStreak(s: Child['streak'], now = Date.now()): Child['streak'] {
  const today = dayKey(now);
  if (s.lastDay === today) return s;
  const yesterday = dayKey(now - 86400000);
  const count = s.lastDay === yesterday ? s.count + 1 : 1;
  return { count, best: Math.max(s.best, count), lastDay: today };
}
