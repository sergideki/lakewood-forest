# Plan 7 — Cozy Loops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three interlocking cozy features to Lakewood — a "While You Were Away" summary card, permanent per-pet passive bonuses, and a repeatable wood→fish Town trade — with NO save-version bump.

**Architecture:** Pure engine layer first (new `src/engine/pets.ts`, new constants, new trade fn), each wired into existing rate/cap/chance functions; a pure `src/lib/awayReport.ts` diff over the load-time `applyElapsed`; then store + UI. Every feature derives from already-persisted state (`state.pets`) or touches only `resources`, so `SAVE_VERSION` stays 5 with no migration.

**Tech Stack:** TypeScript, React Native (Expo Router), Zustand, Vitest. Pure engine funcs are immutable (same ref on no-op), deterministic (no new rng), clock-safe.

Spec: `docs/superpowers/specs/2026-07-05-lakewood-plan7-cozy-loops-design.md`. Baseline: `main` green, 155/155 vitest, tsc clean.

---

## Task 1: Content — pet effects + trade constants

**Files:**
- Modify: `src/engine/content.ts` (append after the `CATCH_CHANCE` line, ~line 95)

- [ ] **Step 1: Add PET_EFFECTS + trade constants**

Append to `src/engine/content.ts`:

```ts
// --- Plan 7: pet passive bonuses (derived from state.pets; no save fields) ---
export type PetLever = 'barnCap' | 'satchelCap' | 'creelCap' | 'forageRate' | 'farmRate' | 'catchChance';
export interface PetEffect { lever: PetLever; amount: number; }

/** Each caught pet grants one small permanent global buff. Each touches a DIFFERENT lever so
 *  completing the 6-set rewards every subsystem. Additive; a pet is caught at most once. */
export const PET_EFFECTS: Record<PetId, PetEffect> = {
  pondsnail:    { lever: 'barnCap',     amount: 0.05 },
  waterbeetle:  { lever: 'satchelCap',  amount: 0.05 },
  dragonfly:    { lever: 'forageRate',  amount: 0.08 },
  pebbleturtle: { lever: 'creelCap',    amount: 0.08 },
  crawdad:      { lever: 'farmRate',    amount: 0.10 },
  pondnewt:     { lever: 'catchChance', amount: 0.03 },
};

// --- Plan 7: repeatable wood -> fish Town trade (infinite wood sink; revives sapling) ---
export const TRADE_WOOD_COST = 20; // 🪵 spent per trade
export const TRADE_FISH_YIELD = 4; // 🐟 gained per trade (5:1)
```

- [ ] **Step 2: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean (no usages yet, just declarations).

- [ ] **Step 3: Commit**

```bash
git add src/engine/content.ts
git commit -m "feat(content): Plan 7 pet effects + wood-fish trade constants"
```

---

## Task 2: Pure `src/engine/pets.ts` — bonus summing

**Files:**
- Create: `src/engine/pets.ts`
- Modify: `src/engine/index.ts` (add export)
- Test: `test/engine/pets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/engine/pets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { petLeverMult, petCatchBonus } from '../../src/engine/pets';
import type { GameState } from '../../src/engine/types';

function withPets(...ids: string[]): GameState {
  return { ...createInitialState(0), pets: ids };
}

describe('pet bonuses', () => {
  it('no pets → every lever mult is exactly 1 and catch bonus is 0', () => {
    const s = withPets();
    for (const lever of ['barnCap', 'satchelCap', 'creelCap', 'forageRate', 'farmRate'] as const) {
      expect(petLeverMult(s, lever)).toBe(1);
    }
    expect(petCatchBonus(s)).toBe(0);
  });

  it('a single pet affects only its own lever', () => {
    const s = withPets('pondsnail'); // barnCap +0.05
    expect(petLeverMult(s, 'barnCap')).toBeCloseTo(1.05, 10);
    expect(petLeverMult(s, 'satchelCap')).toBe(1);
    expect(petCatchBonus(s)).toBe(0);
  });

  it('catchChance pet returns an additive bonus, not a lever mult', () => {
    const s = withPets('pondnewt'); // catchChance +0.03
    expect(petCatchBonus(s)).toBeCloseTo(0.03, 10);
  });

  it('full set → each lever reflects exactly its one pet, catch bonus is 0.03', () => {
    const s = withPets('pondsnail', 'waterbeetle', 'dragonfly', 'pebbleturtle', 'crawdad', 'pondnewt');
    expect(petLeverMult(s, 'barnCap')).toBeCloseTo(1.05, 10);
    expect(petLeverMult(s, 'satchelCap')).toBeCloseTo(1.05, 10);
    expect(petLeverMult(s, 'forageRate')).toBeCloseTo(1.08, 10);
    expect(petLeverMult(s, 'creelCap')).toBeCloseTo(1.08, 10);
    expect(petLeverMult(s, 'farmRate')).toBeCloseTo(1.10, 10);
    expect(petCatchBonus(s)).toBeCloseTo(0.03, 10);
  });

  it('unknown pet ids are ignored', () => {
    const s = withPets('not-a-pet', 'pondsnail');
    expect(petLeverMult(s, 'barnCap')).toBeCloseTo(1.05, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/pets.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/pets`.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/pets.ts`:

```ts
import type { GameState, PetId } from './types';
import { PET_EFFECTS, PetLever } from './content';

/** Sum the `amount` of every caught pet whose effect targets `lever`. Unknown ids ignored. */
function sumFor(state: GameState, lever: PetLever): number {
  let sum = 0;
  for (const id of state.pets) {
    const eff = PET_EFFECTS[id as PetId];
    if (eff && eff.lever === lever) sum += eff.amount;
  }
  return sum;
}

/** Multiplier (≥1) for a rate/cap lever from the caught pet set: 1 + Σamount. */
export function petLeverMult(state: GameState, lever: Exclude<PetLever, 'catchChance'>): number {
  return 1 + sumFor(state, lever);
}

/** Additive catch-chance bonus (≥0) from the caught pet set. */
export function petCatchBonus(state: GameState): number {
  return sumFor(state, 'catchChance');
}
```

- [ ] **Step 4: Add export**

In `src/engine/index.ts`, add after the `./lake` line:

```ts
export * from './pets';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/engine/pets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/pets.ts src/engine/index.ts test/engine/pets.test.ts
git commit -m "feat(engine): pure pet-bonus summing (petLeverMult, petCatchBonus)"
```

---

## Task 3: Wire pet mults into town.ts (barn/satchel/forage)

**Files:**
- Modify: `src/engine/town.ts:64-74`
- Test: `test/engine/town.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `test/engine/town.test.ts` (add `barnCapMult, satchelCapMult, forageMult` are already imported):

```ts
describe('pet bonuses feed town mults', () => {
  it('pondsnail lifts barnCapMult by 5%', () => {
    const base = createInitialState(0);
    expect(barnCapMult({ ...base, pets: ['pondsnail'] })).toBeCloseTo(1.05, 10);
    expect(barnCapMult(base)).toBe(1); // no-pet unchanged
  });
  it('waterbeetle lifts satchelCapMult, dragonfly lifts forageMult', () => {
    const base = createInitialState(0);
    expect(satchelCapMult({ ...base, pets: ['waterbeetle'] })).toBeCloseTo(1.05, 10);
    expect(forageMult({ ...base, pets: ['dragonfly'] })).toBeCloseTo(1.08, 10);
  });
  it('pet mult composes multiplicatively with an upgrade level', () => {
    const base = createInitialState(0);
    const s = { ...base, pets: ['pondsnail'], upgrades: { 'barn-silo': 2 } }; // (1+0.5*2)*1.05
    expect(barnCapMult(s)).toBeCloseTo(2 * 1.05, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/town.test.ts -t "pet bonuses feed town mults"`
Expected: FAIL — mults ignore pets (return 1 / 1.5 / etc.).

- [ ] **Step 3: Write implementation**

In `src/engine/town.ts`, add the import at the top (after the existing `./content` import line 2):

```ts
import { petLeverMult } from './pets';
```

Replace the three mult functions (lines 64-74):

```ts
export function barnCapMult(state: GameState): number {
  return (1 + 0.5 * upgradeLevel(state, 'barn-silo')) * petLeverMult(state, 'barnCap');
}

export function satchelCapMult(state: GameState): number {
  return (1 + 0.5 * upgradeLevel(state, 'satchel-stitch')) * petLeverMult(state, 'satchelCap');
}

export function forageMult(state: GameState): number {
  return (1 + 0.15 * upgradeLevel(state, 'forage-tools')) * petLeverMult(state, 'forageRate');
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run test/engine/town.test.ts`
Expected: PASS — new block passes AND all existing town tests still pass (they run on zero-pet `createInitialState`, where `petLeverMult` returns exactly 1).

- [ ] **Step 5: Commit**

```bash
git add src/engine/town.ts test/engine/town.test.ts
git commit -m "feat(engine): pets feed barn/satchel/forage mults"
```

---

## Task 4: Wire pet creelCap + catchChance into lake.ts

**Files:**
- Modify: `src/engine/lake.ts:22-25` (creelCap) and `:62-67` (creelCatchChance)
- Test: `test/engine/lake.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `test/engine/lake.test.ts` (import `creelCap, creelCatchChance` from `../../src/engine/lake` if not already; add `pets` field via spread):

```ts
import { creelCap, creelCatchChance } from '../../src/engine/lake';
import { createInitialState } from '../../src/engine';

describe('pet bonuses feed lake', () => {
  it('pebbleturtle lifts creel cap by 8% (re-rounded)', () => {
    const base = createInitialState(0);
    const capBase = creelCap(base);            // floor 200 at zero rate
    const capPet = creelCap({ ...base, pets: ['pebbleturtle'] });
    expect(capPet).toBe(Math.round(capBase * 1.08));
  });
  it('pondnewt adds +3% catch chance, applied AFTER the marigold clamp', () => {
    const base = createInitialState(0);
    // no marigold → base 0.25 + 0.03
    expect(creelCatchChance({ ...base, pets: ['pondnewt'] })).toBeCloseTo(0.28, 10);
  });
  it('pondnewt bonus survives even at the marigold cap (0.50 + 0.03)', () => {
    const base = createInitialState(0);
    // 5 marigold plots + fish in the pond → marigold term clamps to 0.50, pet adds on top
    const plots = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, crop: 'marigold' }));
    const s = { ...base, plots, resources: { ...base.resources, fish: 100 }, pets: ['pondnewt'] };
    expect(creelCatchChance(s)).toBeCloseTo(0.53, 10);
  });
  it('no-pet catch chance is unchanged (0.25 base)', () => {
    expect(creelCatchChance(createInitialState(0))).toBe(0.25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/lake.test.ts -t "pet bonuses feed lake"`
Expected: FAIL — creelCap ignores pets; catch chance has no pet term.

- [ ] **Step 3: Write implementation**

In `src/engine/lake.ts`, add to the `./pets` import (create the import near the top, after the `./forest` import line 15):

```ts
import { petLeverMult, petCatchBonus } from './pets';
```

Replace `creelCap` (lines 22-25):

```ts
/** Creel capacity = a day of the current fish rate, floored, then lifted by pet creel bonus. */
export function creelCap(state: GameState): number {
  const base = Math.max(CREEL_FLOOR, Math.round(fishRatePerSec(state) * CREEL_HOURS * 3600));
  return Math.round(base * petLeverMult(state, 'creelCap'));
}
```

Replace `creelCatchChance` (lines 62-67):

```ts
/** Effective pet catch chance: marigold-clamped base, THEN pet catch bonus on top, capped at 1.
 *  Pet bonus is applied AFTER the marigold clamp so a rare-caught Pond Newt is never swallowed by
 *  MARIGOLD_CATCH_CAP (skeptic F1). */
export function creelCatchChance(state: GameState): number {
  const n = marigoldCount(state);
  const marigoldChance = n === 0 || state.resources.fish <= 0
    ? CATCH_CHANCE
    : Math.min(CATCH_CHANCE + MARIGOLD_CATCH_BONUS * n, MARIGOLD_CATCH_CAP);
  return Math.min(1, marigoldChance + petCatchBonus(state));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run test/engine/lake.test.ts`
Expected: PASS — new block + all existing lake tests (zero-pet paths unchanged: `petLeverMult`→1, `petCatchBonus`→0, so `creelCap` re-rounds ×1 and catch chance is byte-identical).

- [ ] **Step 5: Commit**

```bash
git add src/engine/lake.ts test/engine/lake.test.ts
git commit -m "feat(engine): pets feed creel cap + catch chance (bonus post-clamp)"
```

---

## Task 5: Wire pet farmRate into farm.ts

**Files:**
- Modify: `src/engine/farm.ts:17-29` (farmRatesPerSec)
- Test: `test/engine/farm.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `test/engine/farm.test.ts` (import `farmRatesPerSec` from `../../src/engine/farm`, `createInitialState`, `plantCrop`, `assignVillager` as needed):

```ts
describe('crawdad lifts farm rate', () => {
  it('scales every producer rate by +10%', () => {
    let s = createInitialState(0);
    s = assignVillager(s, 'vil-1', 'farm');
    s = plantCrop({ ...s, unlockedCrops: ['wheat'] }, 'plot-1', 'wheat');
    const rateBase = farmRatesPerSec(s).gold;
    const ratePet = farmRatesPerSec({ ...s, pets: ['crawdad'] }).gold;
    expect(ratePet).toBeCloseTo(rateBase * 1.10, 10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/farm.test.ts -t "crawdad lifts farm rate"`
Expected: FAIL — farm rate ignores pets.

- [ ] **Step 3: Write implementation**

In `src/engine/farm.ts`, add import (after `./town` import line 3):

```ts
import { petLeverMult } from './pets';
```

In `farmRatesPerSec` (lines 17-29), apply the pet factor to the multiplier. Change:

```ts
  const multiplier = 1 + 0.25 * (assigned - 1);
```
to:
```ts
  const multiplier = (1 + 0.25 * (assigned - 1)) * petLeverMult(state, 'farmRate');
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run test/engine/farm.test.ts`
Expected: PASS — new test + all existing farm tests (zero-pet → ×1, byte-identical; barnCap derives from rate so it also stays identical at zero pets).

- [ ] **Step 5: Commit**

```bash
git add src/engine/farm.ts test/engine/farm.test.ts
git commit -m "feat(engine): crawdad pet lifts farm production rate"
```

---

## Task 6: Wood→fish Town trade (pure engine)

**Files:**
- Modify: `src/engine/town.ts` (append after `unlockCrop`, ~line 104)
- Test: `test/engine/town.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `test/engine/town.test.ts` (import `canTradeWoodForFish, tradeWoodForFish` from `../../src/engine/town`):

```ts
describe('wood -> fish trade', () => {
  it('affordable trade deducts 20 wood and adds 4 fish', () => {
    const s = { ...createInitialState(0), resources: { gold: 0, wood: 50, acorns: 0, fish: 0 } };
    expect(canTradeWoodForFish(s)).toBe(true);
    const t = tradeWoodForFish(s);
    expect(t.resources.wood).toBe(30);
    expect(t.resources.fish).toBe(4);
  });
  it('unaffordable trade is a no-op (same ref)', () => {
    const s = { ...createInitialState(0), resources: { gold: 0, wood: 19, acorns: 0, fish: 0 } };
    expect(canTradeWoodForFish(s)).toBe(false);
    expect(tradeWoodForFish(s)).toBe(s);
  });
  it('is repeatable (two trades = -40 wood / +8 fish)', () => {
    let s = { ...createInitialState(0), resources: { gold: 0, wood: 100, acorns: 0, fish: 0 } };
    s = tradeWoodForFish(tradeWoodForFish(s));
    expect(s.resources.wood).toBe(60);
    expect(s.resources.fish).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/town.test.ts -t "wood -> fish trade"`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write implementation**

Add the import to the existing `./content` import in `src/engine/town.ts` (line 2) so it also pulls `TRADE_WOOD_COST, TRADE_FISH_YIELD`. Then append:

```ts
/** True when the player can afford one wood→fish trade. */
export function canTradeWoodForFish(state: GameState): boolean {
  return state.resources.wood >= TRADE_WOOD_COST;
}

/** Spend TRADE_WOOD_COST wood for TRADE_FISH_YIELD fish. No-op (same ref) if unaffordable.
 *  The recurring wood SINK that revives sapling; touches only resources → save-safe. */
export function tradeWoodForFish(state: GameState): GameState {
  if (!canTradeWoodForFish(state)) return state;
  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - TRADE_WOOD_COST,
      fish: state.resources.fish + TRADE_FISH_YIELD,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run test/engine/town.test.ts`
Expected: PASS (all town tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/town.ts test/engine/town.test.ts
git commit -m "feat(engine): repeatable wood->fish trade (infinite wood sink)"
```

---

## Task 7: Pure `src/lib/awayReport.ts` — offline diff

**Files:**
- Create: `src/lib/awayReport.ts`
- Test: `test/lib/awayReport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/lib/awayReport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, applyElapsed } from '../../src/engine';
import { computeAwayReport, AWAY_MIN_SEC } from '../../src/lib/awayReport';
import type { GameState } from '../../src/engine/types';

/** A state with one farm villager + a wheat plot so applyElapsed accrues gold in the barn. */
function producing(lastSeen: number): GameState {
  const base = createInitialState(lastSeen);
  return {
    ...base,
    unlockedCrops: ['wheat'],
    villagers: base.villagers.map((v) => (v.id === 'vil-1' ? { ...v, assignedTo: 'farm' } : v)),
    plots: base.plots.map((p) => (p.id === 'plot-1' ? { ...p, crop: 'wheat' } : p)),
  };
}

describe('computeAwayReport', () => {
  it('returns null below the minimum away threshold', () => {
    const before = producing(0);
    const after = applyElapsed(before, (AWAY_MIN_SEC - 1) * 1000);
    expect(computeAwayReport(before, after, (AWAY_MIN_SEC - 1) * 1000)).toBeNull();
  });

  it('reports barn gains after a real gap', () => {
    const before = producing(0);
    const now = 3600 * 1000; // 1 hour
    const after = applyElapsed(before, now);
    const r = computeAwayReport(before, after, now);
    expect(r).not.toBeNull();
    expect(r!.elapsedSec).toBeCloseTo(3600, 5);
    expect(r!.barn.gold).toBeGreaterThan(0);
  });

  it('elapsedSec uses BEFORE.meta.lastSeen, not after (which applyElapsed advances to now)', () => {
    const before = producing(1000);
    const now = 1000 + 3600 * 1000;
    const after = applyElapsed(before, now);
    // after.meta.lastSeen === now; if the impl used it, elapsed would be 0.
    expect(computeAwayReport(before, after, now)!.elapsedSec).toBeCloseTo(3600, 5);
  });

  it('reports marigold fish drain as a positive number', () => {
    const base = createInitialState(0);
    const before: GameState = {
      ...base,
      plots: [{ id: 'plot-1', crop: 'marigold' }],
      resources: { ...base.resources, fish: 100 },
    };
    const now = 3600 * 1000;
    const after = applyElapsed(before, now);
    const r = computeAwayReport(before, after, now)!;
    expect(r.marigoldFishDrained).toBeGreaterThan(0);
    expect(r.marigoldFishDrained).toBeCloseTo(before.resources.fish - after.resources.fish, 5);
  });

  it('returns null when nothing changed and no run is newly ready', () => {
    const before = createInitialState(0); // no villager assigned → no production
    const now = 3600 * 1000;
    const after = applyElapsed(before, now);
    expect(computeAwayReport(before, after, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/lib/awayReport.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/awayReport`.

- [ ] **Step 3: Write implementation**

Create `src/lib/awayReport.ts`:

```ts
import type { GameState } from '../engine/types';
import { isRunReady } from '../engine/forest';
import { habitatStatus } from '../engine/lake';

export const AWAY_MIN_SEC = 60;

export interface AwayReport {
  elapsedSec: number;
  barn: { gold: number; wood: number; acorns: number };
  satchel: { wood: number; acorn: number };
  creel: { fish: number };
  marigoldFishDrained: number;
  readyDungeons: string[];
  readyHabitats: string[];
}

const pos = (x: number): number => (x > 0 ? x : 0);

/** Diff the load-time applyElapsed gap into a cozy summary. Returns null when the gap is under
 *  AWAY_MIN_SEC or nothing meaningful happened. elapsedSec is measured from BEFORE.meta.lastSeen
 *  (applyElapsed advances after.meta.lastSeen to `now`, so it must NOT be the source). */
export function computeAwayReport(before: GameState, after: GameState, now: number): AwayReport | null {
  const elapsedSec = Math.max(0, (now - before.meta.lastSeen) / 1000);
  if (elapsedSec < AWAY_MIN_SEC) return null;

  const barn = {
    gold: pos(after.storage.barn.gold - before.storage.barn.gold),
    wood: pos(after.storage.barn.wood - before.storage.barn.wood),
    acorns: pos(after.storage.barn.acorns - before.storage.barn.acorns),
  };
  const satchel = {
    wood: pos(after.storage.satchel.wood - before.storage.satchel.wood),
    acorn: pos(after.storage.satchel.acorn - before.storage.satchel.acorn),
  };
  const creel = { fish: pos(after.storage.creel.fish - before.storage.creel.fish) };
  const marigoldFishDrained = pos(before.resources.fish - after.resources.fish);

  // A run is "newly ready" iff it was NOT ready at before's own lastSeen and IS ready now.
  const wasLast = before.meta.lastSeen;
  const readyDungeons = after.dungeons
    .filter((d) => !isRunReady(before, d.id, wasLast) && isRunReady(after, d.id, now))
    .map((d) => d.id);
  const readyHabitats = after.habitats
    .filter((h) => habitatStatus(before, h.id, wasLast) !== 'ready' && habitatStatus(after, h.id, now) === 'ready')
    .map((h) => h.id);

  const anything =
    barn.gold + barn.wood + barn.acorns + satchel.wood + satchel.acorn + creel.fish + marigoldFishDrained > 0 ||
    readyDungeons.length > 0 ||
    readyHabitats.length > 0;
  if (!anything) return null;

  return { elapsedSec, barn, satchel, creel, marigoldFishDrained, readyDungeons, readyHabitats };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/lib/awayReport.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/awayReport.ts test/lib/awayReport.test.ts
git commit -m "feat(lib): pure computeAwayReport offline-gap diff"
```

---

## Task 8: Store wiring — awayReport, dismiss, tradeWood

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Add imports + interface fields**

In `src/store/gameStore.ts`:
- Add to the `../engine` import list: `tradeWoodForFish`.
- Add import: `import { computeAwayReport, AwayReport } from '../lib/awayReport';`
- In the `GameStore` interface, add:
```ts
  awayReport: AwayReport | null;
  dismissAwayReport: () => void;
  tradeWood: () => void;
```

- [ ] **Step 2: Initialize + compute in load()**

In the store body, add `awayReport: null,` to the returned initial object (next to `lastCatch: null,`).

Replace the body of `load()` with:

```ts
    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const restored = deserialize(raw);
        const now = Date.now();
        const advanced = applyElapsed(restored, now);
        const report = computeAwayReport(restored, advanced, now);
        persist(advanced);
        set({ state: advanced, loaded: true, awayReport: report });
      } catch {
        set({ loaded: true });
      }
    },
```

- [ ] **Step 3: Add the two new actions**

Next to `dismissCatch`, add:

```ts
    dismissAwayReport: () => set({ awayReport: null }),

    tradeWood: () => commit(tradeWoodForFish(applyElapsed(get().state, Date.now()))),
```

- [ ] **Step 4: Verify tsc + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (store not directly unit-tested; the engine/lib tests cover the logic).

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat(store): awayReport on load + dismiss + tradeWood action"
```

---

## Task 9: UI — AwaySummary modal + Home render

**Files:**
- Create: `src/ui/components/AwaySummary.tsx`
- Modify: `app/index.tsx`

- [ ] **Step 1: Read the existing modal + Home patterns**

Read `src/ui/components/` for the crop-picker modal (separate-backdrop pattern) and `app/index.tsx` for how the Home screen composes `ResourceBar` + store hooks. Match their styling tokens (palette `#8ed49a`, existing card styles).

- [ ] **Step 2: Create the component**

Create `src/ui/components/AwaySummary.tsx`: a `<Modal transparent>` (or absolute overlay matching the crop-picker) that takes `report: AwayReport` + `onDismiss: () => void`. Render:
- Header "🌿 Welcome back!" + humanized `report.elapsedSec` (`Xh Ym` / `Ym` / `just now` — inline helper).
- One line per NONZERO field, floored via `Math.floor`:
  - `🪙 +N`, `🪵 +N`, `🌰 +N` from `barn` (+ satchel wood/acorn folded into the same 🪵/🌰 lines OR shown separately — combine wood into one 🪵 line: `Math.floor(barn.wood + satchel.wood)`, acorns likewise `Math.floor(barn.acorns + satchel.acorn)`).
  - `🐟 +N` from `creel.fish` (floored).
  - `🌼 marigolds sipped N🐟` from `marigoldFishDrained` (floored), shown BELOW the gains, gentle styling (muted, never red).
  - `🍄 <name> is ready` per `readyDungeons` (map id→name via `getDungeon`), `🪷 <name> is ready` per `readyHabitats` (map id→name via `getHabitat`).
- A single "Nice!" button → `onDismiss`.
- Use the separate-backdrop pattern so a tap inside the card doesn't dismiss.

Import `getDungeon`, `getHabitat` from `../../engine/content` for names.

- [ ] **Step 3: Render from Home**

In `app/index.tsx`: read `awayReport` + `dismissAwayReport` from the store; render `{awayReport && <AwaySummary report={awayReport} onDismiss={dismissAwayReport} />}` inside the screen (above/over the normal content).

- [ ] **Step 4: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/AwaySummary.tsx app/index.tsx
git commit -m "feat(ui): While You Were Away summary card on Home"
```

---

## Task 10: UI — wood→fish Trade card on Town

**Files:**
- Modify: `app/town.tsx`

- [ ] **Step 1: Read town.tsx TreatsCard pattern**

Read `app/town.tsx` to match how `TreatsCard` / `UpgradeShop` render a card + a disabled-aware button and call store actions.

- [ ] **Step 2: Add a TradeCard**

Below `TreatsCard`, add a "Trading Post" card: title + subtitle ("Swap surplus lumber for fresh fish"), a line `20🪵 → 4🐟` (from `TRADE_WOOD_COST`/`TRADE_FISH_YIELD` in content), and a "Trade" button. Read `canTradeWoodForFish(state)` for the disabled state and call `tradeWood()` on press. Match existing card styling.

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/town.tsx
git commit -m "feat(ui): wood->fish Trading Post card on Town"
```

---

## Task 11: UI — pet bonus labels in Friends Pets section

**Files:**
- Modify: `src/ui/components/FriendsJournal.tsx`

- [ ] **Step 1: Read the Pets section**

Read `src/ui/components/FriendsJournal.tsx` — find where caught pets render in the 🐾 Pets section. Caught pets show sprite + name; uncaught show `???` with NO leak.

- [ ] **Step 2: Add a buff label under each CAUGHT pet**

For each caught pet, look up `PET_EFFECTS[pet.id]` and render a small muted line describing the buff. Map lever→copy:
- `barnCap` → "+5% barn", `satchelCap` → "+5% satchel", `forageRate` → "+8% forage", `creelCap` → "+8% creel", `farmRate` → "+10% farm", `catchChance` → "+3% catch".
Build the label from `PET_EFFECTS[id]`: `` `+${Math.round(amount*100)}% ${LEVER_LABEL[lever]}` ``. Uncaught cards stay untouched (no bonus leak — mirrors the locked-card no-rarity-leak rule).

- [ ] **Step 3: Verify tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/FriendsJournal.tsx
git commit -m "feat(ui): show pet passive-bonus labels in Friends Pets section"
```

---

## Task 12: Final verification

- [ ] **Step 1: Full suite + tsc**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; ALL tests pass (≥ 155 original + new pets/awayReport/town/lake/farm tests). Note the new total.

- [ ] **Step 2: Confirm save version unchanged**

Run: `grep "SAVE_VERSION" src/persistence/save.ts`
Expected: `export const SAVE_VERSION = 5;` — unchanged (regression check: no migration added).

- [ ] **Step 3: Live browser QA** (handled by the orchestrator after the build — see plan owner). Drive: app open with a seeded away-gap → summary card shows + dismisses; Town trade deducts wood/adds fish + disables when broke; catch a pet → Friends shows its buff + the buffed cap/rate reflects on Home; export→import round-trip still no-wipe; zero console errors.

- [ ] **Step 4: Merge + update HANDOFF LIVE block** (check off `id:plan7-cozy-loops`).
