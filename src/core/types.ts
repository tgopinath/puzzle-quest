export type AgeGroup = 'junior' | 'thinker' | 'master';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type CategoryId =
  | 'jigsaw'
  | 'shapes'
  | 'number'
  | 'arrange'
  | 'memory'
  | 'logic'
  | 'pattern'
  | 'maze';

export const CATEGORY_IDS: CategoryId[] = ['jigsaw', 'shapes', 'number', 'arrange', 'memory', 'logic', 'pattern', 'maze'];

export interface Parent {
  id: string;
  name: string;
  email: string;
  pin: string;
  createdAt: number;
}

export interface Child {
  id: string;
  parentId: string;
  name: string;
  ageGroup: AgeGroup;
  avatar: string; // emoji id from AVATARS
  costume: string | null; // costume id
  createdAt: number;
  xp: number;
  coins: number;
  stars: number;
  streak: { count: number; best: number; lastDay: string | null };
  ownedCostumes: string[];
  unlockedAvatars: string[];
  worldLevels: Record<string, number>; // worldId -> levels completed
  dailyDone: string | null; // yyyy-mm-dd of last daily challenge
}

export interface ChildSettings {
  sound: boolean;
  timers: boolean;
  audioInstructions: boolean;
  dailyLimitMin: number; // 0 = no limit
  extraMinutesToday: { day: string; minutes: number } | null;
}

export type Band = 'strong' | 'ok' | 'struggle';

export interface CategoryProgress {
  difficulty: Difficulty;
  history: { score: number; band: Band; at: number }[]; // window since last change
  completed: number;
  attempts: number;
  correct: number;
  lastChange: 'up' | 'down' | 'same' | null;
  supportNext: boolean; // next puzzle is a supporting (extra-guided) challenge
  difficultyLog: { at: number; difficulty: Difficulty }[];
}

export interface AttemptResult {
  category: CategoryId;
  difficulty: Difficulty;
  solved: boolean;
  mistakes: number;
  mistakeTolerance: number;
  hintsUsed: number;
  retries: number;
  timeSec: number;
  expectedSec: number;
  daily?: boolean;
}

export interface Attempt extends AttemptResult {
  id: string;
  childId: string;
  puzzleId: string;
  score: number;
  band: Band;
  stars: number;
  completedAt: number;
}

export interface EngineConfig {
  strongScore: number;
  struggleScore: number;
  upStreak: number;
  downStreak: number;
  slowFactor: number; // time ratio above which time starts to count
}
