# Plan 6 — Crop Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn crops from a strictly-dominated gold ladder into a real plot-allocation decision — typed resource outputs (gold/wood/acorns), a marigold modifier crop that boosts pet catch-rate while draining fish, seed-unlock gating, and 6→8 plots.

**Architecture:** Pure/RN-free engine slice. The farm becomes a multi-resource producer: `Storage.barn` `{amount}` → `{gold,wood,acorns}`; `Crop` becomes a discriminated union (`producer` | `modifier`). Save envelope goes v4→v5 with an additive migration and a *widened* validator. Store + UI follow. All rolls stay deterministic via injected `Rng`.

**Tech Stack:** React Native + Expo, TypeScript, Zustand v5, Vitest (node env).

**Spec:** `docs/superpowers/specs/2026-07-04-lakewood-plan6-crops-design.md`

**Branch:** `feat/plan6-crops` (already created off `origin/main`).

**Key compile note:** the `Crop` union + `barn` reshape break the whole project's `tsc` at once. Vitest (esbuild) transpiles per-file without a full typecheck, so each engine task runs its OWN test file green even while unrelated files (UI/store) still have type errors. The full `npx tsc --noEmit` gate runs LAST (Task 12). Do not expect a clean whole-project tsc until then.

---

### Task 1: Reshape core types

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1: Add `BarnResource`, reshape `Crop` to a discriminated union, reshape `Storage.barn`, add `unlockedCrops`**

In `src/engine/types.ts`, replace the `Crop` interface (lines 3-9):

```ts
/** Resources a producer crop can bank (a subset of Resources keys — plural `acorns`). */
export type BarnResource = 'gold' | 'wood' | 'acorns';

interface CropBase {
  id: CropId;
  name: string;
  emoji: string;
}
/** A crop that banks a resource into the barn over time. */
export interface ProducerCrop extends CropBase {
  kind: 'producer';
  output: BarnResource;
  amount: number;  // resource produced per yield cycle
  growSec: number; // seconds for one full yield
}
/** A crop with no bankable output; its effect is applied where it is consumed (e.g. lake catch). */
export interface ModifierCrop extends CropBase {
  kind: 'modifier';
}
export type Crop = ProducerCrop | ModifierCrop;
```

Replace the `Storage` interface `barn` line (line 99) so `Storage` reads:

```ts
export interface Storage {
  barn: { gold: number; wood: number; acorns: number };
  satchel: { wood: number; acorn: number };
  creel: { fish: number };
}
```

Add `unlockedCrops` to `GameState` (after the `plots` line, ~line 129):

```ts
  unlockedCrops: CropId[]; // crop ids the player may plant; wheat is always seeded here
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(plan6): reshape Crop union, multi-resource barn, unlockedCrops"
```

---

### Task 2: Crop roster + constants in content

**Files:**
- Modify: `src/engine/content.ts`

- [ ] **Step 1: Replace the CROPS table (lines 3-9)**

```ts
import type { Crop, CropId, Species, SpeciesId, Dungeon, TownUpgrade, UpgradeId, Habitat, Pet, PetId, Resources } from './types';

export const CROPS: Record<CropId, Crop> = {
  wheat:    { kind: 'producer', id: 'wheat',    name: 'Wheat',    emoji: '🌾', output: 'gold',   amount: 5, growSec: 100 },
  carrot:   { kind: 'producer', id: 'carrot',   name: 'Carrot',   emoji: '🥕', output: 'acorns', amount: 6, growSec: 180 },
  sapling:  { kind: 'producer', id: 'sapling',  name: 'Sapling',  emoji: '🌲', output: 'wood',   amount: 6, growSec: 180 },
  marigold: { kind: 'modifier', id: 'marigold', name: 'Marigold', emoji: '🌼' },
};

export const CROP_IDS: CropId[] = Object.keys(CROPS);

/** Crops unlocked at game start (all others must be bought via unlockCrop). */
export const STARTER_CROPS: CropId[] = ['wheat'];

/** One-time cost to permanently unlock a crop for planting. Absent component = 0. */
export const CROP_UNLOCK_COST: Record<CropId, Partial<Resources>> = {
  carrot:   { gold: 50 },
  sapling:  { gold: 50 },
  marigold: { gold: 150, fish: 40 },
};

// --- Marigold (modifier crop) tuning ---
export const MARIGOLD_CATCH_BONUS = 0.05;  // +catch chance per planted marigold plot
export const MARIGOLD_CATCH_CAP = 0.50;    // hard ceiling on total catch chance (binds at 5 marigolds)
export const MARIGOLD_FISH_PER_SEC = 0.02; // fish drained per second per planted marigold (~72/hour)
```

Note: `import type` at the top of `content.ts` already lists several types on line 1 — merge `Resources` into that existing import line rather than adding a duplicate import.

- [ ] **Step 2: Bump the farm-plot upgrade maxLevel 3 → 5**

In the `UPGRADES` record, change the `farm-plot` line's `maxLevel: 3` to `maxLevel: 5`:

```ts
  'farm-plot':      { id: 'farm-plot',      name: 'Farm Expansion',    emoji: '🚜', description: 'Clear land for a new crop plot',  maxLevel: 5, baseCost: { gold: 150, wood: 50 },   costGrowth: 2.5 },
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/content.ts
git commit -m "feat(plan6): crop roster (wheat/carrot/sapling/marigold), unlock costs, farm-plot maxLevel 5"
```

---

### Task 3: Seed new fields in createInitialState

**Files:**
- Modify: `src/engine/state.ts`
- Test: `test/engine/farm.test.ts` (rewrite the createInitialState test)

- [ ] **Step 1: Rewrite the failing createInitialState test**

Replace the first `describe('createInitialState', ...)` block in `test/engine/farm.test.ts` (lines 4-15) with:

```ts
describe('createInitialState', () => {
  it('starts with three empty plots, three villagers, an empty barn, wheat unlocked, and starter gold', () => {
    const s = createInitialState(1000);
    expect(s.plots).toHaveLength(3);
    expect(s.plots.every((p) => p.crop === null)).toBe(true);
    expect(s.villagers).toHaveLength(3);
    expect(s.villagers.every((v) => v.assignedTo === null)).toBe(true);
    expect(s.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
    expect(s.unlockedCrops).toEqual(['wheat']);
    expect(s.resources.gold).toBeGreaterThanOrEqual(0);
    expect(s.meta.lastSeen).toBe(1000);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/engine/farm.test.ts -t "starts with three empty plots"`
Expected: FAIL (`s.storage.barn` still `{amount:0}`, `s.unlockedCrops` undefined).

- [ ] **Step 3: Update createInitialState**

In `src/engine/state.ts`, add `STARTER_CROPS` to the content import (line 2) and set the two fields. The returned object's `plots` stays; add `unlockedCrops` and change `storage.barn`:

```ts
import { DUNGEONS, STARTER_SPECIES, HABITATS, STARTER_CROPS } from './content';
```

```ts
    plots: [
      { id: 'plot-1', crop: null },
      { id: 'plot-2', crop: null },
      { id: 'plot-3', crop: null },
    ],
    unlockedCrops: [...STARTER_CROPS],
    villagers: [
```

```ts
    storage: { barn: { gold: 0, wood: 0, acorns: 0 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run test/engine/farm.test.ts -t "starts with three empty plots"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts test/engine/farm.test.ts
git commit -m "feat(plan6): seed unlockedCrops + multi-resource barn in initial state"
```

---

### Task 4: Multi-resource farm engine

**Files:**
- Modify: `src/engine/farm.ts`
- Test: `test/engine/farm.test.ts` (rewrite rate/cap/accrue/collect tests)

- [ ] **Step 1: Rewrite the farm engine**

Replace the whole body of `src/engine/farm.ts` with:

```ts
import type { GameState, CropId, BarnResource } from './types';
import { CROPS } from './content';
import { barnCapMult } from './town';

/** The barn holds this many hours of the current production rate before it's "full". */
export const BARN_HOURS = 24;
/** Minimum cap for any resource the farm is actively producing. */
export const BARN_FLOOR = 500;

const BARN_RESOURCES: BarnResource[] = ['gold', 'wood', 'acorns'];

function zeroRates(): Record<BarnResource, number> {
  return { gold: 0, wood: 0, acorns: 0 };
}

/** Per-resource gold/wood/acorns produced per second across all planted PRODUCER crops. */
export function farmRatesPerSec(state: GameState): Record<BarnResource, number> {
  const rates = zeroRates();
  const assigned = state.villagers.filter((v) => v.assignedTo === 'farm').length;
  if (assigned === 0) return rates;
  const multiplier = 1 + 0.25 * (assigned - 1);
  for (const p of state.plots) {
    if (!p.crop) continue;
    const crop = CROPS[p.crop];
    if (!crop || crop.kind !== 'producer') continue; // modifier crops bank nothing
    rates[crop.output] += (crop.amount / crop.growSec) * multiplier;
  }
  return rates;
}

/** Per-resource cap: a day of that resource's rate, floored (nonzero rates only), then upgraded. */
export function barnCap(state: GameState): Record<BarnResource, number> {
  const rates = farmRatesPerSec(state);
  const mult = barnCapMult(state);
  const caps = zeroRates();
  for (const res of BARN_RESOURCES) {
    if (rates[res] <= 0) { caps[res] = 0; continue; } // not farmed → no phantom cap
    const perDay = rates[res] * BARN_HOURS * 3600;
    caps[res] = Math.round(Math.max(BARN_FLOOR, Math.round(perDay)) * mult);
  }
  return caps;
}

/** Fill every barn bucket toward its own cap over `elapsedSec`. Immutable. */
export function accrueBarn(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const rates = farmRatesPerSec(state);
  const caps = barnCap(state);
  const barn = { ...state.storage.barn };
  let changed = false;
  for (const res of BARN_RESOURCES) {
    const gained = rates[res] * elapsedSec;
    if (gained <= 0) continue;
    const room = Math.max(0, caps[res] - barn[res]);
    const add = Math.min(gained, room);
    if (add > 0) { barn[res] += add; changed = true; }
  }
  if (!changed) return state;
  return { ...state, storage: { ...state.storage, barn } };
}

/** Bank the whole-unit part of every bucket into its resource; carry fractional remainders. */
export function collectBarn(state: GameState): GameState {
  const barn = { ...state.storage.barn };
  const resources = { ...state.resources };
  for (const res of BARN_RESOURCES) {
    const banked = Math.floor(barn[res]);
    if (banked <= 0) continue;
    resources[res] += banked;
    barn[res] -= banked;
  }
  return { ...state, resources, storage: { ...state.storage, barn } };
}

/** Set a plot's crop. Rejects (returns state unchanged) a crop not in unlockedCrops. */
export function plantCrop(state: GameState, plotId: string, cropId: CropId | null): GameState {
  if (cropId !== null && !state.unlockedCrops.includes(cropId)) return state;
  return {
    ...state,
    plots: state.plots.map((p) => (p.id === plotId ? { ...p, crop: cropId } : p)),
  };
}

export function assignVillager(
  state: GameState,
  villagerId: string,
  to: 'farm' | null,
): GameState {
  return {
    ...state,
    villagers: state.villagers.map((v) =>
      v.id === villagerId ? { ...v, assignedTo: to } : v,
    ),
  };
}
```

- [ ] **Step 2: Rewrite the farm tests**

Replace the `describe('farmRatePerSec', ...)`, `describe('accrueBarn', ...)`, and `describe('collectBarn', ...)` blocks in `test/engine/farm.test.ts`. First, change the import line `import { farmRatePerSec, plantCrop, assignVillager } ...` to `import { farmRatesPerSec, plantCrop, assignVillager } ...`. Then:

```ts
describe('farmRatesPerSec', () => {
  it('is all-zero with no villager assigned even if crops are planted', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    expect(farmRatesPerSec(s)).toEqual({ gold: 0, wood: 0, acorns: 0 });
  });

  it('routes each producer crop to its own resource bucket', () => {
    let s = createInitialState(0);
    s = { ...s, unlockedCrops: ['wheat', 'carrot', 'sapling'] };
    s = plantCrop(s, 'plot-1', 'wheat');   // gold 5/100 = 0.05
    s = plantCrop(s, 'plot-2', 'carrot');  // acorns 6/180 = 0.0333
    s = plantCrop(s, 'plot-3', 'sapling'); // wood 6/180 = 0.0333
    s = assignVillager(s, 'vil-1', 'farm');
    const r = farmRatesPerSec(s);
    expect(r.gold).toBeCloseTo(0.05, 5);
    expect(r.acorns).toBeCloseTo(6 / 180, 5);
    expect(r.wood).toBeCloseTo(6 / 180, 5);
  });

  it('a planted modifier crop (marigold) contributes no rate and no NaN', () => {
    let s = createInitialState(0);
    s = { ...s, unlockedCrops: ['wheat', 'marigold'] };
    s = plantCrop(s, 'plot-1', 'marigold');
    s = assignVillager(s, 'vil-1', 'farm');
    const r = farmRatesPerSec(s);
    expect(r).toEqual({ gold: 0, wood: 0, acorns: 0 });
    expect(Number.isNaN(r.gold + r.wood + r.acorns)).toBe(false);
  });

  it('gives +25% per extra assigned villager', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // base 0.05/s gold
    s = assignVillager(s, 'vil-1', 'farm');
    s = assignVillager(s, 'vil-2', 'farm'); // x1.25
    expect(farmRatesPerSec(s).gold).toBeCloseTo(0.0625, 5);
  });
});

describe('accrueBarn', () => {
  it('adds rate * elapsed to the matching bucket', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat'); // 0.05 gold/s
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 200);              // 0.05 * 200 = 10 gold
    expect(s.storage.barn.gold).toBeCloseTo(10, 5);
    expect(s.storage.barn.wood).toBe(0);
  });

  it('never exceeds the per-resource cap', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 10_000_000);
    expect(s.storage.barn.gold).toBe(barnCap(s).gold);
  });

  it('does nothing when elapsed is zero or negative', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    expect(accrueBarn(s, 0).storage.barn.gold).toBe(0);
    expect(accrueBarn(s, -50).storage.barn.gold).toBe(0);
  });

  it('is immutable — leaves the input barn untouched', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    const result = accrueBarn(s, 200);
    expect(s.storage.barn.gold).toBe(0);
    expect(result).not.toBe(s);
    expect(result.storage.barn.gold).toBeCloseTo(10, 5);
  });
});

describe('collectBarn', () => {
  it('moves each whole bucket into its resource and empties the buckets', () => {
    let s = createInitialState(0);
    s = { ...s, storage: { ...s.storage, barn: { gold: 42, wood: 3, acorns: 7 } } };
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.resources.wood).toBe(3);
    expect(s.resources.acorns).toBe(7);
    expect(s.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
  });

  it('banks whole units and carries the fractional remainder per bucket', () => {
    let s = createInitialState(0);
    s = { ...s, storage: { ...s.storage, barn: { gold: 42.7, wood: 0, acorns: 1.2 } } };
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.resources.acorns).toBe(1);
    expect(s.storage.barn.gold).toBeCloseTo(0.7, 5);
    expect(s.storage.barn.acorns).toBeCloseTo(0.2, 5);
  });
});
```

Also update the `describe('plantCrop / assignVillager', ...)` block: the `plantCrop(s0, 'plot-2', 'carrot')` test must first unlock carrot, else it now no-ops. Change that test to:

```ts
  it('plantCrop is immutable and sets the plot crop', () => {
    const s0 = { ...createInitialState(0), unlockedCrops: ['wheat', 'carrot'] };
    const s1 = plantCrop(s0, 'plot-2', 'carrot');
    expect(s0.plots.find((p) => p.id === 'plot-2')!.crop).toBeNull();
    expect(s1.plots.find((p) => p.id === 'plot-2')!.crop).toBe('carrot');
  });

  it('plantCrop rejects a crop that is not unlocked', () => {
    const s0 = createInitialState(0); // only wheat unlocked
    const s1 = plantCrop(s0, 'plot-1', 'carrot');
    expect(s1).toBe(s0); // unchanged
  });
```

- [ ] **Step 3: Run the farm tests**

Run: `npx vitest run test/engine/farm.test.ts`
Expected: PASS (all).

- [ ] **Step 4: Commit**

```bash
git add src/engine/farm.ts test/engine/farm.test.ts
git commit -m "feat(plan6): multi-resource farm engine (farmRatesPerSec, per-bucket barn) + plant guard"
```

---

### Task 5: unlockCrop in town engine

**Files:**
- Modify: `src/engine/town.ts`
- Test: `test/engine/crops.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `test/engine/crops.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, unlockCrop, plantCrop } from '../../src/engine';

const rich = (over: Partial<ReturnType<typeof createInitialState>['resources']> = {}) => ({
  ...createInitialState(0),
  resources: { gold: 1000, wood: 1000, acorns: 1000, fish: 1000, ...over },
});

describe('unlockCrop', () => {
  it('unlocks an affordable crop and spends its cost', () => {
    const s = unlockCrop(rich(), 'carrot'); // costs 50 gold
    expect(s.unlockedCrops).toContain('carrot');
    expect(s.resources.gold).toBe(950);
  });

  it('checks ALL resources including fish (marigold costs 150 gold + 40 fish)', () => {
    const broke = rich({ fish: 10 }); // enough gold, not enough fish
    const s = unlockCrop(broke, 'marigold');
    expect(s).toBe(broke); // no-op: cannot afford fish
    expect(s.unlockedCrops).not.toContain('marigold');
  });

  it('spends fish when affordable', () => {
    const s = unlockCrop(rich(), 'marigold');
    expect(s.unlockedCrops).toContain('marigold');
    expect(s.resources.gold).toBe(850);
    expect(s.resources.fish).toBe(960);
  });

  it('is idempotent — already unlocked returns state unchanged', () => {
    const once = unlockCrop(rich(), 'carrot');
    const twice = unlockCrop(once, 'carrot');
    expect(twice).toBe(once);
  });

  it('an unknown crop id is a no-op', () => {
    const s = rich();
    expect(unlockCrop(s, 'nope')).toBe(s);
  });

  it('a crop unlocked via unlockCrop becomes plantable', () => {
    const s = unlockCrop(rich(), 'sapling');
    const planted = plantCrop(s, 'plot-1', 'sapling');
    expect(planted.plots.find((p) => p.id === 'plot-1')!.crop).toBe('sapling');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/engine/crops.test.ts`
Expected: FAIL (`unlockCrop` not exported).

- [ ] **Step 3: Implement unlockCrop (modeled on buildHabitat, not the fish-blind purchaseUpgrade)**

Add to `src/engine/town.ts`. Extend the content import (line 2) to include `CROPS, CROP_UNLOCK_COST`, then append:

```ts
/** True if the crop exists, isn't already unlocked, and every resource component is affordable. */
export function canUnlockCrop(state: GameState, cropId: CropId): boolean {
  if (!CROPS[cropId] || state.unlockedCrops.includes(cropId)) return false;
  const cost = CROP_UNLOCK_COST[cropId];
  if (!cost) return false;
  const r = state.resources;
  return (
    r.gold >= (cost.gold ?? 0) &&
    r.wood >= (cost.wood ?? 0) &&
    r.acorns >= (cost.acorns ?? 0) &&
    r.fish >= (cost.fish ?? 0)
  );
}

/** Pay the unlock cost + append to unlockedCrops. No-op (same ref) if unknown/owned/unaffordable. */
export function unlockCrop(state: GameState, cropId: CropId): GameState {
  if (!canUnlockCrop(state, cropId)) return state;
  const cost = CROP_UNLOCK_COST[cropId];
  return {
    ...state,
    resources: {
      gold: state.resources.gold - (cost.gold ?? 0),
      wood: state.resources.wood - (cost.wood ?? 0),
      acorns: state.resources.acorns - (cost.acorns ?? 0),
      fish: state.resources.fish - (cost.fish ?? 0),
    },
    unlockedCrops: [...state.unlockedCrops, cropId],
  };
}
```

Add `CropId` to the type import at the top of `town.ts` (currently `import type { GameState, Resources, UpgradeId } from './types';`):

```ts
import type { GameState, Resources, UpgradeId, CropId } from './types';
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run test/engine/crops.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/town.ts test/engine/crops.test.ts
git commit -m "feat(plan6): unlockCrop engine action (fish-aware, idempotent)"
```

---

### Task 6: Marigold lake hooks (catch bonus + fish drain)

**Files:**
- Modify: `src/engine/lake.ts`
- Test: `test/engine/lake.test.ts` (add cases)

- [ ] **Step 1: Add failing tests**

Append to `test/engine/lake.test.ts` (inside the file, after the existing `collectCreel` describe). First ensure the import includes the new symbols and helpers — add to the top import from `'../../src/engine'`: `accrueMarigold`, `creelCatchChance`. Then:

```ts
import { accrueMarigold, creelCatchChance } from '../../src/engine';
import { CATCH_CHANCE, MARIGOLD_CATCH_CAP } from '../../src/engine';

function withMarigolds(n: number, fish: number) {
  const base = createInitialState(0);
  const plots = Array.from({ length: n }, (_, i) => ({ id: `m-${i}`, crop: 'marigold' as const }));
  return {
    ...base,
    unlockedCrops: ['wheat', 'marigold'],
    plots: [...base.plots, ...plots],
    resources: { ...base.resources, fish },
  };
}

describe('marigold catch bonus', () => {
  it('is base CATCH_CHANCE with zero marigolds', () => {
    expect(creelCatchChance(createInitialState(0))).toBeCloseTo(CATCH_CHANCE, 5);
  });

  it('adds 0.05 per planted marigold while fish remain', () => {
    expect(creelCatchChance(withMarigolds(2, 100))).toBeCloseTo(CATCH_CHANCE + 0.10, 5);
  });

  it('clamps at MARIGOLD_CATCH_CAP', () => {
    expect(creelCatchChance(withMarigolds(8, 100))).toBe(MARIGOLD_CATCH_CAP);
  });

  it('is dormant (base chance) when the pond is dry', () => {
    expect(creelCatchChance(withMarigolds(3, 0))).toBeCloseTo(CATCH_CHANCE, 5);
  });
});

describe('accrueMarigold', () => {
  it('drains fish over time per planted marigold', () => {
    const s = withMarigolds(2, 100); // 2 * 0.02 = 0.04 fish/s
    const after = accrueMarigold(s, 100); // 4 fish
    expect(after.resources.fish).toBeCloseTo(96, 5);
  });

  it('clamps fish at zero, never negative', () => {
    const s = withMarigolds(2, 1);
    expect(accrueMarigold(s, 10_000).resources.fish).toBe(0);
  });

  it('is a no-op with no marigolds or non-positive elapsed', () => {
    const none = createInitialState(0);
    expect(accrueMarigold(none, 100)).toBe(none);
    const s = withMarigolds(1, 50);
    expect(accrueMarigold(s, 0)).toBe(s);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/engine/lake.test.ts`
Expected: FAIL (`accrueMarigold`/`creelCatchChance` not exported).

- [ ] **Step 3: Implement the lake hooks**

In `src/engine/lake.ts`, extend the content import (line 2) to add `MARIGOLD_CATCH_BONUS, MARIGOLD_CATCH_CAP, MARIGOLD_FISH_PER_SEC`. Add a marigold-count helper + the two functions, and use `creelCatchChance` inside `collectCreel`:

```ts
/** Number of plots currently planted with marigold. */
function marigoldCount(state: GameState): number {
  return state.plots.filter((p) => p.crop === 'marigold').length;
}

/** Effective pet catch chance: base + marigold bonus (only while fish remain), clamped. */
export function creelCatchChance(state: GameState): number {
  const n = marigoldCount(state);
  if (n === 0 || state.resources.fish <= 0) return CATCH_CHANCE;
  return Math.min(CATCH_CHANCE + MARIGOLD_CATCH_BONUS * n, MARIGOLD_CATCH_CAP);
}

/** Drain fish for planted marigolds over elapsedSec, clamped at 0. Immutable. No-op if none/≤0. */
export function accrueMarigold(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const n = marigoldCount(state);
  if (n === 0) return state;
  const drain = MARIGOLD_FISH_PER_SEC * n * elapsedSec;
  const fish = Math.max(0, state.resources.fish - drain);
  if (fish === state.resources.fish) return state;
  return { ...state, resources: { ...state.resources, fish } };
}
```

Change `collectCreel`'s catch line (currently `return rollCatch(banked, CATCH_CHANCE, rng);`) to use the dynamic chance computed from the ORIGINAL state (fish>0 held true because bankFish>0 came from the creel, but the bonus reads `resources.fish`; compute against `banked` so the just-banked fish count is what gates dormancy):

```ts
  return rollCatch(banked, creelCatchChance(banked), rng);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/engine/lake.test.ts`
Expected: PASS (existing creel tests still green — 0 marigolds → base CATCH_CHANCE).

- [ ] **Step 5: Commit**

```bash
git add src/engine/lake.ts test/engine/lake.test.ts
git commit -m "feat(plan6): marigold catch bonus + fish drain (permanent fish sink)"
```

---

### Task 7: Wire fish drain into the idle loop

**Files:**
- Modify: `src/engine/idle.ts`
- Test: `test/engine/idle.test.ts` (add a case)

- [ ] **Step 1: Add a failing test**

Append to `test/engine/idle.test.ts` (add `applyElapsed` and helpers as already imported; check the existing imports and add what's missing):

```ts
import { MARIGOLD_FISH_PER_SEC } from '../../src/engine';

describe('applyElapsed marigold drain', () => {
  it('drains fish for planted marigolds across an offline gap', () => {
    const base = createInitialState(0);
    const s = {
      ...base,
      unlockedCrops: ['wheat', 'marigold'],
      plots: [...base.plots, { id: 'm-0', crop: 'marigold' as const }],
      resources: { ...base.resources, fish: 100 },
      meta: { lastSeen: 0 },
    };
    const after = applyElapsed(s, 100_000); // 100s elapsed → 0.02 * 100 = 2 fish drained
    expect(after.resources.fish).toBeCloseTo(100 - MARIGOLD_FISH_PER_SEC * 100, 3);
  });
});
```

(If `createInitialState`/`applyElapsed` aren't already imported at the top of `idle.test.ts`, add them to the existing `from '../../src/engine'` import.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/engine/idle.test.ts -t "drains fish for planted marigolds"`
Expected: FAIL (drain not wired; fish stays 100).

- [ ] **Step 3: Wire accrueMarigold into applyElapsed**

In `src/engine/idle.ts`, add the import and one accrue line. Change the import from `'./lake'`:

```ts
import { accrueCreel, accrueMarigold } from './lake';
```

Add after the `accrueCreel` line:

```ts
  next = accrueCreel(next, elapsedSec);
  next = accrueMarigold(next, elapsedSec);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/engine/idle.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/engine/idle.ts test/engine/idle.test.ts
git commit -m "feat(plan6): wire marigold fish drain into applyElapsed"
```

---

### Task 8: Save v4 → v5 migration + widened validator

**Files:**
- Modify: `src/persistence/save.ts`
- Test: `test/persistence/save.test.ts` (rewrite affected assertions + add v4→v5 case)

- [ ] **Step 1: Bump version, widen validator, add migration**

In `src/persistence/save.ts`:

Change `export const SAVE_VERSION = 4;` → `= 5;`.

Replace `isValidBaseState` (widen — accept BOTH old `{amount}` and new bucket shapes; never require `unlockedCrops`):

```ts
/** Validates fields common to every version. Runs PRE-migration, so it must accept old shapes:
 *  a v4 save has storage.barn = {amount}; do NOT assert the new bucket shape or unlockedCrops
 *  (migrate() backfills those). Asserting the new shape here would fail every real v4 save and
 *  silently wipe it. */
function isValidBaseState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.plots) || !Array.isArray(s.villagers)) return false;
  if (!s.resources || typeof s.resources !== 'object') return false;
  if (!s.meta || typeof s.meta !== 'object') return false;
  const storage = s.storage as { barn?: unknown } | undefined;
  if (!storage || typeof storage !== 'object') return false;
  if (!storage.barn || typeof storage.barn !== 'object') return false; // shape checked by migrate
  return true;
}
```

Extend `migrate` to run the v5 step last, and add the migration function. Change the `migrate` body:

```ts
/** Additive migrations. v1(farm)->v2(forest)->v3(town)->v4(lake)->v5(crops). Idempotent. */
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);
  if (fromVersion < 3) s = { ...s, upgrades: s.upgrades ?? {} };
  if (fromVersion < 4) s = addLakeFields(s);
  if (fromVersion < 5) s = addCropRework(s);
  return s;
}

/** v4->v5: barn {amount} -> {gold,wood,acorns}; seed unlockedCrops; clear removed crop ids. */
function addCropRework(old: GameState): GameState {
  const oldBarn = old.storage.barn as unknown as { amount?: number; gold?: number; wood?: number; acorns?: number };
  const barn = typeof oldBarn.amount === 'number'
    ? { gold: oldBarn.amount, wood: 0, acorns: 0 }                 // old shape → gold bucket
    : { gold: oldBarn.gold ?? 0, wood: oldBarn.wood ?? 0, acorns: oldBarn.acorns ?? 0 }; // already migrated

  const validId = (id: string | null): id is string => id !== null && CROP_IDS.includes(id);
  // Clear any plot holding a crop id that no longer exists in the roster.
  const plots = old.plots.map((p) => (validId(p.crop) ? p : { ...p, crop: null }));
  // Seed unlockedCrops with wheat + any still-valid planted crop (so planted crops stay usable).
  const seeded = old.unlockedCrops ?? [...STARTER_CROPS];
  const fromPlots = plots.map((p) => p.crop).filter(validId);
  const unlockedCrops = Array.from(new Set([...seeded, ...STARTER_CROPS, ...fromPlots]));

  return { ...old, storage: { ...old.storage, barn }, plots, unlockedCrops };
}
```

Add `CROP_IDS, STARTER_CROPS` to the content import at the top:

```ts
import { DUNGEONS, STARTER_SPECIES, HABITATS, CROP_IDS, STARTER_CROPS } from '../engine/content';
```

- [ ] **Step 2: Rewrite the broken save tests + add the v4→v5 case**

In `test/persistence/save.test.ts`:

(a) The strict-import round-trip (`resources: { gold: 7, ... }`) still works — leave it.

(b) `serialize / deserialize` block — the round-trip plants `'berry'` (removed). Change line 22 crop to `'carrot'` and unlock it first; and the barn-amount assertions:

```ts
  it('round-trips a game state', () => {
    const base = createInitialState(1234);
    const s0 = plantCrop({ ...base, unlockedCrops: ['wheat', 'carrot'] }, 'plot-1', 'carrot');
    const restored = deserialize(serialize(s0));
    expect(restored).toEqual(s0);
  });
```

Change the two `expect(restored.storage.barn.amount).toBe(0);` assertions (corrupt-blob + wrong-shape tests) to:

```ts
    expect(restored.storage.barn).toEqual({ gold: 0, wood: 0, acorns: 0 });
```

(c) `v1 -> v2 migration` block — the v1 envelope has `storage: { barn: { amount: 40 } }`. After chaining to v5 the barn becomes buckets. Change the assertion `expect(s.storage.barn.amount).toBe(40);` to:

```ts
    expect(s.storage.barn).toEqual({ gold: 40, wood: 0, acorns: 0 }); // amount preserved as gold bucket
```

And in the "leaves a current save untouched" test, the `v2` fixture plants `'berry'` and asserts `SAVE_VERSION === 4`. Change to a valid crop + version 5:

```ts
  it('leaves a current save untouched', () => {
    const v2 = serialize(createInitialState(1));
    expect(JSON.parse(v2).version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(5);
    const restored = deserialize(v2);
    expect(restored.creatures).toHaveLength(2);
    expect(Object.keys(SPECIES).length).toBeGreaterThanOrEqual(10);
  });
```

(d) Add a dedicated v4→v5 describe block at the end of the file:

```ts
describe('v4 -> v5 migration (crop rework)', () => {
  it('maps barn.amount to the gold bucket, seeds unlockedCrops, clears removed crop ids', () => {
    const v4Envelope = JSON.stringify({
      version: 4,
      state: {
        resources: { gold: 5, wood: 0, acorns: 0, fish: 2 },
        plots: [
          { id: 'plot-1', crop: 'berry' },  // removed id → cleared
          { id: 'plot-2', crop: 'wheat' },  // valid → kept + unlocked
          { id: 'plot-3', crop: null },
        ],
        villagers: [{ id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: 'farm' }],
        storage: { barn: { amount: 40 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
        creatures: [], dungeons: [], discovered: [], upgrades: {}, habitats: [], pets: [],
        meta: { lastSeen: 9 },
      },
    });
    const s = deserialize(v4Envelope);
    expect(s.storage.barn).toEqual({ gold: 40, wood: 0, acorns: 0 });
    expect(s.plots.find((p) => p.id === 'plot-1')!.crop).toBeNull(); // berry cleared
    expect(s.plots.find((p) => p.id === 'plot-2')!.crop).toBe('wheat');
    expect(s.unlockedCrops).toContain('wheat');
    expect(s.unlockedCrops).not.toContain('berry');
  });

  it('a real v4 save survives BOTH deserialize and tryDeserialize (no silent wipe / no reject)', () => {
    const v4 = JSON.stringify({
      version: 4,
      state: {
        resources: { gold: 77, wood: 1, acorns: 2, fish: 3 },
        plots: [{ id: 'plot-1', crop: null }, { id: 'plot-2', crop: null }, { id: 'plot-3', crop: null }],
        villagers: [{ id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: null }],
        storage: { barn: { amount: 12 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
        creatures: [], dungeons: [], discovered: [], upgrades: {}, habitats: [], pets: [],
        meta: { lastSeen: 0 },
      },
    });
    const viaLoad = deserialize(v4);
    expect(viaLoad.resources.gold).toBe(77);          // NOT wiped to a fresh state
    expect(viaLoad.storage.barn.gold).toBe(12);
    const viaImport = tryDeserialize(v4);
    expect(viaImport).not.toBeNull();                  // NOT rejected
    expect(viaImport!.resources.gold).toBe(77);
  });
});
```

- [ ] **Step 3: Run the save tests**

Run: `npx vitest run test/persistence/save.test.ts`
Expected: PASS (all).

- [ ] **Step 4: Commit**

```bash
git add src/persistence/save.ts test/persistence/save.test.ts
git commit -m "feat(plan6): save v5 crop-rework migration + widened validator (no save wipe)"
```

---

### Task 9: Store action for unlockCrop

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Add the action**

In `src/store/gameStore.ts`:

Add `unlockCrop` to the engine import block (after `plantCrop,`):

```ts
  unlockCrop,
```

Add to the `GameStore` interface (after the `plant` line):

```ts
  unlockCrop: (cropId: CropId) => void;
```

Add the action implementation (after the `plant:` action, ~line 106):

```ts
    unlockCrop: (cropId) => commit(unlockCrop(applyElapsed(get().state, Date.now()), cropId)),
```

- [ ] **Step 2: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat(plan6): store unlockCrop action"
```

---

### Task 10: BarnCard multi-resource UI

**Files:**
- Modify: `src/ui/components/BarnCard.tsx`

- [ ] **Step 1: Rewrite BarnCard for per-resource buckets**

Replace `src/ui/components/BarnCard.tsx` with (keeps the stable `s => s.state` selector — never build a fresh object in the selector):

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { barnCap } from '../../engine';
import type { BarnResource } from '../../engine';

const LABEL: Record<BarnResource, { emoji: string; name: string }> = {
  gold: { emoji: '🪙', name: 'gold' },
  wood: { emoji: '🪵', name: 'wood' },
  acorns: { emoji: '🌰', name: 'acorns' },
};
const ORDER: BarnResource[] = ['gold', 'wood', 'acorns'];

export function BarnCard() {
  const state = useGameStore((s) => s.state);       // stable ref — selector-cache safe
  const collect = useGameStore((s) => s.collect);
  const barn = state.storage.barn;
  const cap = barnCap(state);
  const totalWhole = ORDER.reduce((sum, r) => sum + Math.floor(barn[r]), 0);
  const active = ORDER.filter((r) => cap[r] > 0 || barn[r] > 0);

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>🛖 Barn</Text>
        <Pressable
          style={[styles.btn, totalWhole === 0 && styles.btnDisabled]}
          disabled={totalWhole === 0}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect</Text>
        </Pressable>
      </View>
      {active.length === 0 ? (
        <Text style={cards.sub}>Plant a crop and assign a villager to fill the barn.</Text>
      ) : (
        active.map((r) => {
          const amount = Math.floor(barn[r]);
          const pct = cap[r] > 0 ? Math.min(100, Math.round((barn[r] / cap[r]) * 100)) : 0;
          return (
            <View key={r} style={styles.row}>
              <Text style={cards.sub}>{LABEL[r].emoji} {amount} / {cap[r]} {LABEL[r].name}</Text>
              <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { marginTop: 6 },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 4 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/BarnCard.tsx
git commit -m "feat(plan6): multi-resource BarnCard (per-bucket meters, cache-safe selector)"
```

---

### Task 11: PlotGrid — crop kind, lock badges, unlock flow

**Files:**
- Modify: `src/ui/components/PlotGrid.tsx`

- [ ] **Step 1: Rewrite the crop-picker rows + unlock handling**

In `src/ui/components/PlotGrid.tsx`:

Extend imports:

```ts
import { CROPS, CROP_IDS, CROP_UNLOCK_COST } from '../../engine';
import type { CropId, Resources } from '../../engine';
```

Add store hooks + an unlock handler inside the component (after the existing `plant`/`picking` lines):

```ts
  const unlocked = useGameStore((s) => s.state.unlockedCrops);
  const resources = useGameStore((s) => s.state.resources);
  const unlock = useGameStore((s) => s.unlockCrop);

  const canAfford = (cropId: CropId) => {
    const cost = CROP_UNLOCK_COST[cropId];
    if (!cost) return false;
    return (Object.keys(cost) as (keyof Resources)[]).every((k) => resources[k] >= (cost[k] ?? 0));
  };
  const costLabel = (cropId: CropId) => {
    const cost = CROP_UNLOCK_COST[cropId] ?? {};
    const glyph: Record<string, string> = { gold: '🪙', wood: '🪵', acorns: '🌰', fish: '🐟' };
    return (Object.keys(cost) as (keyof Resources)[]).map((k) => `${cost[k]}${glyph[k]}`).join(' ');
  };
```

Replace the crop-row map (the `CROP_IDS.map((id) => { const c = CROPS[id]; return (...) })` block, lines ~57-66) with a version that branches on lock state and `kind`:

```tsx
              {CROP_IDS.map((id) => {
                const c = CROPS[id];
                const isUnlocked = unlocked.includes(id);
                const meta = c.kind === 'producer'
                  ? `${fmt(c.growSec)} · ${c.amount}${c.output === 'gold' ? 'g' : c.output === 'wood' ? '🪵' : '🌰'}`
                  : 'pet luck · drains 🐟';
                if (isUnlocked) {
                  return (
                    <Pressable key={id} style={styles.cropRow} onPress={() => choose(id)}>
                      <Text style={styles.cropEmoji}>{c.emoji}</Text>
                      <Text style={styles.cropName}>{c.name}</Text>
                      <Text style={styles.cropMeta}>{meta}</Text>
                    </Pressable>
                  );
                }
                const affordable = canAfford(id);
                return (
                  <Pressable
                    key={id}
                    style={[styles.cropRow, styles.lockedRow, !affordable && styles.btnDisabled]}
                    disabled={!affordable}
                    onPress={() => { unlock(id); }}
                  >
                    <Text style={styles.cropEmoji}>🔒</Text>
                    <Text style={styles.cropName}>{c.emoji} {c.name}</Text>
                    <Text style={styles.cropMeta}>unlock {costLabel(id)}</Text>
                  </Pressable>
                );
              })}
```

Add styles `lockedRow` and `btnDisabled` to the StyleSheet:

```ts
  lockedRow: { borderWidth: 1, borderColor: theme.accent },
  btnDisabled: { opacity: 0.4 },
```

Note: tapping an unlocked crop plants it (closes the sheet via `choose`); tapping a locked+affordable crop spends resources and unlocks it in place (the sheet stays open so the player can then tap it again to plant). This is intentional.

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/PlotGrid.tsx
git commit -m "feat(plan6): PlotGrid crop kind display + lock badges + in-sheet unlock"
```

---

### Task 12: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Whole-project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If any remain, they are edit-sites this plan touched — fix them against the types in Task 1 (common culprits: a `.gold`/`.growSec` access not narrowed on the `Crop` union, or a `barn.amount` reference). Re-run until clean.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all files PASS (farm, crops, lake, idle, save, town, creatures, forest).

- [ ] **Step 3: Lint any leftover references**

Run: `grep -rn "barn.amount\|farmRatePerSec\b\|\.gold *=" src app 2>/dev/null || true`
Expected: no `barn.amount` in `src`/`app`; no `farmRatePerSec` (singular) callers remain. (Matches inside `test/` for historical migration fixtures are fine.)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(plan6): tsc + full suite green"
```

---

## Manual QA checklist (live browser, after Task 12)

Run `npm run dev` (or `dev:poll` under VSCodium) and hard-reload every tab:

- [ ] Farm tab: only wheat is plantable at start; carrot/sapling/marigold show 🔒 + unlock cost.
- [ ] Earn 50 gold, open picker, unlock carrot in-sheet, then plant it; barn shows an 🌰 acorns meter filling.
- [ ] Plant wheat + carrot + sapling on separate plots with a villager assigned; barn shows 3 separate meters (gold/wood/acorns), Collect banks all three.
- [ ] Buy Farm Expansion up to 5 levels → 8 plots total.
- [ ] Unlock marigold (150 gold + 40 fish); plant it; confirm creel catches feel more frequent while fish > 0; let fish hit 0 and confirm marigold goes dormant.
- [ ] Import an old (pre-update) save via Settings → it loads without wiping (gold preserved, any `berry` plot cleared).
- [ ] Anti-dominance sanity (Goal 1 QA gate): at an early, mid, and late save, confirm no single crop is the right choice for all 8 plots — gold buys upgrades but not XP/pets; acorns/marigold are needed for creatures/pets. If wheat still dominates everywhere, RETUNE before merge.

---

## Self-review notes

- **Spec coverage:** Decision 1 (typed outputs) → Tasks 1,2,4. Decision 2 (marigold) → Tasks 2,6,7. Decision 3 (unlock gating) → Tasks 2,4(plant guard),5. Decision 4 (maxLevel 5) → Task 2. Barn reshape → Tasks 1,3,4,10. Save C1/C2 → Task 8. Selector rule (M5) → Task 10. createInitialState (H4) → Task 3. unlockCrop fish-aware (M1) → Task 5. kind guards (M2) → Task 4 (`crop.kind !== 'producer'`). Cap reachable (M3) → Task 2 (0.50) + Task 6 test. Dead fish bucket (M4) → barn is gold/wood/acorns only (Task 1). Anti-dominance QA gate (H2) → Manual QA checklist.
- **Type consistency:** `farmRatesPerSec` (plural) used in farm.ts + tests + BarnCard via `barnCap`. `creelCatchChance` + `accrueMarigold` names consistent across lake.ts, idle.ts, tests. `BarnResource` used in types/farm/BarnCard. `unlockCrop`/`canUnlockCrop` consistent.
- **Placeholder scan:** none — every code step has full code.
