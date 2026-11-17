// Demo data for the portfolio screenshots. tools/shots.mjs evaluates this inside the Vite dev page.
// A parent (PIN 1234) with two children and 14 days of play: Meera sails through jigsaws and shapes
// and is still practising memory, so the dashboard shows real strengths, a drop and a warm-up.
(async () => {
  localStorage.clear();
  const { actions, progressFor, store } = await import('/src/core/db.ts');
  const realNow = Date.now.bind(Date);
  let fake = null;
  Date.now = () => fake ?? realNow();
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const start = realNow() - 13 * 86400000;
  fake = start - 3600000;
  actions.signup('Priya', 'priya@example.com', '1234');
  const meera = actions.addChild('Meera', 'thinker', '🦊');
  const arjun = actions.addChild('Arjun', 'junior', '🐼');
  const skill = {
    [meera]: { jigsaw: 0.95, shapes: 0.9, number: 0.8, arrange: 0.75, memory: 0.3, logic: 0.7 },
    [arjun]: { jigsaw: 0.8, shapes: 0.6 },
  };
  const plan = {
    [meera]: ['jigsaw', 'jigsaw', 'jigsaw', 'shapes', 'shapes', 'shapes', 'number', 'number', 'number', 'arrange', 'arrange', 'arrange', 'memory', 'memory', 'memory', 'memory', 'logic', 'logic', 'jigsaw', 'number'],
    [arjun]: ['jigsaw', 'jigsaw', 'jigsaw', 'shapes', 'shapes', 'jigsaw'],
  };
  const played = { [meera]: 0, [arjun]: 0 };
  for (let d = 0; d < 14; d++) {
    for (const id of [meera, arjun]) {
      if (id === arjun && d % 3 === 1) continue;
      const n = id === meera ? 3 + (d % 3) : 2;
      for (let k = 0; k < n; k++) {
        fake = start + d * 86400000 + (16 * 3600 + k * 420) * 1000;
        const cat = plan[id][played[id]++ % plan[id].length];
        const child = store.get().children.find((c) => c.id === id);
        const { difficulty } = progressFor(child, cat);
        const good = rnd() < skill[id][cat] - (difficulty - 2) * 0.08;
        const exp = 40 + difficulty * 25;
        actions.recordAttempt(id, `seed-${d}-${k}`, {
          category: cat, difficulty, solved: good || rnd() < 0.6,
          mistakes: good ? Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 3), mistakeTolerance: 3,
          hintsUsed: good ? 0 : 1 + Math.floor(rnd() * 2), retries: good ? 0 : Math.floor(rnd() * 2),
          timeSec: Math.round(exp * (good ? 0.7 + rnd() * 0.4 : 1.3 + rnd() * 0.6)), expectedSec: exp,
        });
        actions.addPlayTime(id, Math.round(exp * 1.4));
      }
    }
  }
  fake = null; Date.now = realNow;
  actions.setActive(meera);
  return 'seeded';
})()
