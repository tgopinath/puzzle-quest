import { describe, expect, it } from 'vitest';
import { applyAttempt, initialProgress, scoreAttempt } from './adaptive';
import { generatePuzzle } from './generators';
import { CATEGORY_IDS, type AttemptResult, type CategoryProgress, type Difficulty } from './types';

const base = (d: Difficulty, over: Partial<AttemptResult> = {}): AttemptResult => ({
  category: 'jigsaw', difficulty: d, solved: true, mistakes: 0, mistakeTolerance: 2,
  hintsUsed: 0, retries: 0, timeSec: 20, expectedSec: 30, ...over,
});

const run = (p: CategoryProgress, rs: Partial<AttemptResult>[]) =>
  rs.reduce((acc, r) => applyAttempt(acc, base(acc.difficulty, r)).progress, p);

describe('adaptive engine', () => {
  it('scores a clean fast solve as 1', () => expect(scoreAttempt(base(1))).toBe(1));
  it('scores an unsolved puzzle as 0', () => expect(scoreAttempt(base(1, { solved: false }))).toBe(0));

  it('spec example: three quick correct solves raise difficulty', () => {
    const p = run(initialProgress(1), [{ timeSec: 30 }, { timeSec: 25 }, { timeSec: 20 }]);
    expect(p.difficulty).toBe(2);
    expect(p.lastChange).toBe('up');
  });

  it('spec example: mistakes, many hints, then a fail lowers difficulty and flags support', () => {
    let p = initialProgress(3);
    p = run(p, [{ mistakes: 6 }, { hintsUsed: 3, timeSec: 80 }]);
    expect(p.difficulty).toBe(2);
    expect(p.supportNext).toBe(true);
  });

  it('maintains difficulty for inconsistent play', () => {
    const p = run(initialProgress(3), [{}, { mistakes: 3, hintsUsed: 1 }, { solved: false }, {}, { hintsUsed: 2 }]);
    expect(p.difficulty).toBe(3);
  });

  it('never goes below 1 or above 5', () => {
    expect(run(initialProgress(1), [{ solved: false }, { solved: false }, { solved: false }]).difficulty).toBe(1);
    expect(run(initialProgress(5), [{}, {}, {}, {}]).difficulty).toBe(5);
  });

  it('resets the window after a change so it does not jump two levels at once', () => {
    const p = run(initialProgress(1), [{}, {}, {}, {}]);
    expect(p.difficulty).toBe(2);
    expect(p.history.length).toBe(1);
  });

  it('daily challenges do not move category difficulty', () => {
    const p = run(initialProgress(2), [{ daily: true }, { daily: true }, { daily: true }]);
    expect(p.difficulty).toBe(2);
  });
});

describe('generators', () => {
  it('produce every category at every level deterministically', () => {
    for (const c of CATEGORY_IDS) for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      const a = generatePuzzle(c, d, 'seed-x');
      const b = generatePuzzle(c, d, 'seed-x');
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.expectedSec).toBeGreaterThan(0);
    }
  });

  it('jigsaw grows from 4 to 36 pieces', () => {
    const sizes = ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => {
      const p = generatePuzzle('jigsaw', d, 's').payload;
      return p.kind === 'jigsaw' ? p.data.rows * p.data.cols : 0;
    });
    expect(sizes).toEqual([4, 9, 16, 25, 36]);
  });

  it('choice rounds always contain their answer', () => {
    for (const c of ['pattern', 'number', 'logic'] as const) for (let i = 0; i < 200; i++) {
      const p = generatePuzzle(c, ((i % 5) + 1) as Difficulty, `s${i}`);
      if (p.payload.kind !== c) throw new Error('kind');
      for (const r of p.payload.data.rounds) expect(r.options.some((o) => o.key === r.answer)).toBe(true);
    }
  });

  it('mazes are always solvable around rocks', () => {
    for (let i = 0; i < 100; i++) {
      const p = generatePuzzle('maze', ((i % 5) + 1) as Difficulty, `m${i}`);
      if (p.payload.kind !== 'maze') throw new Error('kind');
      expect(p.payload.data.shortest).toBeGreaterThan(0);
      expect(p.payload.data.rocks).not.toContain(p.payload.data.goal);
    }
  });
});
