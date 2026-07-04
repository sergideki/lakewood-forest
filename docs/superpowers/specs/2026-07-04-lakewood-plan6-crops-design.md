# Lakewood Forest — Plan 6: Crop Rework

**Date:** 2026-07-04
**Status:** Approved (design), pending implementation plan
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

1. Make the crop choice meaningful — no strict dominance.
2. Cross-feed the other systems (creatures via acorns, upgrades via wood, lake pets
   via a catch-rate tie-in).
3. Add unlock gating so wheat has a real early-game role.
4. Give fish a permanent sink.
5. Expand plot capacity so the allocation choice has board space.

## Design

**Core framing:** foraging is passive + random (creatures auto-yield wood/acorns);
the farm is active + directed (you choose exactly what each plot grows). Typed crop
outputs kill strict dominance by construction — a wood crop vs a gold crop is not
"better," it depends on what the economy needs right now.

### Decision 1 — crops output different resource TYPES, not just gold

A single gold axis is what makes berry always win. Typed outputs make each crop a
different tool.

### Decision 2 — Marigold is a passive modifier, not a stored resource

Pets are cozy collectibles with no stats, so a "pet-food resource" would have nowhere
to go. Marigold instead raises the creel catch chance while planted, and gives fish a
permanent sink after the four habitats are built.

`catchChance = CATCH_CHANCE + MARIGOLD_CATCH_BONUS × (marigold plots planted)`,
clamped so it never exceeds `MARIGOLD_CATCH_CAP`.

- `MARIGOLD_CATCH_BONUS = 0.05` (per planted marigold plot)
- `MARIGOLD_CATCH_CAP = 0.75` (hard ceiling on total catch chance)

Cozy framing: "plant marigolds by the water to draw critters."

### Decision 3 — seed-unlock gating (buy a crop once to unlock it permanently)

Reuses the existing resource-spend pattern, gives early gold a sink, is self-paced,
and gives wheat a real early role (it is the only crop until the next seed is
affordable). Wheat is free from the start; the rest are bought once.

### Decision 4 — bump `farm-plot` maxLevel 3 → 5 (6 → 8 plots)

With four distinct output types you want room to run several at once; the allocation
choice ("2 gold, 1 acorn, 1 marigold?") is the whole point and needs board space.

### Crop roster

| Crop | Output | Grow | Yield | Unlock cost |
|------|--------|------|-------|-------------|
| 🌾 Wheat | gold | 100s | 5 | free (start) |
| 🥕 Carrot | acorns (→ creature treats/XP) | 180s | 6 | 50 gold |
| 🌲 Sapling | wood (→ upgrades/habitats) | 180s | 6 | 50 gold |
| 🌼 Marigold | +pet catch chance while planted | — | — | 150 gold + 40 fish |

Rates (yield / growSec): wheat 0.050 gold/s, carrot 0.033 acorn/s, sapling 0.033
wood/s. These are intentionally not comparable — different resource, different
downstream use. Marigold produces no bankable resource (its value is the catch bonus).

## Architecture

### Engine — the real work

The farm changes from a single-resource (gold) producer to a multi-resource producer.

- **Types** (`src/engine/types.ts`)
  - `Crop` gains a discriminant `kind: 'producer' | 'modifier'` (per Open resolution
    1). A `producer` carries `output` (a `Resources` key: `gold`/`wood`/`acorns`/
    `fish`) + `amount` + `growSec`; the old `gold`/`growSec` fields are replaced. A
    `modifier` (Marigold) carries no bankable output — its effect is applied where it
    is consumed (the lake catch bonus).
  - `Storage.barn` `{ amount: number }` → `{ gold: number; wood: number; acorns:
    number; fish: number }` (a per-resource buffer).
  - `GameState` gains `unlockedCrops: CropId[]` (wheat always implicitly unlocked).

- **Content** (`src/engine/content.ts`)
  - `CROPS` reshaped to the roster above with `output`/`amount`.
  - New constants: `MARIGOLD_CATCH_BONUS`, `MARIGOLD_CATCH_CAP`, `CROP_UNLOCK_COST`
    (a `Record<CropId, Partial<Resources>>`), `STARTER_CROPS: CropId[] = ['wheat']`.
  - `farm-plot` upgrade `maxLevel` 3 → 5.

- **Farm engine** (`src/engine/farm.ts`)
  - `farmRatePerSec` (scalar gold) → `farmRatesPerSec(state): Record<Material,
    number>` summing each planted crop's `amount / growSec` into its output bucket
    (marigold contributes nothing bankable). Villager multiplier applies to all
    buckets equally.
  - `barnCap(state)` → per-resource caps (a day's worth of that resource's rate,
    floored, upgraded by `barnCapMult`).
  - `accrueBarn` fills each bucket toward its own cap.
  - `collectBarn` banks the whole-unit part of every bucket into the matching
    resource, carrying fractional remainders.

- **Lake engine** (`src/engine/lake.ts`)
  - `collectCreel` reads the marigold catch bonus: count planted marigold plots,
    `chance = min(CATCH_CHANCE + MARIGOLD_CATCH_BONUS × n, MARIGOLD_CATCH_CAP)`.

- **Town/plant** (`src/engine/town.ts`, `src/engine/farm.ts`)
  - `plantCrop` rejects planting a crop that is not in `unlockedCrops` (wheat/starter
    always allowed) — a guard, returns state unchanged on a locked crop.
  - New `unlockCrop(state, cropId): GameState` — checks affordability against
    `CROP_UNLOCK_COST`, spends the resources, appends to `unlockedCrops`. Idempotent
    (already unlocked → unchanged).

### Persistence (`src/persistence/save.ts`)

- `SAVE_VERSION` 4 → 5.
- New migration `addCropRework(old)`:
  - `storage.barn` number-shape `{ amount }` → `{ gold: amount, wood: 0, acorns: 0,
    fish: 0 }` (preserve any banked gold as the gold bucket).
  - `unlockedCrops`: default `['wheat']`, **plus** any crop id currently planted in a
    plot (so a save mid-berry does not silently lose access to a planted crop). Note
    the roster ids changed (`berry` no longer exists) — a plot holding a removed crop
    id is cleared to `null` on migration, and its id is not added to `unlockedCrops`.
- `isValidBaseState` updated for the new `barn` shape and `unlockedCrops`.

### Store (`src/store/gameStore.ts`)

- New actions: `unlockCrop(cropId)`, wired through the engine. `plant` already exists;
  it now silently no-ops on a locked crop (UI prevents this anyway).
- `collectBarn` selector/action returns multi-resource (UI reads pending per
  resource).

### UI

- **PlotGrid** (`src/ui/components/PlotGrid.tsx`)
  - Crop picker rows show the output resource + amount + grow time.
  - Locked crops render with a lock badge and unlock cost; tapping a locked crop opens
    an unlock confirm (spends resources) rather than planting.
  - Empty plots beyond the current cap are not shown (plot list is authoritative).
- **Barn card** (wherever barn pending is shown) — display pending per resource
  (gold/wood/acorns), not a single number. Collect banks all.

## Testing

- **`test/engine/farm.test.ts`** — extend: multi-resource `farmRatesPerSec` (correct
  bucket per crop), per-resource `barnCap`, `accrueBarn` fills each bucket to its cap
  independently, `collectBarn` banks all buckets + carries remainders, villager
  multiplier applies per bucket.
- **`test/engine/crops.test.ts`** (new) — `unlockCrop` affordability + spend +
  idempotence; `plantCrop` rejects locked crop; starter crop always plantable.
- **`test/engine/lake.test.ts`** — extend: marigold catch bonus scales with planted
  count and clamps at `MARIGOLD_CATCH_CAP`; zero marigolds → base `CATCH_CHANCE`.
- **`test/persistence/save.test.ts`** — extend: v4 → v5 migration maps `barn.amount`
  → gold bucket, seeds `unlockedCrops`, clears plots holding removed crop ids;
  round-trip; junk input still returns null (never a fresh state).

## Open resolutions (decide during writing-plans)

1. **Marigold output modeling** — `output: 'marigold'` sentinel vs a dedicated
   `kind: 'producer' | 'modifier'` discriminant on `Crop`. Prefer the discriminant:
   it keeps `farmRatesPerSec` from special-casing a magic string and makes
   "modifier crop" a first-class, extensible concept.
2. **`Material` vs barn keys** — `Material = 'wood' | 'acorn' | 'fish'` today (no
   gold). The barn buckets need gold too. Reconcile the barn-bucket key set with
   `Resources` keys (`gold/wood/acorns/fish`) rather than `Material` — the barn banks
   resources, not forage materials. Watch the `acorn` (Material) vs `acorns`
   (Resources) naming mismatch.

## Non-goals

- No new crop beyond the four-crop roster.
- No discrete grow/harvest cycles — keep the existing idle-accrual model.
- No changes to foraging, dungeons, or the villager assignment model.
- No seasonal/weather system.
