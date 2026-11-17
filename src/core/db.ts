import { ACHIEVEMENTS, newlyEarned, type AchievementDef } from './achievements';
import { applyAttempt, DEFAULT_ENGINE, encouragement, initialProgress, type Decision } from './adaptive';
import { START_DIFFICULTY } from './difficulty';
import type { CustomContent } from './generators';
import { bumpStreak, coinsFor, levelFromXp, starsFor, xpFor } from './rewards';
import { dayKey, uid } from './rng';
import type { AgeGroup, Attempt, AttemptResult, CategoryId, CategoryProgress, Child, ChildSettings, EngineConfig, Parent } from './types';
import { STARTER_AVATARS, WORLDS, worldFor } from './worlds';

export interface DB {
  version: 1;
  parent: Parent | null;
  children: Child[];
  activeChildId: string | null;
  progress: Record<string, Partial<Record<CategoryId, CategoryProgress>>>;
  attempts: Attempt[];
  earned: { childId: string; achievementId: string; earnedAt: number }[];
  settings: Record<string, ChildSettings>;
  playTime: Record<string, Record<string, number>>; // child -> day -> seconds
  engine: EngineConfig;
  custom: CustomContent;
}

const KEY = 'puzzle-quest/v1';

const empty = (): DB => ({
  version: 1, parent: null, children: [], activeChildId: null, progress: {}, attempts: [], earned: [],
  settings: {}, playTime: {}, engine: { ...DEFAULT_ENGINE }, custom: { oddOneOut: [], sequences: [] },
});

export const DEFAULT_SETTINGS: ChildSettings = { sound: true, timers: true, audioInstructions: true, dailyLimitMin: 0, extraMinutesToday: null };

/* ---------- Storage adapter (swap for Supabase without touching the UI) ---------- */

export interface StorageAdapter { load(): DB | null; save(db: DB): void }

export const localAdapter: StorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...empty(), ...(JSON.parse(raw) as DB) } : null;
    } catch { return null; }
  },
  save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ }
  },
};

let adapter: StorageAdapter = localAdapter;
let state: DB = adapter.load() ?? empty();
const listeners = new Set<() => void>();

function commit(next: DB) {
  state = next;
  adapter.save(state);
  listeners.forEach((l) => l());
}

export const store = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  useAdapter(a: StorageAdapter) { adapter = a; state = a.load() ?? empty(); listeners.forEach((l) => l()); },
};

/* ---------- Selectors ---------- */

export const activeChild = (db: DB = state) => db.children.find((c) => c.id === db.activeChildId) ?? null;
export const settingsFor = (id: string, db: DB = state) => ({ ...DEFAULT_SETTINGS, ...db.settings[id] });
export const attemptsFor = (id: string, db: DB = state) => db.attempts.filter((a) => a.childId === id);
export const earnedFor = (id: string, db: DB = state) => db.earned.filter((e) => e.childId === id);
export const playedTodaySec = (id: string, db: DB = state) => db.playTime[id]?.[dayKey()] ?? 0;

export function progressFor(child: Child, cat: CategoryId, db: DB = state): CategoryProgress {
  return db.progress[child.id]?.[cat] ?? initialProgress(START_DIFFICULTY[child.ageGroup]);
}

export function minutesLeftToday(id: string, db: DB = state): number | null {
  const s = settingsFor(id, db);
  if (!s.dailyLimitMin) return null;
  const extra = s.extraMinutesToday?.day === dayKey() ? s.extraMinutesToday.minutes : 0;
  return s.dailyLimitMin + extra - playedTodaySec(id, db) / 60;
}

/* ---------- Actions ---------- */

const updateChild = (db: DB, id: string, fn: (c: Child) => Child): DB => ({ ...db, children: db.children.map((c) => (c.id === id ? fn(c) : c)) });

export const actions = {
  signup(name: string, email: string, pin: string) {
    commit({ ...state, parent: { id: uid(), name, email, pin, createdAt: Date.now() } });
  },
  updateParent(patch: Partial<Parent>) {
    if (state.parent) commit({ ...state, parent: { ...state.parent, ...patch } });
  },
  addChild(name: string, ageGroup: AgeGroup, avatar: string): string {
    const c: Child = {
      id: uid(), parentId: state.parent?.id ?? '', name, ageGroup, avatar, costume: null, createdAt: Date.now(),
      xp: 0, coins: 20, stars: 0, streak: { count: 0, best: 0, lastDay: null }, ownedCostumes: [],
      unlockedAvatars: [...STARTER_AVATARS], worldLevels: {}, dailyDone: null,
    };
    commit({ ...state, children: [...state.children, c], activeChildId: c.id, settings: { ...state.settings, [c.id]: { ...DEFAULT_SETTINGS } } });
    return c.id;
  },
  editChild(id: string, patch: Partial<Pick<Child, 'name' | 'avatar' | 'ageGroup' | 'costume'>>) {
    let next = updateChild(state, id, (c) => ({ ...c, ...patch }));
    if (patch.ageGroup) {
      // Age only sets the *starting* point: re-seed categories the child hasn't played yet.
      const prog = { ...(next.progress[id] ?? {}) };
      for (const k of Object.keys(prog) as CategoryId[]) if (!prog[k]!.attempts) delete prog[k];
      next = { ...next, progress: { ...next.progress, [id]: prog } };
    }
    commit(next);
  },
  removeChild(id: string) {
    const children = state.children.filter((c) => c.id !== id);
    const { [id]: _p, ...progress } = state.progress;
    const { [id]: _s, ...settings } = state.settings;
    const { [id]: _t, ...playTime } = state.playTime;
    commit({
      ...state, children, progress, settings, playTime,
      attempts: state.attempts.filter((a) => a.childId !== id),
      earned: state.earned.filter((e) => e.childId !== id),
      activeChildId: state.activeChildId === id ? children[0]?.id ?? null : state.activeChildId,
    });
  },
  setActive(id: string) { commit({ ...state, activeChildId: id }); },
  setSettings(id: string, patch: Partial<ChildSettings>) {
    commit({ ...state, settings: { ...state.settings, [id]: { ...settingsFor(id), ...patch } } });
  },
  grantExtraMinutes(id: string, minutes: number) {
    const s = settingsFor(id);
    const cur = s.extraMinutesToday?.day === dayKey() ? s.extraMinutesToday.minutes : 0;
    actions.setSettings(id, { extraMinutesToday: { day: dayKey(), minutes: cur + minutes } });
  },
  resetProgress(id: string) {
    commit({
      ...updateChild(state, id, (c) => ({ ...c, xp: 0, coins: 20, stars: 0, streak: { count: 0, best: 0, lastDay: null }, worldLevels: {}, ownedCostumes: [], costume: null, unlockedAvatars: [...STARTER_AVATARS], dailyDone: null })),
      progress: { ...state.progress, [id]: {} },
      attempts: state.attempts.filter((a) => a.childId !== id),
      earned: state.earned.filter((e) => e.childId !== id),
      playTime: { ...state.playTime, [id]: {} },
    });
  },
  addPlayTime(id: string, sec: number) {
    const day = dayKey();
    const cur = state.playTime[id] ?? {};
    commit({ ...state, playTime: { ...state.playTime, [id]: { ...cur, [day]: (cur[day] ?? 0) + sec } } });
  },
  buyCostume(id: string, costumeId: string, price: number): boolean {
    const c = state.children.find((x) => x.id === id);
    if (!c || c.coins < price || c.ownedCostumes.includes(costumeId)) return false;
    commit(updateChild(state, id, (x) => ({ ...x, coins: x.coins - price, ownedCostumes: [...x.ownedCostumes, costumeId], costume: costumeId })));
    return true;
  },
  setEngine(cfg: EngineConfig) { commit({ ...state, engine: cfg }); },
  setCustom(custom: CustomContent) { commit({ ...state, custom }); },

  recordAttempt(childId: string, puzzleId: string, r: AttemptResult): AttemptOutcome {
    const child = state.children.find((c) => c.id === childId)!;
    const before = progressFor(child, r.category);
    const { progress, score, band, decision } = applyAttempt(before, r, state.engine);
    const stars = starsFor(r, band);
    const coins = coinsFor(r, stars);
    const xp = xpFor(r, stars);
    const attempt: Attempt = { ...r, id: uid(), childId, puzzleId, score, band, stars, completedAt: Date.now() };

    const world = worldFor(r.category);
    const prevLevels = child.worldLevels[world.id] ?? 0;
    const worldLevels = r.solved && !r.daily ? { ...child.worldLevels, [world.id]: prevLevels + 1 } : child.worldLevels;
    const unlockedWorld = WORLDS.find((w, i) => i > 0 && WORLDS[i - 1].id === world.id && prevLevels < w.unlockAfter && (worldLevels[world.id] ?? 0) >= w.unlockAfter) ?? null;

    let updated: Child = {
      ...child,
      xp: child.xp + xp,
      coins: child.coins + coins,
      stars: child.stars + stars,
      streak: bumpStreak(child.streak),
      worldLevels,
      dailyDone: r.daily && r.solved ? dayKey() : child.dailyDone,
    };

    let next: DB = {
      ...state,
      children: state.children.map((c) => (c.id === childId ? updated : c)),
      progress: { ...state.progress, [childId]: { ...state.progress[childId], [r.category]: progress } },
      attempts: [...state.attempts, attempt].slice(-3000),
    };

    const owned = new Set(earnedFor(childId, next).map((e) => e.achievementId));
    const earned = newlyEarned({ child: updated, attempts: attemptsFor(childId, next), last: attempt }, owned);
    for (const a of earned) {
      if (a.reward.type === 'coins') updated = { ...updated, coins: updated.coins + (a.reward.value as number) };
      if (a.reward.type === 'avatar' && !updated.unlockedAvatars.includes(a.reward.value as string)) updated = { ...updated, unlockedAvatars: [...updated.unlockedAvatars, a.reward.value as string] };
      if (a.reward.type === 'costume' && !updated.ownedCostumes.includes(a.reward.value as string)) updated = { ...updated, ownedCostumes: [...updated.ownedCostumes, a.reward.value as string] };
    }
    next = {
      ...next,
      children: next.children.map((c) => (c.id === childId ? updated : c)),
      earned: [...next.earned, ...earned.map((a) => ({ childId, achievementId: a.id, earnedAt: Date.now() }))],
    };
    commit(next);

    return {
      attempt, stars, coins, xp, decision, band,
      message: encouragement(decision, band, Math.floor(Math.random() * 100)),
      newDifficulty: progress.difficulty,
      prevDifficulty: before.difficulty,
      achievements: earned,
      levelUp: levelFromXp(updated.xp) > levelFromXp(child.xp) ? levelFromXp(updated.xp) : null,
      unlockedWorld: unlockedWorld?.name ?? null,
    };
  },
};

export interface AttemptOutcome {
  attempt: Attempt;
  stars: number; coins: number; xp: number;
  decision: Decision; band: Attempt['band'];
  message: string;
  prevDifficulty: number; newDifficulty: number;
  achievements: AchievementDef[];
  levelUp: number | null;
  unlockedWorld: string | null;
}

export { ACHIEVEMENTS };
