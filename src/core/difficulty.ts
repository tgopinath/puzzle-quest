import type { AgeGroup, Difficulty } from './types';

export interface LevelSpec {
  level: Difficulty;
  name: string;
  hints: number; // Infinity = unlimited
  guidance: 'strong' | 'light' | 'none';
  timerAllowed: boolean;
}

export const LEVELS: Record<Difficulty, LevelSpec> = {
  1: { level: 1, name: 'Very Easy', hints: Infinity, guidance: 'strong', timerAllowed: false },
  2: { level: 2, name: 'Easy', hints: Infinity, guidance: 'light', timerAllowed: false },
  3: { level: 3, name: 'Medium', hints: 3, guidance: 'none', timerAllowed: true },
  4: { level: 4, name: 'Hard', hints: 2, guidance: 'none', timerAllowed: true },
  5: { level: 5, name: 'Expert', hints: 1, guidance: 'none', timerAllowed: true },
};

export const START_DIFFICULTY: Record<AgeGroup, Difficulty> = { junior: 1, thinker: 2, master: 3 };

export const AGE_GROUPS: { id: AgeGroup; name: string; ages: string; emoji: string }[] = [
  { id: 'junior', name: 'Junior Explorer', ages: '4–6 years', emoji: '🐣' },
  { id: 'thinker', name: 'Smart Thinker', ages: '7–9 years', emoji: '🦊' },
  { id: 'master', name: 'Master Solver', ages: '10–12 years', emoji: '🦉' },
];

export const clampDifficulty = (n: number): Difficulty => Math.max(1, Math.min(5, Math.round(n))) as Difficulty;
