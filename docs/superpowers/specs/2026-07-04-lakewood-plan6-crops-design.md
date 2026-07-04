# Lakewood Forest — Plan 6: Crop Rework

**Date:** 2026-07-04
**Status:** Approved (design, post-skeptic revision), pending implementation plan
**Branch:** `feat/plan6-crops`

## Problem

Crops are a strictly-dominated, single-output system. All three produce only gold,
and the gold-per-second ordering is monotonic:

| Crop | Grow | Gold | Gold/sec |
|------|------|------|----------|
| 🌾 Wheat | 100s | 5 | 0.050 |
| 🥕 Carrot | 240s | 14 | 0.058 |
| 🍓 Berry | 480s | 32 | 0.067 |

Berry always wins per second, and all three unlock from the start with no cost or
gating. There is no decision: plant berry on every plot and never touch it again.
Wheat and carrot are dead options. Crops feed only the barn → gold pipe, duplicating
what dungeons already provide, and touch none of the other systems (creatures, lake,
pets).

Separately, the economy has a hole: after all four lake habitats are built, **fish
has no remaining sink** and becomes a dead resource.

## Goals

1. Reduce crop dominance — make plot allocation a real choice (see anti-dominance
   analysis; this is a tuning-backed property, not "by construction").
2. Cross-feed the other systems (creatures via acorns, upgrades via wood, lake pets
   via a catch-rate tie-in).
3. Add unlock gating so wheat has a real early-game role.
4. Give fish an ongoing sink (marigold consumes fish while planted).
5. Expand plot capacity so the allocation choice has board space.

## Design

**Core framing:** foraging is passive + random (creatures auto-yield wood/acorns);
the farm is active + directed (you choose exactly what each plot grows). Typed crop
outputs turn a plot into a routing decision instead of "pick the highest gold number."

### Decision 1 — crops output different resource TYPES, not just gold

A single gold axis is what makes berry always win. Typed outputs make each crop a
different tool.

### Decision 2 — Marigold is a modifier crop that consumes fish and boosts pet catch

Pets are cozy collectibles with no stats, so a "pet-food resource" would have nowhere
to go. Marigold instead raises the creel catch chance **while planted and fed**, and
consumes fish continuously — a genuinely ongoing fish sink (fixing the dead-fish hole,
not a one-time payment).

- While ≥1 marigold plot is planted, fish drains from `resources.fish` at
  `MARIGOLD_FISH_PER_SEC × (marigold plots planted)`, clamped so fish never goes
  negative. This runs in the idle-accrue path (offline-safe: negative gaps clamp to 0;
  the rate is modest so a day offline is a bounded drain, and the creel banks fish
  faster than marigolds drain it at normal counts).
- The catch bonus applies **only while `resources.fish > 0`** (marigolds go dormant —
  no bonus — when the pond runs dry). This is the sink's teeth: to keep pets coming you
  must keep fish stocked.
- `catchChance = min(CATCH_CHANCE + MARIGOLD_CATCH_BONUS × n, MARIGOLD_CATCH_CAP)`
  where `n` = planted marigold plots, but only when `resources.fish > 0`; otherwise
  `catchChance = CATCH_CHANCE`.

Constants: `MARIGOLD_CATCH_BONUS = 0.05`, `MARIGOLD_CATCH_CAP = 0.50` (binds at 5
marigolds — reachable within the 8-plot cap, so the clamp is live and testable),
`MARIGOLD_FISH_PER_SEC = 0.02` (≈72 fish/hour per marigold; creel floor is 200 and rod
alone banks fish, so one or two marigolds is sustainable, many is a real cost).

Cozy framing: "plant marigolds by the water to draw critters — keep the pond stocked."

### Decision 3 — seed-unlock gating (buy a crop once to unlock it permanently)

Reuses the resource-spend pattern, gives early gold a sink, is self-paced, and gives
wheat a real early role: it is the **only** crop unlocked at game start, so early game
is wheat-only until you can afford the next seed. Wheat is free; the rest are bought
once via `unlockCrop`.

### Decision 4 — bump `farm-plot` maxLevel 3 → 5 (6 → 8 plots)

With four distinct output types you want room to run several at once; the allocation
choice ("2 gold, 1 acorn, 1 marigold?") is the whole point and needs board space.

### Crop roster

| Crop | kind | Output | Grow | Yield | Unlock cost |
|------|------|--------|------|-------|-------------|
| 🌾 Wheat | producer | gold | 100s | 5 | free (start) |
| 🥕 Carrot | producer | acorns (→ creature treats/XP) | 180s | 6 | 50 gold |
| 🌲 Sapling | producer | wood (→ upgrades/habitats) | 180s | 6 | 50 gold |
| 🌼 Marigold | modifier | +pet catch chance, drains fish | — | — | 150 gold + 40 fish |

Producer rates (yield / growSec): wheat 0.050 gold/s, carrot 0.033 acorn/s, sapling
0.033 wood/s.

### Anti-dominance analysis (Goal 1)

Typed outputs alone do **not** guarantee no dominance — gold is a universal currency
with no passive source, so a naive "farm the scarcest useful thing" heuristic favors
wheat. The property holds for concrete reasons, not by construction:

- **Gold cannot buy creature XP or pet catch-rate.** Treats are bought with acorns
  (`buyTreat`, 25 acorns → 100 XP); the marigold catch bonus is unlockable only via
  fish + a plot. A player leveling creatures or collecting pets *must* spend plots on
  carrot/marigold — gold cannot substitute. So the choice is real for anyone pursuing
  those goals (which the game's whole progression pushes toward).
- **Plots are the scarce resource** (max 8). Allocation across gold/acorn/wood/pet is
  the decision; there is no "plant the best crop on every plot" because the outputs
  aren't fungible.
- **Progression arc:** gold's marginal value falls as the finite town upgrades cap out
  (all maxLevel ≤ 5); creatures and pets are open-ended collection goals. Late game
  therefore shifts plots away from wheat toward carrot/marigold naturally.
- Carrot vs sapling (both 0.033/s, both feeding open sinks) is a genuine which-do-I-
  need-now choice.

**This is a tuning claim, and it gets a QA gate:** live-play verification that no
single crop is the correct choice for all 8 plots at any progression stage. If wheat
still dominates in playtest, retune (lower wheat's rate or add a gold soft-cap) before
merge.

## Architecture

The farm changes from a single-resource (gold) producer to a multi-resource producer.
Barn buckets cover only the resources crops actually produce: **gold, wood, acorns**
(no fish bucket — fish is banked by the creel, never the barn; a fish bucket would be
permanently dead state).

- **Types** (`src/engine/types.ts`)
  - `Crop` becomes a discriminated union on `kind`:
    - `{ kind: 'producer'; id; name; emoji; output: BarnResource; amount: number;
      growSec: number }` where `BarnResource = 'gold' | 'wood' | 'acorns'` (a subset of
      `Resources` keys — plural `acorns`, matching `Resources`, NOT the singular
      `Material` `'acorn'`).
    - `{ kind: 'modifier'; id; name; emoji }` (Marigold — no bankable output).
  - `Storage.barn` `{ amount: number }` → `{ gold: number; wood: number; acorns:
    number }`. (Note: `Storage.satchel` keeps its existing singular `acorn` key —
    do not propagate that wart to the barn; the barn uses plural `acorns`.)
  - `GameState` gains `unlockedCrops: CropId[]`.

- **Content** (`src/engine/content.ts`)
  - `CROPS` reshaped to the roster above with the `kind` discriminant.
  - New constants: `MARIGOLD_CATCH_BONUS = 0.05`, `MARIGOLD_CATCH_CAP = 0.50`,
    `MARIGOLD_FISH_PER_SEC = 0.02`, `CROP_UNLOCK_COST: Record<CropId,
    Partial<Resources>>` (carrot/sapling 50 gold; marigold 150 gold + 40 fish),
    `STARTER_CROPS: CropId[] = ['wheat']`.
  - `farm-plot` upgrade `maxLevel` 3 → 5.

- **Farm engine** (`src/engine/farm.ts`)
  - `farmRatePerSec` (scalar gold) → `farmRatesPerSec(state): Record<BarnResource,
    number>`, initialised `{ gold: 0, wood: 0, acorns: 0 }`, summing each planted
    **producer** crop's `amount / growSec` into its `output` bucket. **Every crop
    iteration must branch on `kind` first** and skip `modifier` crops — a modifier has
    no `amount`/`growSec`, so an un-narrowed `amount / growSec` yields `NaN` that
    poisons the bucket sum. The villager multiplier applies to all buckets equally.
  - `barnCap(state): Record<BarnResource, number>` — per-resource caps. Apply the
    `Math.max(FLOOR, dailyRate)` floor **only to buckets with a nonzero rate**; a
    resource not being farmed keeps cap 0 (no phantom "0/500" caps in the UI). Keep the
    existing `barnCapMult` upgrade applied after the floor.
  - `accrueBarn` fills each bucket toward its own cap.
  - `collectBarn` banks the whole-unit part of every bucket into the matching resource,
    carrying fractional remainders per bucket.
  - `plantCrop` rejects planting a crop not in `unlockedCrops` (guard: returns state
    unchanged). Single source of truth = `unlockedCrops`; no separate hardcoded wheat
    exception (wheat is unlocked because `createInitialState` and the migration seed
    `['wheat']`).

- **Lake engine** (`src/engine/lake.ts`)
  - `collectCreel` (already receives `state`, **no signature change**) computes the
    catch chance from planted marigold count, gated on `state.resources.fish > 0`
    (dormant when dry), clamped at `MARIGOLD_CATCH_CAP`.
  - New pure `accrueMarigold(state, elapsedSec): GameState` — drains
    `MARIGOLD_FISH_PER_SEC × marigoldCount × elapsedSec` from `resources.fish`, clamped
    at 0. Negative/zero elapsed → unchanged.

- **Idle** (`src/engine/idle.ts`)
  - Add `accrueMarigold` to `applyElapsed` (after `accrueCreel`, before/after XP drip —
    order-independent since it only touches `resources.fish`).

- **State** (`src/engine/state.ts`) — **in scope (skeptic H4).**
  - `createInitialState` seeds `unlockedCrops: ['wheat']` and `barn: { gold: 0, wood:
    0, acorns: 0 }`. Without this, a fresh game has `unlockedCrops === undefined`
    (guard throws) and the old barn shape (NaN caps).

- **Town** (`src/engine/town.ts`)
  - New `unlockCrop(state, cropId): GameState` — **modeled on `buildHabitat`
    (`lake.ts`), NOT `purchaseUpgrade`** (which is fish-blind: it never checks
    `cost.fish`). Checks affordability across all four resources incl. fish, spends
    them, appends to `unlockedCrops`. Idempotent (already unlocked → unchanged;
    unaffordable → unchanged).
  - (Note: `purchaseUpgrade`'s latent fish-blind subtraction is out of scope — no
    upgrade costs fish today. Documented, not fixed.)

### Persistence (`src/persistence/save.ts`)

- `SAVE_VERSION` 4 → 5.
- **`isValidBaseState` must WIDEN, not replace (skeptic C1 — the single most dangerous
  change).** It runs on the raw, *pre-migration* state, so it must still accept a v4
  save (`storage.barn = {amount}`, no `unlockedCrops`):
  - Relax the `barn` check to "`storage.barn` is a non-null object" — do **not** assert
    `barn.gold` or `barn.amount`.
  - Do **not** assert `unlockedCrops` (migrate backfills it).
  - Rewriting the validator to require the new shape would fail every existing v4 save
    → `deserialize` returns a fresh state (**silent wipe**) and `tryDeserialize`
    returns null (**rejects a real backup**). This must not happen.
- New migration `addCropRework(old)` (runs last, for `fromVersion < 5`; earlier steps
  pass `barn` through untouched, so ordering is safe):
  - `storage.barn` `{ amount }` → `{ gold: amount ?? 0, wood: 0, acorns: 0 }` (preserve
    banked gold as the gold bucket; drop any fish notion — there wasn't one).
  - `unlockedCrops`: default `['wheat']`, plus any *still-valid* crop id currently
    planted in a plot (so a save mid-legit-crop keeps access). Removed ids (`carrot`
    and `berry` from the old roster — note the old `carrot` had different stats;
    treat any id not in the new `CROPS` as removed): a plot holding a removed id is
    cleared to `null`, and the id is NOT added to `unlockedCrops`. (`discovered`/
    `creatures` key off `SpeciesId`, not `CropId`, so clearing a plot touches nothing
    else — verified.)

### Store (`src/store/gameStore.ts`)

- New action `unlockCrop(cropId)` wired to the engine. `plant` already exists; it now
  no-ops on a locked crop (UI prevents reaching it anyway).
- `collectBarn` stays an **action** (not a selector) returning the multi-resource
  result into state.
- **Selector-cache rule (skeptic M5 / Contract 3):** the multi-resource Barn card and
  any new crop UI MUST select stable references only — `useGameStore(s => s.state)` or
  a primitive — and read buckets off that. NEVER return a freshly-built object/array
  from a `useGameStore(s => ...)` selector (e.g. `s => ({gold, wood, acorns})` or
  `Object.entries(...)`) — that crashes on mount with "getSnapshot should be cached".

### UI

- **PlotGrid** (`src/ui/components/PlotGrid.tsx`)
  - `c.gold`/`c.growSec` accesses (line ~63) become `kind`-narrowed: producers show
    output resource + amount + grow time; the modifier (marigold) shows its effect.
  - Locked crops render with a lock badge + unlock cost; tapping a locked crop opens an
    unlock confirm (spends via `unlockCrop`) instead of planting.
- **BarnCard** (`src/ui/components/BarnCard.tsx`) — reads `barn.amount` today (→ NaN
  after reshape). Rewrite to show pending per resource (gold/wood/acorns); collect
  banks all. Keep the stable `s => s.state` selector (see Store rule).

## Testing

Existing assertions **break and must be rewritten**, not merely extended (skeptic H3):

- **`test/engine/farm.test.ts`** — `barn.amount` and `barnCap(s) === 500` assertions
  (lines ~11-12), and every scalar `farmRatePerSec`/`accrueBarn`/`collectBarn` test
  (~20-120) rewrite for the Record shape. Add: `farmRatesPerSec` routes each producer
  to the correct bucket; a planted modifier contributes nothing (no NaN); per-resource
  `barnCap` floors only nonzero-rate buckets; `collectBarn` banks all buckets + carries
  remainders; villager multiplier per bucket.
- **`test/engine/crops.test.ts`** (new) — `unlockCrop` affordability incl. fish +
  spend + idempotence; `plantCrop` rejects a locked crop; starter (wheat) always
  plantable.
- **`test/engine/lake.test.ts`** — add: marigold catch bonus scales with planted count,
  clamps at `MARIGOLD_CATCH_CAP` (reachable at 5 marigolds), is dormant when
  `fish === 0`, base `CATCH_CHANCE` at 0 marigolds; `accrueMarigold` drains fish
  clamped at 0. Existing creel tests must still pass unchanged (0 marigolds → base).
- **`test/persistence/save.test.ts`** — `SAVE_VERSION === 4` hardcode (~72-73) → 5;
  round-trips planting `'berry'` (~22) → a valid new id. Add (skeptic C1): a
  serialized **v4** envelope (`barn:{amount:N}`, no `unlockedCrops`, a plot holding a
  removed id) survives BOTH `deserialize` and `tryDeserialize` — gold preserved in the
  gold bucket, `unlockedCrops` backfilled to `['wheat']`, removed-id plot cleared to
  null; junk input still returns null (never a fresh state).

## Non-goals

- No new crop beyond the four-crop roster.
- No discrete grow/harvest cycles — keep the existing idle-accrual model.
- No changes to foraging, dungeons, or the villager assignment model.
- No fix to `purchaseUpgrade`'s latent fish-blindness (no upgrade costs fish).
- No seasonal/weather system.
