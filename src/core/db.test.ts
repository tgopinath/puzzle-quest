import { describe, expect, it } from 'vitest';
import { actions, earnedFor, progressFor, store } from './db';
import type { AttemptResult } from './types';

const win = (over: Partial<AttemptResult> = {}): AttemptResult => ({
  category: 'jigsaw', difficulty: 1, solved: true, mistakes: 0, mistakeTolerance: 2,
  hintsUsed: 0, retries: 0, timeSec: 15, expectedSec: 26, ...over,
});

describe('store + engine integration', () => {
  actions.signup('Parent', 'p@example.test', '1234');
  const id = actions.addChild('Mia', 'junior', '🦊');
  const child = () => store.get().children.find((c) => c.id === id)!;

  it('raises only the category the child is good at', () => {
    for (let i = 0; i < 3; i++) actions.recordAttempt(id, `p${i}`, win());
    expect(progressFor(child(), 'jigsaw').difficulty).toBe(2);
    expect(progressFor(child(), 'memory').difficulty).toBe(1);
  });

  it('lowers difficulty after struggles, with a supporting puzzle next', () => {
    const out1 = actions.recordAttempt(id, 'x1', win({ difficulty: 2, solved: false }));
    const out2 = actions.recordAttempt(id, 'x2', win({ difficulty: 2, solved: false }));
    expect(out1.decision).toBe('same');
    expect(out2.decision).toBe('down');
    expect(out2.message).toMatch(/easier|learning|effort/i);
    expect(progressFor(child(), 'jigsaw').difficulty).toBe(1);
    expect(progressFor(child(), 'jigsaw').supportNext).toBe(true);
  });

  it('tracks rewards, world levels and achievements', () => {
    const c = child();
    expect(c.worldLevels.color).toBe(3);
    expect(c.stars).toBeGreaterThanOrEqual(9);
    const earned = earnedFor(id).map((e) => e.achievementId);
    expect(earned).toContain('first');
  });

  it('unlocks the next world after 3 levels', () => {
    // Color Kingdom now has 3 levels, so Shape Adventure is open; record a shapes win.
    const out = actions.recordAttempt(id, 's1', win({ category: 'shapes' }));
    expect(out.stars).toBe(3);
    expect(child().worldLevels.shape).toBe(1);
  });
});
