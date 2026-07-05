# Plan 8 — Polish: idle bob + achievements + weak-sprite art pass

**Date:** 2026-07-05
**Status:** design (approved for planning)
**Runs after:** Plan 7 cozy loops (SHIPPED, HEAD `4cdd04c`, save v5, 177/177 green)

Three founder-picked polish items. Items 1–2 are features (full pipeline); item 3 is a mechanical
art edit done last.

---

## Item 1 — Idle bob (transform, one shared clock)

**Goal:** every on-screen sprite gently "breathes" so the world feels alive. Subtle, cheap, no
re-render storms.

**Decision (locked):** a transform-based bob, NOT a two-frame PNG swap. Rationale: a translateY
animation needs zero new assets (sprites stay at 27 PNGs, APK size unchanged, no `gen-sprites.py`
animation work, no registry edits) and runs on the native/compositor thread, so React state never
changes and there are no per-frame re-renders. The two-frame approach would double every sprite
(27→54 PNGs), grow the APK, and add 27 registry lines for a bob the eye can barely tell apart.

**Design:**
- A single module-level `Animated.Value` in `SpriteIcon.tsx`, started ONCE at module load with
  `Animated.loop(Animated.sequence([timing(→1), timing(→0)]))`, `useNativeDriver: true`.
- `SpriteIcon` wraps its existing `Image`/`Text` in an `Animated.View` whose `transform` maps the
  shared value `0→1` to `translateY: 0 → −1.5px → 0` via `interpolate`. Amplitude deliberately tiny
  (gentle breathing, not a bounce).
- Every `SpriteIcon` instance reads the SAME shared value → N sprites add 0 timers and 0 re-renders.
- Emoji fallbacks bob too (the wrapper is outside the sprite/emoji branch).
- Duration ~1300ms each direction (eased `Easing.inOut(Easing.sin)` for an organic feel).

**Boundaries:** the shared value + loop live at module scope so they survive component unmount/mount
and stay phase-synced across the whole app. No props change; every current caller keeps working.

**Non-goals:** per-sprite phase offsets, reduce-motion detection (RN-web has no cheap hook; amplitude
is small enough to be unobtrusive), bob on the locked/`❔` journal cells.

**Testing:** animation is not unit-testable headlessly; correctness = `tsc` clean + live browser QA
(sprites visibly bob, no console errors, no FPS/jank, existing screens unaffected).

---

## Item 2 — Achievements / milestones

**Goal:** a post-completion goal arc. The anti-dominance verdict
(`docs/superpowers/specs/2026-07-04-anti-dominance-playtest-verdict.md`) noted the endgame collapses
to all-carrot with no target; milestones give lifetime goals to chase and make catches/levels matter.

### Data — one additive field

Add `lifetime: { gold: number; wood: number; acorns: number; fish: number }` to `GameState`. It is
the ONLY new persisted state. Everything else a milestone needs is already in state
(`discovered`, `pets`, `creatures[].level`, `upgrades`).

- **Increment sites (engine, pure):** the banked whole-unit amount is added to `lifetime` inside the
  four collect functions via a small shared helper `bumpLifetime(state, delta)`:
  - `collectBarn` (farm.ts) → gold/wood/acorns banked
  - `collectSatchel` (forest.ts) → wood/acorns banked
  - `collectRun` (forest.ts) → gold/wood/acorns loot
  - `collectCreel` (lake.ts) → fish banked
- **Deliberately NOT counted:** the Plan 7 wood→fish trade (`tradeWood`). `lifetime.fish` means fish
  *caught from the creel*; the trade is a separate faucet. Documented so the skeptic/reviewer doesn't
  read it as a missed site.
- Count the FLOORED banked amount (matches what actually enters resources), computed before the
  fractional remainder is carried.

### Save migration v5 → v6 (additive)

- `SAVE_VERSION = 6`.
- New `addLifetimeCounters(old)` migration: backfills `lifetime: { gold:0, wood:0, acorns:0, fish:0 }`
  when absent (idempotent — keeps an existing object). Chained after `addCropRework`.
- `isValidBaseState` stays PRE-migration-safe: it must NOT assert `lifetime` exists (a real v5 save
  has none), or it would fail-and-wipe every v5 save — the exact trap the crop-rework migration
  already documents.
- `createInitialState` seeds `lifetime` at zeros.

### Achievements are pure derivations — no persisted unlock flags

New pure module `src/engine/achievements.ts`:

```ts
export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;               // one line for the row
  progress(state: GameState): { current: number; target: number };
}
export const ACHIEVEMENTS: Achievement[];
export function isComplete(state, a): boolean;   // current >= target
export function completedCount(state): number;
```

`current` is clamped to `target` for display (a bar never overfills). No stored "unlocked" set — a
milestone's done-ness is recomputed from state each render, so nothing can drift out of sync.

**The set (10):**

| id | name | emoji | target rule |
|----|------|-------|-------------|
| `first-friends` | First Friends | 🌱 | `discovered.length` ≥ 3 |
| `forest-complete` | Forest Complete | 🌲 | all 10 land species discovered |
| `aquarist` | Aquarist | 🌊 | all 4 water species discovered |
| `pet-parent` | Pet Parent | 🐾 | `pets.length` ≥ 6 (all pets) |
| `seasoned` | Seasoned | ⭐ | max `creatures[].level` ≥ 10 |
| `veteran` | Veteran | 🎖️ | max `creatures[].level` ≥ 20 |
| `angler` | Angler | 🐟 | `lifetime.fish` ≥ 1000 |
| `wealthy` | Wealthy | 🪙 | `lifetime.gold` ≥ 10000 |
| `lumberjack` | Lumberjack | 🪵 | `lifetime.wood` ≥ 1000 |
| `townsfolk` | Townsfolk | 🏘️ | every upgrade track at its `maxLevel` |

Land vs water is derived from the catalog, NOT hardcoded: water species = `SPECIES[id].affinity ===
'fish'` (4 today), land = the rest (10 today). Targets read `Object.values(SPECIES)` filtered by that
predicate, so adding a species later moves the target automatically instead of silently breaking it.

### UI — MilestonesSection on Friends

New `src/ui/components/MilestonesSection.tsx`, appended below the Pets grid in `FriendsJournal.tsx`
(Friends is the game's journal). Mirrors the existing card + list style.

- 🏆 card header: `Milestones — X / 10 complete`.
- One row per achievement: emoji + name + description; a thin progress bar (accent fill = clamped
  `current/target`); trailing `current / target` text. Complete rows show a ✓ and a full accent bar.
- Read-only, derived each render. Subscribe only to STABLE store slices (`discovered`, `pets`,
  `creatures`, `upgrades`, `lifetime`) — never build a fresh array inside a zustand selector (the
  documented v5 `getSnapshot` crash).

**No unlock toast in v1** (locked) — the store stays untouched; milestones show complete the next
time Friends opens. A toast is a clean later add (diff completed-set per action in the store).

### Testing (item 2)

- `achievements.test.ts` — each milestone's `progress` at not-started / partial / complete, and the
  clamp; `completedCount`.
- `lifetime` increments: extend the relevant collect tests to assert `lifetime` rises by the floored
  bank and that the wood→fish trade does NOT touch `lifetime.fish`.
- `save` migration: a v5 blob → v6 backfills `lifetime` zeros; a v5 blob with in-progress resources
  is not wiped; full v1→v6 chain still lands a valid state.
- All existing 177 tests stay green.

---

## Item 3 — Art pass on the 3 weakest sprites (mechanical)

Weakest per the sprites-all handoff: **pebbleturtle** (pet), **wheat** (crop), **vil-1 / Pip**
(villager). Pure `draw_<id>()` edits in `scripts/gen-sprites.py`, then regenerate ONLY those groups
and overwrite the same PNG filenames (`assets/pets/pebbleturtle.png`, `assets/crops/wheat.png`,
`assets/villagers/vil-1.png`). No code, no registry, no test change (the fs-only
`sprite-assets.test.ts` still passes — files exist, 64×64, registered). Regenerate:
`python3 scripts/gen-sprites.py <group>`. Done last, after items 1–2 land.

---

## Sequencing

1. Item 2 engine (lifetime + migration + achievements module) — TDD.
2. Item 2 UI (MilestonesSection + Friends wiring).
3. Item 1 (SpriteIcon transform bob).
4. Item 3 (art pass) — mechanical.
5. Live browser QA across Home/Friends/Lake; then release path as founder chooses.

Items 1 and 2 touch disjoint files (SpriteIcon vs engine/save/FriendsJournal) so they parallelize
cleanly under subagent-driven build. Item 2's engine must land before its UI.
