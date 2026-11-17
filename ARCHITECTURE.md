# Puzzle Quest — Architecture

## 1. Layers

```
src/core/        Pure TypeScript. No React, no DOM. Shared by web and a future Expo app.
  types.ts         Domain types (Child, CategoryProgress, Attempt, Puzzle data…)
  rng.ts           Seeded random (daily challenge + reproducible puzzles)
  difficulty.ts    The 5 difficulty levels and per-category parameters
  adaptive.ts      Adaptive Difficulty Engine (per-category, independent)
  generators.ts    Procedural puzzle generators: (category, difficulty, seed) -> puzzle
  rewards.ts       Stars, coins, XP, player level, streaks
  achievements.ts  Achievement definitions + evaluation
  worlds.ts        The 8 worlds, their category, unlock rules
  db.ts            Persistent store (localStorage repository, versioned)
src/game/        One React component per puzzle type + shared drag-and-drop hook
src/screens/     Onboarding, Home (map), Play, Result, Parent gate, Parent dashboard, Admin
src/ui/          Design-system primitives (Button, Card, Avatar, Stars, Modal…)
supabase/        schema.sql with RLS policies for the hosted backend
```

The UI never computes difficulty or rewards itself. It reports an `AttemptResult`
to the store; the store calls the engine, rewards and achievements, then persists.

## 2. Screen flow

```
First launch ─► Parent signup (name, email, 4-digit PIN)
             ─► Add child (name, age group) ─► Pick avatar
             ─► Home (adventure map)
Home ─► World ─► Level ─► Play ─► Result (stars, message) ─► Next puzzle (re-planned)
Home ─► Daily challenge ─► Play ─► Result
Home ─► Trophy room (achievements) / Costume shop (coins)
Home ─► 🔒 Grown-ups ─► PIN gate ─► Parent dashboard
          ├─ Overview charts, category table, strengths / needs practice
          ├─ Children (add, switch, age group, avatar)
          ├─ Settings (sound, timers, audio instructions, daily limit, reset)
          └─ Content admin (difficulty tuning, custom puzzles, aggregate stats)
Screen-time limit reached ─► Break screen (parent PIN to extend)
```

## 3. Two progression systems

| Player level | Puzzle difficulty |
|---|---|
| One per child | One per child **per category** |
| Driven by XP from every finished puzzle (effort counts) | Driven only by performance in that category |
| Only goes up | Goes up, stays, or goes down |
| Unlocks worlds, costumes, avatars | Shapes the next puzzle's size and rules |

## 4. Adaptive Difficulty Engine

Each finished (or abandoned) puzzle becomes an `AttemptResult`:
`solved, mistakes, hintsUsed, retries, timeSec, expectedSec, mistakeTolerance`.

**Score (0–1)**
```
if not solved: score = 0
else score = 1
   - 0.60 * clamp((mistakes / max(1, tolerance) - 0.5) / 2, 0, 1)  // some mistakes are fine
   - 0.12 * hintsUsed (max 0.36)
   - 0.10 * retries  (max 0.2)
   - 0.25 * clamp((timeSec/expectedSec - 1.2) / 1.3, 0, 1)    // only penalise > 1.2x expected
```
Classified as **strong** (≥ 0.8), **ok** (0.45–0.8) or **struggle** (< 0.45 or unsolved).

**Rules (tunable in admin)**
- Increase: last 3 results in this category are strong (and none since last change),
  or 5-result average ≥ 0.85 with success rate 100%.
- Decrease: last 2 results are struggles, or 3 of the last 4.
- Otherwise maintain.
- After any change the window resets, so one category never oscillates.
- After a decrease, the next puzzle is a *supporting challenge* (same category,
  generated with extra guidance), and the child sees an encouraging message.

Every category has its own state, so a strong jigsaw player does not get harder
memory puzzles.

## 5. Difficulty levels

| Level | Objects | Timer | Hints | Guidance |
|---|---|---|---|---|
| 1 Very Easy | 2–4 | none | unlimited | strong visual guides |
| 2 Easy | 4–6 | none | unlimited | light guides |
| 3 Medium | 6–12 | optional (setting) | 3 | none |
| 4 Hard | 12–25 | optional | 2 | none, multi-step |
| 5 Expert | 25–50 | optional | 1 | none, advanced |

Age group picks the *starting* level (Junior 1, Thinker 2, Master 3) and the content
theme; after that only performance moves it.

## 6. Data model

Local store mirrors the hosted schema (`supabase/schema.sql`):
`users (parent), children, puzzle_categories, puzzles (custom content), game_progress
(child × category), puzzle_attempts, achievements, child_achievements`, plus
`child_settings` and `play_sessions` for screen time.

## 7. Privacy

- Only parent name, parent email and child first name + age group are stored.
- No ads, no external links, no chat, no analytics in the child UI.
- Parent area behind a PIN gate. Hosted schema uses row-level security so a parent
  can only read their own children's rows.
