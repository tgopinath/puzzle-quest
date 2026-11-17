# Puzzle Quest

An adaptive puzzle adventure for children aged 4–12. Eight puzzle types, five difficulty levels, and a difficulty engine that adjusts each puzzle type on its own. Includes a PIN-protected parent dashboard.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, generator and store tests
npm run build
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the screen flow, the engine algorithm and the data model.

## What's in this version

- **Onboarding:** a parent account (name, email, 4-digit PIN), then a child profile (name, age group) and an avatar.
- **Home:** the adventure map with 8 worlds that unlock in order, Continue playing, the Daily challenge, a puzzle picker, trophies, a costume shop and a profile switcher.
- **8 playable puzzle types**, each generated from a seed at levels 1–5:
  - Jigsaw: 4 → 36 pieces, drag or tap-to-place, with a ghost image and a peek button.
  - Shapes: drag shapes to outlines. Decoy outlines from Medium, rotation from Hard.
  - Numbers: counting, sequences, comparing, adding and subtracting, ×.
  - Picture stories: put 2–6 steps in order.
  - Memory: 2–12 pairs, with a starting peek at the easy levels.
  - Logic: odd one out, property questions and analogies.
  - Patterns: colours, shapes, animals and number rules.
  - Mazes: 3×3 → 9×9, with rocks, loops (so there's a shortest route) and stars to collect.
- **Every puzzle has:** a hint (unlimited at easy levels, 3/2/1 at harder ones), restart, pause, audio instructions, a progress bar, an optional timer that never fails the child, a result screen, and an automatic next puzzle.
- **Adaptive engine** (`src/core/adaptive.ts`): scores each attempt on mistakes, hints, retries and time. It moves up after 3 strong results and down after 2 struggles, keeping separate state per category. After a drop, the next puzzle is a "warm-up" with extra guidance.
- **Rewards:** stars, coins, XP and player level, streaks, 14 achievements, unlockable avatars and costumes. Effort earns rewards too.
- **Parent dashboard:**
  - KPIs and three 14-day charts.
  - A per-category table showing difficulty, accuracy and speed, plus strengths and areas to practise.
  - Child management: add, rename, change age group, remove.
  - Settings: sound, audio, timers, daily screen-time limit with a break screen, reset progress, change PIN.
  - Content & tuning: engine thresholds, custom logic puzzles and stories, aggregate puzzle stats, and a preview of any puzzle at any level.

## Not done yet

- **Backend:** data is saved in `localStorage` through a `StorageAdapter` (`src/core/db.ts`). `supabase/schema.sql` has the full schema with row-level security, but there is no Supabase adapter or auth wiring yet.
- **Native apps:** the web app is responsive and installable (manifest + safe areas). It hasn't been packaged as Android/iOS yet. `src/core/` is plain TypeScript with no DOM, so an Expo app (or a Capacitor wrapper of this build) can reuse it.
- **Admin uploads:** there's no image or audio upload. Custom content is emoji-based, and instructions use the device's speech voice.
