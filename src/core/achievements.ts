import type { Attempt, CategoryId, Child } from './types';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  reward: { type: 'coins' | 'avatar' | 'costume'; value: number | string };
  test: (ctx: AchCtx) => boolean;
}

export interface AchCtx {
  child: Child;
  attempts: Attempt[]; // this child's attempts, oldest first
  last: Attempt;
}

const solvedIn = (a: Attempt[], c: CategoryId) => a.filter((x) => x.category === c && x.solved).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: 'First Puzzle Completed', emoji: '🎉', description: 'Finish your very first puzzle', reward: { type: 'coins', value: 20 }, test: ({ attempts }) => attempts.some((a) => a.solved) },
  { id: 'five', name: '5 Puzzles Solved', emoji: '🖐️', description: 'Solve 5 puzzles', reward: { type: 'avatar', value: '🦄' }, test: ({ attempts }) => attempts.filter((a) => a.solved).length >= 5 },
  { id: 'twentyfive', name: 'Puzzle Pro', emoji: '🏅', description: 'Solve 25 puzzles', reward: { type: 'avatar', value: '🐲' }, test: ({ attempts }) => attempts.filter((a) => a.solved).length >= 25 },
  { id: 'streak3', name: '3-Day Streak', emoji: '🔥', description: 'Play 3 days in a row', reward: { type: 'coins', value: 30 }, test: ({ child }) => child.streak.count >= 3 },
  { id: 'streak10', name: '10-Day Learning Streak', emoji: '📅', description: 'Play 10 days in a row', reward: { type: 'costume', value: 'crown' }, test: ({ child }) => child.streak.count >= 10 },
  { id: 'memory', name: 'Memory Master', emoji: '🧠', description: 'Solve 10 memory puzzles', reward: { type: 'avatar', value: '🐧' }, test: ({ attempts }) => solvedIn(attempts, 'memory') >= 10 },
  { id: 'pattern', name: 'Pattern Detective', emoji: '🔍', description: 'Solve 10 pattern puzzles', reward: { type: 'avatar', value: '🐨' }, test: ({ attempts }) => solvedIn(attempts, 'pattern') >= 10 },
  { id: 'logic', name: 'Logic Champion', emoji: '💡', description: 'Solve 10 logic puzzles', reward: { type: 'avatar', value: '🦁' }, test: ({ attempts }) => solvedIn(attempts, 'logic') >= 10 },
  { id: 'perfect', name: 'Perfect Solver', emoji: '🌟', description: 'Earn 3 stars 10 times', reward: { type: 'costume', value: 'wizard' }, test: ({ attempts }) => attempts.filter((a) => a.stars === 3).length >= 10 },
  { id: 'explorer', name: 'Puzzle Explorer', emoji: '🧭', description: 'Try 5 different puzzle types', reward: { type: 'avatar', value: '🐙' }, test: ({ attempts }) => new Set(attempts.filter((a) => a.solved).map((a) => a.category)).size >= 5 },
  { id: 'nevergiveup', name: 'Never Give Up', emoji: '💪', description: 'Finish a puzzle after restarting it', reward: { type: 'coins', value: 25 }, test: ({ last }) => last.solved && last.retries > 0 },
  { id: 'hintless', name: 'All By Myself', emoji: '🙌', description: 'Finish a Medium puzzle with no hints', reward: { type: 'coins', value: 25 }, test: ({ last }) => last.solved && last.hintsUsed === 0 && last.difficulty >= 3 },
  { id: 'expert', name: 'Expert Level', emoji: '🚀', description: 'Reach Expert in any puzzle type', reward: { type: 'costume', value: 'helmet' }, test: ({ last }) => last.difficulty === 5 && last.solved },
  { id: 'daily', name: 'Daily Hero', emoji: '☀️', description: 'Finish a daily challenge', reward: { type: 'coins', value: 20 }, test: ({ last }) => !!last.daily && last.solved },
];

export function newlyEarned(ctx: AchCtx, owned: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && a.test(ctx));
}
