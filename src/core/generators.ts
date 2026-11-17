import { LEVELS } from './difficulty';
import { makeRng, type Rng } from './rng';
import type { AgeGroup, CategoryId, Difficulty } from './types';

/* ---------- Shared shapes & items ---------- */

export type ShapeKind =
  | 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'diamond'
  | 'hexagon' | 'pentagon' | 'arrow' | 'lshape' | 'moon' | 'cross';

export const SYMMETRIC: ShapeKind[] = ['circle', 'square', 'diamond', 'cross', 'hexagon'];
export const ROTATABLE: ShapeKind[] = ['triangle', 'arrow', 'lshape', 'moon', 'heart', 'star', 'pentagon'];
export const ALL_SHAPES: ShapeKind[] = [...SYMMETRIC, ...ROTATABLE];

export const PALETTE = ['#FF6B6B', '#4DABF7', '#FFD43B', '#51CF66', '#B197FC', '#FF922B', '#F783AC', '#20C997'];
export const COLOR_NAMES: Record<string, string> = {
  '#FF6B6B': 'red', '#4DABF7': 'blue', '#FFD43B': 'yellow', '#51CF66': 'green',
  '#B197FC': 'purple', '#FF922B': 'orange', '#F783AC': 'pink', '#20C997': 'teal',
};

export interface Item {
  key: string;
  shape?: ShapeKind;
  color?: string;
  emoji?: string;
  text?: string;
  label: string; // for screen readers / audio
}

/* ---------- Puzzle data per category ---------- */

export interface JigsawData { rows: number; cols: number; image: string; ghost: boolean; theme: string }
export interface MemoryData { cards: { id: string; face: string }[]; peekMs: number; columns: number }
export interface ChoiceRound { prompt: string; sequence?: (Item | null)[]; visual?: Item[]; options: Item[]; answer: string; explain?: string }
export interface ChoiceData { rounds: ChoiceRound[] }
export interface ShapesData {
  pieces: { id: string; kind: ShapeKind; color: string; startRot: number }[];
  outlines: { id: string; kind: ShapeKind; pieceId: string | null }[]; // pieceId null = decoy
  rotation: boolean;
}
export interface ArrangeData { title: string; steps: { id: string; emoji: string; label: string }[]; order: string[] }
export interface MazeData {
  w: number; h: number;
  walls: number[]; // bitmask per cell: 1=N 2=E 4=S 8=W
  start: number; goal: number;
  rocks: number[]; stars: number[]; shortest: number;
}

export type PuzzleData =
  | { kind: 'jigsaw'; data: JigsawData }
  | { kind: 'memory'; data: MemoryData }
  | { kind: 'pattern'; data: ChoiceData }
  | { kind: 'number'; data: ChoiceData }
  | { kind: 'logic'; data: ChoiceData }
  | { kind: 'shapes'; data: ShapesData }
  | { kind: 'arrange'; data: ArrangeData }
  | { kind: 'maze'; data: MazeData };

export interface Puzzle {
  id: string;
  category: CategoryId;
  difficulty: Difficulty;
  seed: string;
  instruction: string;
  expectedSec: number;
  mistakeTolerance: number;
  hints: number; // Infinity = unlimited
  guidance: 'strong' | 'light' | 'none';
  support: boolean;
  payload: PuzzleData;
}

export interface CustomContent {
  oddOneOut: { id: string; items: string[]; odd: number; why: string }[];
  sequences: { id: string; title: string; steps: { emoji: string; label: string }[] }[];
}

export interface GenOpts { support?: boolean; ageGroup?: AgeGroup; custom?: CustomContent }

const ROUNDS: Record<Difficulty, number> = { 1: 3, 2: 3, 3: 4, 4: 5, 5: 5 };

/* ---------- Jigsaw ---------- */

const SCENES = ['meadow', 'ocean', 'space', 'castle', 'jungle'] as const;

function sceneSvg(theme: (typeof SCENES)[number], rng: Rng): string {
  const W = 600, H = 600;
  const parts: string[] = [];
  const sky: Record<string, [string, string]> = {
    meadow: ['#8FD3FF', '#E7F7FF'], ocean: ['#5EC8F2', '#BDEBFF'], space: ['#1B1450', '#4B2C8F'],
    castle: ['#FFB4A2', '#FFE5D9'], jungle: ['#A8E6CF', '#E6FFF2'],
  };
  const [s1, s2] = sky[theme];
  parts.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);
  const emoji = (e: string, x: number, y: number, size: number) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${e}</text>`;
  if (theme === 'space') {
    for (let i = 0; i < 40; i++) parts.push(`<circle cx="${rng.int(0, W)}" cy="${rng.int(0, H)}" r="${rng.int(1, 3)}" fill="#fff" opacity="${0.4 + rng.next() * 0.6}"/>`);
    parts.push(`<circle cx="460" cy="140" r="80" fill="#FFB347"/><ellipse cx="460" cy="140" rx="130" ry="22" fill="none" stroke="#FFE0A3" stroke-width="10"/>`);
    parts.push(`<circle cx="120" cy="470" r="110" fill="#7FD1AE"/><circle cx="90" cy="440" r="22" fill="#5FB892"/><circle cx="160" cy="510" r="16" fill="#5FB892"/>`);
    parts.push(emoji('🚀', 300, 300, 120), emoji('👽', 470, 460, 90), emoji('⭐', 130, 140, 60), emoji('🛸', 300, 110, 70));
  } else if (theme === 'ocean') {
    parts.push(`<circle cx="500" cy="90" r="55" fill="#FFE066"/>`);
    parts.push(`<path d="M0 230 Q75 200 150 230 T300 230 T450 230 T600 230 V600 H0Z" fill="#1E90C8"/>`);
    parts.push(`<path d="M0 320 Q75 290 150 320 T300 320 T450 320 T600 320 V600 H0Z" fill="#1679AE"/>`);
    parts.push(`<path d="M0 520 Q150 480 300 520 T600 520 V600 H0Z" fill="#F4D58D"/>`);
    parts.push(emoji('⛵', 140, 190, 90), emoji('🐳', 420, 330, 110), emoji('🐠', 160, 400, 70), emoji('🐙', 330, 470, 80), emoji('🦀', 520, 545, 50), emoji('🐚', 90, 555, 44));
  } else if (theme === 'castle') {
    parts.push(`<circle cx="100" cy="100" r="50" fill="#FFF3B0"/>`);
    parts.push(`<path d="M0 420 Q150 360 300 420 T600 410 V600 H0Z" fill="#8BC34A"/>`);
    parts.push(`<rect x="200" y="200" width="200" height="230" fill="#C9B6E4"/><rect x="170" y="150" width="60" height="280" fill="#B39DDB"/><rect x="370" y="150" width="60" height="280" fill="#B39DDB"/>`);
    parts.push(`<polygon points="170,150 200,80 230,150" fill="#F06292"/><polygon points="370,150 400,80 430,150" fill="#F06292"/><rect x="270" y="330" width="60" height="100" rx="30" fill="#6D4C41"/>`);
    parts.push(emoji('🐉', 500, 250, 100), emoji('👑', 300, 250, 60), emoji('🌳', 70, 400, 90), emoji('🦄', 480, 500, 80), emoji('🌸', 120, 540, 44));
  } else if (theme === 'jungle') {
    parts.push(`<circle cx="480" cy="100" r="60" fill="#FFD166"/>`);
    parts.push(`<path d="M0 440 Q150 400 300 440 T600 430 V600 H0Z" fill="#2E8B57"/>`);
    parts.push(emoji('🌴', 90, 300, 160), emoji('🌴', 520, 320, 140), emoji('🐒', 250, 220, 80), emoji('🦁', 330, 420, 110), emoji('🦜', 440, 190, 70), emoji('🐍', 140, 520, 60), emoji('🦋', 300, 90, 50), emoji('🐘', 500, 530, 70));
  } else {
    parts.push(`<circle cx="500" cy="100" r="60" fill="#FFD43B"/>`);
    parts.push(`<path d="M0 380 Q150 320 300 380 T600 370 V600 H0Z" fill="#69DB7C"/><path d="M0 470 Q200 420 400 470 T600 470 V600 H0Z" fill="#40C057"/>`);
    parts.push(`<rect x="90" y="250" width="160" height="140" fill="#FFA8A8"/><polygon points="70,250 170,170 270,250" fill="#E03131"/><rect x="150" y="320" width="40" height="70" fill="#845EF7"/>`);
    parts.push(emoji('🐄', 420, 420, 100), emoji('🌻', 320, 520, 60), emoji('🐑', 120, 520, 70), emoji('☁️', 260, 110, 80), emoji('🐔', 520, 540, 50), emoji('🌳', 470, 280, 110));
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function genJigsaw(d: Difficulty, rng: Rng, support: boolean): Omit<Puzzle, 'id' | 'seed' | 'category' | 'difficulty' | 'hints' | 'guidance' | 'support'> {
  const side = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }[d];
  const theme = rng.pick(SCENES);
  const pieces = side * side;
  return {
    instruction: 'Drag each piece to the right spot to finish the picture!',
    expectedSec: pieces * 4 + 10,
    mistakeTolerance: Math.ceil(pieces * 0.25),
    payload: { kind: 'jigsaw', data: { rows: side, cols: side, image: sceneSvg(theme, rng), ghost: support || d <= 2, theme } },
  };
}

/* ---------- Memory ---------- */

const MEMORY_SETS = [
  ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'],
  ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍑', '🍉', '🍋', '🥕', '🌽', '🍄', '🥦'],
  ['🚗', '🚌', '🚲', '🚂', '✈️', '🚀', '🚁', '⛵', '🚒', '🚜', '🛵', '🚓', '🛶', '🚠'],
  ['⚽', '🏀', '🎾', '🎈', '🪁', '🧸', '🎨', '🎸', '🥁', '🎹', '🎲', '🧩', '🪀', '🛼'],
];

function genMemory(d: Difficulty, rng: Rng, support: boolean): ReturnType<typeof genJigsaw> {
  const pairs = { 1: 2, 2: 3, 3: 6, 4: 8, 5: 12 }[d];
  const faces = rng.shuffle(rng.pick(MEMORY_SETS)).slice(0, pairs);
  const cards = rng.shuffle(faces.flatMap((f, i) => [{ id: `${i}a`, face: f }, { id: `${i}b`, face: f }]));
  const columns = pairs <= 2 ? 2 : pairs <= 3 ? 3 : pairs <= 6 ? 4 : pairs <= 8 ? 4 : 6;
  return {
    instruction: 'Flip two cards at a time and find all the matching pairs!',
    expectedSec: pairs * 6 + 6,
    mistakeTolerance: Math.ceil(pairs * 1.5),
    payload: { kind: 'memory', data: { cards, columns, peekMs: support || d === 1 ? 2500 : d === 2 ? 1500 : 0 } },
  };
}

/* ---------- Pattern ---------- */

const UNITS: Record<Difficulty, number[][]> = {
  1: [[0, 1]],
  2: [[0, 1], [0, 0, 1], [0, 1, 1]],
  3: [[0, 1, 2], [0, 0, 1], [0, 1, 1], [0, 1, 0, 2]],
  4: [[0, 1, 2], [0, 1, 2, 3], [0, 0, 1, 1], [0, 1, 2, 1]],
  5: [[0, 1, 2, 3], [0, 0, 1, 2], [0, 1, 1, 2, 2]],
};
const ANIMALS = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐸', '🐵', '🐧', '🐢'];

function patternItems(d: Difficulty, rng: Rng, n: number): Item[] {
  const mode = d === 1 ? 'color' : d === 2 ? rng.pick(['color', 'shape']) : d === 3 ? rng.pick(['shape', 'animal']) : 'both';
  const colors = rng.shuffle(PALETTE);
  const shapes = rng.shuffle(ALL_SHAPES);
  const animals = rng.shuffle(ANIMALS);
  return Array.from({ length: n }, (_, i): Item => {
    if (mode === 'color') return { key: `c${i}`, shape: 'circle', color: colors[i], label: `${COLOR_NAMES[colors[i]]} circle` };
    if (mode === 'shape') return { key: `s${i}`, shape: shapes[i], color: colors[0], label: shapes[i] };
    if (mode === 'animal') return { key: `a${i}`, emoji: animals[i], label: 'animal' };
    // both: same shape set, colors vary independently -> harder to spot
    return { key: `b${i}`, shape: shapes[i % shapes.length], color: colors[(i * 3) % colors.length], label: `${COLOR_NAMES[colors[(i * 3) % colors.length]]} ${shapes[i % shapes.length]}` };
  });
}

function genPatternRound(d: Difficulty, rng: Rng, support: boolean): ChoiceRound {
  // Expert: number sequences with a rule
  if (d === 5 && rng.next() < 0.5) {
    const start = rng.int(1, 9), step = rng.pick([2, 3, 4, 5, 10]);
    const seq = Array.from({ length: 6 }, (_, i) => start + i * step);
    const hole = rng.int(2, 5);
    const ans = seq[hole];
    const opts = rng.shuffle([ans, ans + 1, ans - 1, ans + step].filter((v, i, a) => a.indexOf(v) === i && v > 0)).slice(0, 4);
    if (!opts.includes(ans)) opts[0] = ans;
    const it = (v: number): Item => ({ key: `n${v}`, text: String(v), label: String(v) });
    return { prompt: 'Which number is missing?', sequence: seq.map((v, i) => (i === hole ? null : it(v))), options: rng.shuffle(opts).map(it), answer: `n${ans}`, explain: `It goes up by ${step} each time.` };
  }
  const unit = rng.pick(UNITS[d]);
  const kinds = Math.max(...unit) + 1;
  const items = patternItems(d, rng, kinds + 2);
  const reps = d <= 2 ? 3 : 3;
  const full = Array.from({ length: unit.length * reps }, (_, i) => items[unit[i % unit.length]]);
  // Easy: missing at the end. Medium+: missing anywhere after the first unit.
  const len = Math.min(full.length, d <= 2 ? unit.length * 2 + 1 : full.length);
  const seq = full.slice(0, len);
  const hole = d <= 2 || support ? len - 1 : rng.int(unit.length, len - 1);
  const answer = seq[hole];
  const optCount = d === 1 ? 2 : d <= 3 ? 3 : 4;
  const distractors = rng.shuffle(items.filter((x) => x.key !== answer.key)).slice(0, optCount - 1);
  return {
    prompt: hole === len - 1 ? 'What comes next?' : 'What is missing?',
    sequence: seq.map((x, i) => (i === hole ? null : x)),
    options: rng.shuffle([answer, ...distractors]),
    answer: answer.key,
  };
}

/* ---------- Number ---------- */

const COUNTABLES = ['🍎', '⭐', '🐟', '🌸', '🍪', '🎈', '🐞', '🚗'];

function numOpts(rng: Rng, ans: number, n: number, spread: number): Item[] {
  const set = new Set<number>([ans]);
  let guard = 0;
  while (set.size < n && guard++ < 50) {
    const v = ans + rng.int(-spread, spread);
    if (v >= 0) set.add(v);
  }
  return rng.shuffle([...set]).map((v) => ({ key: `n${v}`, text: String(v), label: String(v) }));
}

function genNumberRound(d: Difficulty, rng: Rng, age: AgeGroup): ChoiceRound {
  const e = rng.pick(COUNTABLES);
  const vis = (k: number): Item[] => Array.from({ length: k }, (_, i) => ({ key: `v${i}`, emoji: e, label: e }));
  const kind = rng.int(0, 2);
  if (d === 1) {
    const k = rng.int(1, 5);
    return { prompt: 'How many do you see?', visual: vis(k), options: numOpts(rng, k, 3, 2), answer: `n${k}` };
  }
  if (d === 2) {
    if (kind === 0) {
      const k = rng.int(3, 9);
      return { prompt: 'How many do you see?', visual: vis(k), options: numOpts(rng, k, 3, 2), answer: `n${k}` };
    }
    if (kind === 1) {
      const s = rng.int(1, 6), hole = rng.int(1, 3);
      const seq = [s, s + 1, s + 2, s + 3, s + 4];
      return { prompt: 'Which number is missing?', sequence: seq.map((v, i) => (i === hole ? null : { key: `n${v}`, text: String(v), label: String(v) })), options: numOpts(rng, seq[hole], 3, 2), answer: `n${seq[hole]}` };
    }
    const a = rng.int(1, 9);
    let b = rng.int(1, 9);
    if (b === a) b = a === 9 ? 8 : a + 1;
    return { prompt: 'Which number is bigger?', options: rng.shuffle([a, b]).map((v) => ({ key: `n${v}`, text: String(v), label: String(v) })), answer: `n${Math.max(a, b)}` };
  }
  if (d === 3) {
    if (kind === 2 || age === 'junior') {
      const a = rng.int(1, 5), b = rng.int(1, 4);
      return { prompt: `${a} + ${b} = ?`, visual: [...vis(a), { key: 'plus', text: '+', label: 'plus' }, ...vis(b).map((x, i) => ({ ...x, key: `w${i}` }))], options: numOpts(rng, a + b, 4, 3), answer: `n${a + b}` };
    }
    const sub = kind === 1;
    const a = rng.int(5, 15), b = rng.int(1, sub ? Math.min(9, a) : 9);
    const ans = sub ? a - b : a + b;
    return { prompt: `${a} ${sub ? '−' : '+'} ${b} = ?`, options: numOpts(rng, ans, 4, 3), answer: `n${ans}` };
  }
  if (d === 4) {
    if (kind === 0) {
      const step = rng.pick([2, 5, 10]), s = step * rng.int(1, 4), hole = rng.int(1, 4);
      const seq = Array.from({ length: 6 }, (_, i) => s + i * step);
      return { prompt: `Count by ${step}s. Which is missing?`, sequence: seq.map((v, i) => (i === hole ? null : { key: `n${v}`, text: String(v), label: String(v) })), options: numOpts(rng, seq[hole], 4, step), answer: `n${seq[hole]}` };
    }
    if (kind === 1) {
      const b = rng.int(3, 12), ans = rng.int(2, 20);
      return { prompt: `? + ${b} = ${ans + b}`, options: numOpts(rng, ans, 4, 3), answer: `n${ans}` };
    }
    const a = rng.int(12, 40), b = rng.int(5, 20), sub = rng.next() < 0.5 && a > b;
    const ans = sub ? a - b : a + b;
    return { prompt: `${a} ${sub ? '−' : '+'} ${b} = ?`, options: numOpts(rng, ans, 4, 5), answer: `n${ans}` };
  }
  // d === 5
  if (kind === 0) {
    const a = rng.int(10, 40), b = rng.int(5, 20), c = rng.int(2, 15);
    const ans = a + b - c;
    return { prompt: `${a} + ${b} − ${c} = ?`, options: numOpts(rng, ans, 4, 6), answer: `n${ans}` };
  }
  if (kind === 1) {
    const a = rng.int(2, age === 'master' ? 12 : 6), b = rng.int(2, age === 'master' ? 10 : 5);
    return { prompt: `${a} × ${b} = ?`, options: numOpts(rng, a * b, 4, Math.max(3, a)), answer: `n${a * b}` };
  }
  const x = rng.int(3, 15), y = rng.int(3, 15), p = rng.int(2, 6), q = rng.int(2, 5);
  const l = `${x} + ${y}`, r = `${p} × ${q}`;
  if (x + y === p * q) return genNumberRound(5, rng, age);
  return {
    prompt: 'Which is bigger?',
    options: rng.shuffle([{ key: 'L', text: l, label: l }, { key: 'R', text: r, label: r }]),
    answer: x + y > p * q ? 'L' : 'R',
    explain: `${l} = ${x + y} and ${r} = ${p * q}`,
  };
}

/* ---------- Logic ---------- */

const GROUPS: Record<string, string[]> = {
  fruit: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍑', '🍉'],
  animal: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐯', '🐮'],
  vehicle: ['🚗', '🚌', '🚲', '🚂', '🚒', '🚜', '🛵', '🚓'],
  sea: ['🐟', '🐙', '🦀', '🐬', '🐳', '🦈', '🐠', '🦑'],
  clothes: ['👕', '👖', '👗', '🧦', '🧢', '🧣', '👟', '🧤'],
  sweets: ['🍰', '🍩', '🍪', '🍫', '🍭', '🧁', '🍦'],
  music: ['🎸', '🎹', '🥁', '🎺', '🎻', '🪗'],
  ball: ['⚽', '🏀', '🏈', '🎾', '🏐', '🎱'],
  plant: ['🌵', '🌻', '🌷', '🌲', '🌴', '🌹', '🍀'],
};
const ATTR_SETS: { prompt: string; yes: string[]; no: string[]; why: string }[] = [
  { prompt: 'Which one cannot fly?', yes: ['🐦', '🦅', '🦋', '🐝', '✈️', '🚁', '🦉', '🪁'], no: ['🐢', '🚗', '🐘', '🐟', '🐶'], why: 'All the others can fly.' },
  { prompt: 'Which one does not live in water?', yes: ['🐟', '🐙', '🐬', '🐳', '🦈', '🦀', '🐠'], no: ['🐒', '🐄', '🦁', '🐔'], why: 'All the others live in water.' },
  { prompt: 'Which one is not red?', yes: ['🍎', '🍓', '🍒', '🚒', '❤️', '🌹', '🍅'], no: ['🍌', '🥦', '🐳', '🌽'], why: 'All the others are red.' },
  { prompt: 'Which one is not hot?', yes: ['☀️', '🔥', '☕', '🌶️', '🌋'], no: ['❄️', '🧊', '⛄', '🍦'], why: 'All the others are hot.' },
  { prompt: 'Which one has no wheels?', yes: ['🚗', '🚲', '🚌', '🛴', '🚜', '🛹', '🚂'], no: ['⛵', '🚀', '🛶', '🚁'], why: 'All the others have wheels.' },
  { prompt: 'Which one is not round?', yes: ['⚽', '🍊', '🌕', '🏀', '🍩', '🪙', '🎱'], no: ['📦', '📐', '🧱', '📏'], why: 'All the others are round.' },
];
const ANALOGIES: { rel: string; pairs: [string, string][] }[] = [
  { rel: 'eats', pairs: [['🐰', '🥕'], ['🐒', '🍌'], ['🐼', '🎋'], ['🐭', '🧀'], ['🐶', '🦴'], ['🐝', '🌸']] },
  { rel: 'grows into', pairs: [['🐣', '🐔'], ['🐛', '🦋'], ['🌱', '🌳'], ['👶', '🧑'], ['🥚', '🐣'], ['🌰', '🌱']] },
  { rel: 'is used for', pairs: [['❄️', '🧤'], ['🌧️', '☂️'], ['☀️', '🕶️'], ['🌙', '🛏️'], ['🏊', '🩱'], ['🎂', '🕯️']] },
  { rel: 'lives in', pairs: [['🐟', '🌊'], ['🐦', '🪺'], ['🐝', '🍯'], ['🐄', '🏡'], ['🐧', '🧊'], ['🐫', '🏜️']] },
];

const em = (e: string, i: number): Item => ({ key: `e${i}`, emoji: e, label: e });

function genLogicRound(d: Difficulty, rng: Rng, custom?: CustomContent): ChoiceRound {
  if (custom?.oddOneOut.length && rng.next() < 0.35) {
    const c = rng.pick(custom.oddOneOut);
    const opts = c.items.map(em);
    return { prompt: 'Which one does not belong?', options: opts, answer: opts[c.odd].key, explain: c.why };
  }
  if (d <= 3) {
    const n = d === 1 ? 3 : d === 2 ? 4 : 5;
    const names = rng.shuffle(Object.keys(GROUPS));
    const main = rng.shuffle(GROUPS[names[0]]).slice(0, n - 1);
    const odd = rng.pick(GROUPS[names[1]]);
    const opts = rng.shuffle([...main, odd]).map(em);
    return { prompt: 'Which one does not belong?', options: opts, answer: opts.find((o) => o.emoji === odd)!.key, explain: `The others are all ${names[0] === 'sea' ? 'sea animals' : names[0] === 'music' ? 'instruments' : names[0] === 'ball' ? 'balls' : names[0] + 's'}.` };
  }
  if (d === 4 || rng.next() < 0.3) {
    const set = rng.pick(ATTR_SETS);
    const main = rng.shuffle(set.yes).slice(0, d === 4 ? 4 : 5);
    const odd = rng.pick(set.no);
    const opts = rng.shuffle([...main, odd]).map(em);
    return { prompt: set.prompt, options: opts, answer: opts.find((o) => o.emoji === odd)!.key, explain: set.why };
  }
  const a = rng.pick(ANALOGIES);
  const [p1, p2] = rng.shuffle(a.pairs);
  const wrong = rng.shuffle(a.pairs.filter((p) => p !== p1 && p !== p2)).slice(0, 3).map((p) => p[1]);
  const opts = rng.shuffle([p2[1], ...wrong]).map(em);
  return {
    prompt: 'Find the missing one!',
    sequence: [em(p1[0], 90), { key: 'arrow1', text: '→', label: a.rel }, em(p1[1], 91), { key: 'gap', text: '·', label: 'and' }, em(p2[0], 92), { key: 'arrow2', text: '→', label: a.rel }, null],
    options: opts,
    answer: opts.find((o) => o.emoji === p2[1])!.key,
    explain: `${p1[0]} ${a.rel} ${p1[1]}, so ${p2[0]} ${a.rel} ${p2[1]}.`,
  };
}

/* ---------- Shapes ---------- */

function genShapes(d: Difficulty, rng: Rng, support: boolean): ReturnType<typeof genJigsaw> {
  const n = { 1: 2, 2: 4, 3: 6, 4: 6, 5: 8 }[d];
  const rotation = d >= 4 && !support;
  const rotCount = d === 4 ? 2 : 4;
  const decoys = d >= 3 ? (d === 3 ? 1 : 2) : 0;
  const pool = rotation ? [...rng.shuffle(ROTATABLE).slice(0, rotCount), ...rng.shuffle(SYMMETRIC)] : rng.shuffle(ALL_SHAPES);
  const kinds = rng.shuffle(pool.slice(0, n)).slice(0, n);
  // Medium+: similar shapes in similar colors so the outline shape is what matters
  const colors = d >= 3 ? rng.shuffle(PALETTE).slice(0, 2) : rng.shuffle(PALETTE);
  const turned = new Set(rotation ? pool.slice(0, rotCount) : []);
  const pieces = kinds.map((k, i) => ({
    id: `p${i}`, kind: k, color: colors[i % colors.length],
    startRot: turned.has(k) ? rng.pick([90, 180, 270]) : 0,
  }));
  const unused = ALL_SHAPES.filter((k) => !kinds.includes(k));
  const outlines = rng.shuffle([
    ...pieces.map((p) => ({ id: `o${p.id}`, kind: p.kind, pieceId: p.id as string | null })),
    ...rng.shuffle(unused).slice(0, decoys).map((k, i) => ({ id: `d${i}`, kind: k, pieceId: null })),
  ]);
  return {
    instruction: rotation ? 'Tap a shape to turn it, then drag it into its matching outline!' : 'Drag each shape into its matching outline!',
    expectedSec: n * 5 + (rotation ? rotCount * 4 : 0) + 6,
    mistakeTolerance: Math.ceil(n * 0.35),
    payload: { kind: 'shapes', data: { pieces, outlines, rotation } },
  };
}

/* ---------- Picture arrangement ---------- */

const SEQUENCES: { title: string; steps: [string, string][] }[] = [
  { title: 'Grow a flower', steps: [['🌰', 'Plant a seed'], ['🌱', 'It sprouts'], ['🌿', 'It grows leaves'], ['🌷', 'A flower blooms']] },
  { title: 'From egg to hen', steps: [['🥚', 'An egg'], ['🐣', 'It hatches'], ['🐥', 'A little chick'], ['🐔', 'A big hen']] },
  { title: 'Morning time', steps: [['⏰', 'Wake up'], ['🪥', 'Brush teeth'], ['🥣', 'Eat breakfast'], ['🎒', 'Go to school']] },
  { title: 'One whole day', steps: [['🌅', 'Sunrise'], ['☀️', 'Noon'], ['🌇', 'Sunset'], ['🌙', 'Night']] },
  { title: 'Snowman story', steps: [['❄️', 'Snow falls'], ['⛄', 'Build a snowman'], ['☀️', 'The sun comes out'], ['💧', 'It melts']] },
  { title: 'Make a pizza', steps: [['🫓', 'Roll the dough'], ['🍅', 'Add sauce'], ['🧀', 'Add cheese'], ['🔥', 'Bake it'], ['🍕', 'Eat it!']] },
  { title: 'Growing up', steps: [['👶', 'Baby'], ['🧒', 'Child'], ['🧑', 'Grown-up'], ['🧓', 'Grandparent']] },
  { title: 'Send a letter', steps: [['✍️', 'Write it'], ['✉️', 'Put it in an envelope'], ['📮', 'Post it'], ['📬', 'It arrives']] },
  { title: 'Small to big', steps: [['🐜', 'Ant'], ['🐭', 'Mouse'], ['🐱', 'Cat'], ['🐶', 'Dog'], ['🐴', 'Horse'], ['🐘', 'Elephant']] },
  { title: 'Clock times', steps: [['🕐', '1 o’clock'], ['🕑', '2 o’clock'], ['🕒', '3 o’clock'], ['🕓', '4 o’clock'], ['🕔', '5 o’clock'], ['🕕', '6 o’clock']] },
  { title: 'Moon phases', steps: [['🌑', 'New moon'], ['🌒', 'Crescent'], ['🌓', 'Half moon'], ['🌔', 'Almost full'], ['🌕', 'Full moon']] },
  { title: 'Dice count', steps: [['⚀', 'One'], ['⚁', 'Two'], ['⚂', 'Three'], ['⚃', 'Four'], ['⚄', 'Five'], ['⚅', 'Six']] },
  { title: 'Rain and rainbow', steps: [['☁️', 'Clouds come'], ['🌧️', 'It rains'], ['🌦️', 'The sun peeks out'], ['🌈', 'A rainbow!']] },
];

function genArrange(d: Difficulty, rng: Rng, custom?: CustomContent): ReturnType<typeof genJigsaw> {
  const len = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }[d];
  const pool = [
    ...SEQUENCES.map((s) => ({ title: s.title, steps: s.steps.map(([emoji, label]) => ({ emoji, label })) })),
    ...(custom?.sequences ?? []),
  ].filter((s) => s.steps.length >= len);
  const seq = rng.pick(pool);
  // Keep order while sampling a shorter story (always keeps first and last step)
  let idx = seq.steps.map((_, i) => i);
  while (idx.length > len) idx.splice(rng.int(1, idx.length - 2), 1);
  const steps = idx.map((i, k) => ({ id: `s${k}`, ...seq.steps[i] }));
  let order = rng.shuffle(steps.map((s) => s.id));
  if (order.every((id, i) => id === steps[i].id)) order = [...order.slice(1), order[0]];
  return {
    instruction: 'Put the pictures in the right order. Tap them from first to last!',
    expectedSec: len * 5 + 6,
    mistakeTolerance: Math.max(1, Math.floor(len / 2)),
    payload: { kind: 'arrange', data: { title: seq.title, steps, order } },
  };
}

/* ---------- Maze ---------- */

export const N = 1, E = 2, S = 4, W = 8;

function bfs(m: { w: number; h: number; walls: number[] }, from: number, to: number, blocked: Set<number> = new Set()): number[] | null {
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    if (c === to) break;
    for (const n of neighbours(m, c)) if (!prev.has(n) && !blocked.has(n)) { prev.set(n, c); q.push(n); }
  }
  if (!prev.has(to)) return null;
  const path: number[] = [];
  for (let c = to; c !== -1; c = prev.get(c)!) path.unshift(c);
  return path;
}

export function neighbours(m: { w: number; walls: number[]; h: number }, c: number): number[] {
  const out: number[] = [];
  const x = c % m.w, y = Math.floor(c / m.w);
  if (!(m.walls[c] & N) && y > 0) out.push(c - m.w);
  if (!(m.walls[c] & E) && x < m.w - 1) out.push(c + 1);
  if (!(m.walls[c] & S) && y < m.h - 1) out.push(c + m.w);
  if (!(m.walls[c] & W) && x > 0) out.push(c - 1);
  return out;
}

export { bfs as mazePath };

function genMaze(d: Difficulty, rng: Rng, support: boolean): ReturnType<typeof genJigsaw> {
  const size = { 1: 3, 2: 5, 3: 6, 4: 8, 5: 9 }[d];
  const w = size, h = size;
  const walls = new Array(w * h).fill(N | E | S | W);
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const c = stack[stack.length - 1];
    const x = c % w, y = Math.floor(c / w);
    const opts: [number, number, number][] = [];
    if (y > 0 && !seen.has(c - w)) opts.push([c - w, N, S]);
    if (x < w - 1 && !seen.has(c + 1)) opts.push([c + 1, E, W]);
    if (y < h - 1 && !seen.has(c + w)) opts.push([c + w, S, N]);
    if (x > 0 && !seen.has(c - 1)) opts.push([c - 1, W, E]);
    if (!opts.length) { stack.pop(); continue; }
    const [n, a, b] = rng.pick(opts);
    walls[c] &= ~a; walls[n] &= ~b; seen.add(n); stack.push(n);
  }
  // Hard+: knock out extra walls to create loops, so there is a real "shortest route".
  if (d >= 4) {
    for (let i = 0; i < size * 1.5; i++) {
      const c = rng.int(0, w * h - 1), x = c % w;
      if (x < w - 1 && walls[c] & E) { walls[c] &= ~E; walls[c + 1] &= ~W; }
    }
  }
  const start = 0, goal = w * h - 1;
  const m = { w, h, walls };
  const main = bfs(m, start, goal)!;
  const rocks: number[] = [];
  if (d >= 3 && !support) {
    const want = d - 2;
    const cand = rng.shuffle(Array.from({ length: w * h }, (_, i) => i).filter((i) => i !== start && i !== goal));
    for (const c of cand) {
      if (rocks.length >= want) break;
      const blocked = new Set([...rocks, c]);
      if (bfs(m, start, goal, blocked)) rocks.push(c);
    }
  }
  const blocked = new Set(rocks);
  const shortestPath = bfs(m, start, goal, blocked) ?? main;
  const stars = d === 5 ? rng.shuffle(shortestPath.slice(2, -2)).slice(0, 2) : [];
  const cells = w * h;
  return {
    instruction: d === 5 ? 'Collect the stars and reach the treasure!' : d >= 3 ? 'Find the way to the treasure. Watch out for rocks!' : 'Help the explorer reach the treasure!',
    expectedSec: Math.round(shortestPath.length * 1.6 + 8),
    mistakeTolerance: Math.ceil(cells / 8),
    payload: { kind: 'maze', data: { w, h, walls, start, goal, rocks, stars, shortest: shortestPath.length - 1 } },
  };
}

/* ---------- Entry point ---------- */

const CHOICE_INSTRUCTIONS: Record<string, string> = {
  pattern: 'Look at the pattern and pick what fits!',
  number: 'Solve the number puzzles!',
  logic: 'Think carefully and pick the right one!',
};

export function generatePuzzle(category: CategoryId, difficulty: Difficulty, seed: string, opts: GenOpts = {}): Puzzle {
  const rng = makeRng(seed);
  const support = !!opts.support;
  const spec = LEVELS[difficulty];
  let body: ReturnType<typeof genJigsaw>;
  switch (category) {
    case 'jigsaw': body = genJigsaw(difficulty, rng, support); break;
    case 'memory': body = genMemory(difficulty, rng, support); break;
    case 'shapes': body = genShapes(difficulty, rng, support); break;
    case 'arrange': body = genArrange(difficulty, rng, opts.custom); break;
    case 'maze': body = genMaze(difficulty, rng, support); break;
    default: {
      const n = support ? Math.max(2, ROUNDS[difficulty] - 1) : ROUNDS[difficulty];
      const rounds = Array.from({ length: n }, () =>
        category === 'pattern' ? genPatternRound(difficulty, rng, support)
        : category === 'number' ? genNumberRound(difficulty, rng, opts.ageGroup ?? 'thinker')
        : genLogicRound(difficulty, rng, opts.custom));
      body = {
        instruction: CHOICE_INSTRUCTIONS[category],
        expectedSec: n * (6 + difficulty * 3),
        mistakeTolerance: Math.max(1, Math.floor(n / 2)),
        payload: { kind: category, data: { rounds } } as PuzzleData,
      };
    }
  }
  return {
    id: `${category}-${difficulty}-${seed}`,
    category, difficulty, seed, support,
    hints: spec.hints,
    guidance: support ? 'strong' : spec.guidance,
    ...body,
  };
}
