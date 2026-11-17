import type { CategoryId, Child } from './types';

export interface World {
  id: string;
  name: string;
  category: CategoryId;
  emoji: string;
  color: string;
  tagline: string;
  levels: number;
  unlockAfter: number; // levels needed in the previous world
}

export const WORLDS: World[] = [
  { id: 'color', name: 'Color Kingdom', category: 'jigsaw', emoji: '🎨', color: '#FF8FAB', tagline: 'Jigsaw puzzles', levels: 10, unlockAfter: 0 },
  { id: 'shape', name: 'Shape Adventure', category: 'shapes', emoji: '🔷', color: '#4DABF7', tagline: 'Shape matching', levels: 10, unlockAfter: 3 },
  { id: 'number', name: 'Number Galaxy', category: 'number', emoji: '🪐', color: '#845EF7', tagline: 'Number puzzles', levels: 10, unlockAfter: 3 },
  { id: 'animal', name: 'Animal World', category: 'arrange', emoji: '🦁', color: '#FFA94D', tagline: 'Picture stories', levels: 10, unlockAfter: 3 },
  { id: 'memory', name: 'Memory Forest', category: 'memory', emoji: '🌳', color: '#51CF66', tagline: 'Memory cards', levels: 10, unlockAfter: 3 },
  { id: 'logic', name: 'Logic Island', category: 'logic', emoji: '🏝️', color: '#20C997', tagline: 'Odd one out & riddles', levels: 10, unlockAfter: 3 },
  { id: 'pattern', name: 'Pattern Planet', category: 'pattern', emoji: '🌈', color: '#F06595', tagline: 'Patterns', levels: 10, unlockAfter: 3 },
  { id: 'castle', name: 'Master Puzzle Castle', category: 'maze', emoji: '🏰', color: '#FAB005', tagline: 'Mazes', levels: 10, unlockAfter: 3 },
];

export const CATEGORY_META: Record<CategoryId, { name: string; emoji: string; color: string }> = {
  jigsaw: { name: 'Jigsaw', emoji: '🧩', color: '#FF8FAB' },
  shapes: { name: 'Shapes', emoji: '🔷', color: '#4DABF7' },
  number: { name: 'Numbers', emoji: '🔢', color: '#845EF7' },
  arrange: { name: 'Stories', emoji: '🖼️', color: '#FFA94D' },
  memory: { name: 'Memory', emoji: '🃏', color: '#51CF66' },
  logic: { name: 'Logic', emoji: '💡', color: '#20C997' },
  pattern: { name: 'Patterns', emoji: '🌈', color: '#F06595' },
  maze: { name: 'Mazes', emoji: '🗺️', color: '#FAB005' },
};

export const worldFor = (c: CategoryId) => WORLDS.find((w) => w.category === c)!;

export function isUnlocked(child: Child, idx: number): boolean {
  if (idx === 0) return true;
  const prev = WORLDS[idx - 1];
  return (child.worldLevels[prev.id] ?? 0) >= WORLDS[idx].unlockAfter && isUnlocked(child, idx - 1);
}

export const AVATARS = ['🦊', '🐼', '🐯', '🐰', '🐸', '🐵', '🦄', '🐲', '🐧', '🐨', '🦁', '🐙'];
export const STARTER_AVATARS = AVATARS.slice(0, 6);

export const COSTUMES: { id: string; emoji: string; name: string; price: number }[] = [
  { id: 'crown', emoji: '👑', name: 'Crown', price: 60 },
  { id: 'cap', emoji: '🧢', name: 'Cap', price: 30 },
  { id: 'tophat', emoji: '🎩', name: 'Top hat', price: 45 },
  { id: 'party', emoji: '🥳', name: 'Party hat', price: 40 },
  { id: 'wizard', emoji: '🧙', name: 'Wizard hat', price: 90 },
  { id: 'glasses', emoji: '🕶️', name: 'Cool shades', price: 50 },
  { id: 'bow', emoji: '🎀', name: 'Bow', price: 25 },
  { id: 'helmet', emoji: '⛑️', name: 'Explorer helmet', price: 70 },
];
