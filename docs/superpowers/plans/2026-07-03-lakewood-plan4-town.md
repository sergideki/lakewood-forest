# Lakewood Plan 4 — Town Shop & Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the placeholder Town tab with a shop: 4 leveled upgrade tracks (barn cap, satchel cap, forage rate, farm expansion) + repeatable creature treats — the game's first resource sinks.

**Architecture:** Data-driven `UPGRADES` content table + `state.upgrades: Record<UpgradeId, number>`; a new pure engine module `src/engine/town.ts` (purchase/treat logic + multiplier helpers); `farm.ts`/`forest.ts` consume the multipliers; save envelope bumps to v3 with an additive migration; two new UI cards on `app/town.tsx`.

**Tech Stack:** React Native + Expo (expo-router), TypeScript, zustand v5, vitest (node env). Engine stays pure/RN-free.

**Spec:** `docs/superpowers/specs/2026-07-03-lakewood-plan4-town-design.md` — read it before starting.

**Conventions that bind every task:**
- Run everything from the worktree root (`git worktree` at `.worktrees/plan4-town`, branch `feat/plan4-town`).
- Commit messages need a `regression check:` line in the body (commit-msg hook).
- Engine modules import each other directly (`./content`), NEVER via the barrel `./index` (cycle risk).
- zustand v5: a `useGameStore` selector must never return a freshly-built array/object — stable slices or computed primitives only.

---

### Task 1: Types, content table, initial state

**Files:**
- Modify: `src/engine/types.ts` (add `UpgradeId`, `TownUpgrade`, `GameState.upgrades`)
- Modify: `src/engine/content.ts` (add `UPGRADES`, `UPGRADE_IDS`, treat constants)
- Modify: `src/engine/state.ts` (add `upgrades: {}`)

- [ ] **Step 1: Add types.** In `src/engine/types.ts`, after the `Meta` interface, add:

```ts
export type UpgradeId = string;

export interface TownUpgrade {
  id: UpgradeId;
  name: string;
  emoji: string;
  description: string;          // one line, shown in the shop
  maxLevel: number;
  baseCost: Partial<Resources>; // cost of level 0 -> 1; absent component = 0
  costGrowth: number;           // per-level multiplier on every cost component
}
```

and add to `GameState` (after `discovered`):

```ts
  upgrades: Record<UpgradeId, number>; // upgrade id -> owned level; absent key = 0
```

- [ ] **Step 2: Add content.** In `src/engine/content.ts`, extend the type import to
`import type { Crop, CropId, Species, SpeciesId, Dungeon, TownUpgrade, UpgradeId } from './types';`
and append at the end of the file:

```ts
export const UPGRADES: Record<UpgradeId, TownUpgrade> = {
  'barn-silo':      { id: 'barn-silo',      name: 'Barn Silo',         emoji: '🏚️', description: '+50% barn capacity per level',    maxLevel: 5, baseCost: { gold: 40,  wood: 25 },   costGrowth: 1.8 },
  'satchel-stitch': { id: 'satchel-stitch', name: 'Satchel Stitching', emoji: '🧵', description: '+50% satchel capacity per level', maxLevel: 5, baseCost: { gold: 40,  acorns: 20 }, costGrowth: 1.8 },
  'forage-tools':   { id: 'forage-tools',   name: 'Forage Tools',      emoji: '🪓', description: '+15% forage rate per level',      maxLevel: 5, baseCost: { gold: 60,  wood: 30 },   costGrowth: 1.9 },
  'farm-plot':      { id: 'farm-plot',      name: 'Farm Expansion',    emoji: '🚜', description: 'Clear land for a new crop plot',  maxLevel: 3, baseCost: { gold: 150, wood: 50 },   costGrowth: 2.5 },
};

export const UPGRADE_IDS: UpgradeId[] = Object.keys(UPGRADES);

export const TREAT_COST_ACORNS = 25;
export const TREAT_XP = 100;
```

- [ ] **Step 3: Initial state.** In `src/engine/state.ts`, add `upgrades: {},` after the `discovered` line in `createInitialState`.

- [ ] **Step 4: Verify green.**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all 62 tests pass (the save round-trip test still passes — v2 states deserialize with `upgrades` intact because migration is untouched so far).

- [ ] **Step 5: Commit.**

```bash
git add src/engine/types.ts src/engine/content.ts src/engine/state.ts
git commit -m "feat(town): upgrade types + UPGRADES content table + upgrades in initial state

regression check: npm test (62 passing)"
```

---

### Task 2: Engine module `town.ts` (TDD)

**Files:**
- Test: `test/engine/town.test.ts` (create)
- Create: `src/engine/town.ts`
- Modify: `src/engine/index.ts` (add barrel export)

- [ ] **Step 1: Write the failing tests.** Create `test/engine/town.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { UPGRADES, TREAT_COST_ACORNS, TREAT_XP } from '../../src/engine/content';
import {
  upgradeLevel,
  upgradeCost,
  canAfford,
  purchaseUpgrade,
  buyTreat,
  barnCapMult,
  satchelCapMult,
  forageMult,
} from '../../src/engine/town';
import type { GameState } from '../../src/engine/types';

function rich(gold = 10_000, wood = 10_000, acorns = 10_000): GameState {
  const s = createInitialState(0);
  return { ...s, resources: { gold, wood, acorns } };
}

describe('upgrade content', () => {
  it('every upgrade has a positive cost, growth > 1, and maxLevel >= 1', () => {
    for (const def of Object.values(UPGRADES)) {
      expect(def.id.length).toBeGreaterThan(0);
      expect(def.maxLevel).toBeGreaterThanOrEqual(1);
      expect(def.costGrowth).toBeGreaterThan(1);
      const total = (def.baseCost.gold ?? 0) + (def.baseCost.wood ?? 0) + (def.baseCost.acorns ?? 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe('upgradeLevel / upgradeCost', () => {
  it('reports 0 for unowned upgrades', () => {
    expect(upgradeLevel(createInitialState(0), 'barn-silo')).toBe(0);
  });

  it('cost grows by costGrowth per owned level, ceil per component', () => {
    const c0 = upgradeCost('barn-silo', 0)!;
    const c1 = upgradeCost('barn-silo', 1)!;
    expect(c0).toEqual({ gold: 40, wood: 25, acorns: 0 });
    expect(c1).toEqual({ gold: Math.ceil(40 * 1.8), wood: Math.ceil(25 * 1.8), acorns: 0 });
  });

  it('returns null at max level and for unknown ids', () => {
    expect(upgradeCost('barn-silo', UPGRADES['barn-silo'].maxLevel)).toBeNull();
    expect(upgradeCost('nope', 0)).toBeNull();
  });
});

describe('purchaseUpgrade', () => {
  it('deducts the exact cost and increments the level', () => {
    const s0 = rich();
    const s1 = purchaseUpgrade(s0, 'barn-silo');
    expect(upgradeLevel(s1, 'barn-silo')).toBe(1);
    expect(s1.resources).toEqual({ gold: 10_000 - 40, wood: 10_000 - 25, acorns: 10_000 });
  });

  it('is a no-op when unaffordable, at max level, or unknown id', () => {
    const broke = createInitialState(0); // 0 resources
    expect(purchaseUpgrade(broke, 'barn-silo')).toBe(broke);

    let s = rich(10 ** 9, 10 ** 9, 10 ** 9);
    for (let i = 0; i < UPGRADES['barn-silo'].maxLevel; i++) s = purchaseUpgrade(s, 'barn-silo');
    expect(upgradeLevel(s, 'barn-silo')).toBe(UPGRADES['barn-silo'].maxLevel);
    expect(purchaseUpgrade(s, 'barn-silo')).toBe(s);

    expect(purchaseUpgrade(rich(), 'nope')).toEqual(rich());
  });

  it('canAfford matches purchase behaviour', () => {
    expect(canAfford(rich(), 'barn-silo')).toBe(true);
    expect(canAfford(createInitialState(0), 'barn-silo')).toBe(false);
    expect(canAfford(rich(), 'nope')).toBe(false);
  });

  it('farm-plot appends plot-4, plot-5, plot-6 with null crop and unique ids', () => {
    let s = rich(10 ** 9, 10 ** 9, 10 ** 9);
    s = purchaseUpgrade(s, 'farm-plot');
    s = purchaseUpgrade(s, 'farm-plot');
    s = purchaseUpgrade(s, 'farm-plot');
    expect(s.plots.map((p) => p.id)).toEqual(['plot-1', 'plot-2', 'plot-3', 'plot-4', 'plot-5', 'plot-6']);
    expect(s.plots.slice(3).every((p) => p.crop === null)).toBe(true);
    expect(purchaseUpgrade(s, 'farm-plot')).toBe(s); // maxLevel 3
  });
});

describe('multipliers', () => {
  it('are 1 at level 0 and scale with owned levels', () => {
    const s0 = createInitialState(0);
    expect(barnCapMult(s0)).toBe(1);
    expect(satchelCapMult(s0)).toBe(1);
    expect(forageMult(s0)).toBe(1);

    const s = { ...s0, upgrades: { 'barn-silo': 2, 'satchel-stitch': 1, 'forage-tools': 3 } };
    expect(barnCapMult(s)).toBe(2);          // 1 + 0.5*2
    expect(satchelCapMult(s)).toBe(1.5);     // 1 + 0.5*1
    expect(forageMult(s)).toBeCloseTo(1.45); // 1 + 0.15*3
  });
});

describe('buyTreat', () => {
  it('deducts acorns and grants XP (auto-levels across a threshold)', () => {
    const s0 = rich();
    const target = s0.creatures[0]; // level 1, xp 0, common -> needs 100 xp for level 2
    const s1 = buyTreat(s0, target.id);
    expect(s1.resources.acorns).toBe(10_000 - TREAT_COST_ACORNS);
    const fed = s1.creatures.find((c) => c.id === target.id)!;
    expect(fed.level).toBe(2); // TREAT_XP (100) === xpForLevel(1, common)
    expect(fed.xp).toBe(0);
    expect(TREAT_XP).toBe(100);
  });

  it('is a no-op when acorns are short or the creature is unknown', () => {
    const broke = { ...rich(), resources: { gold: 0, wood: 0, acorns: TREAT_COST_ACORNS - 1 } };
    expect(buyTreat(broke, broke.creatures[0].id)).toBe(broke);
    const s = rich();
    expect(buyTreat(s, 'cr-ghost')).toBe(s);
  });

  it('feeds a creature even while it is assigned to a dungeon', () => {
    const s0 = rich();
    const c = s0.creatures[0];
    const inRun: GameState = {
      ...s0,
      creatures: s0.creatures.map((x) =>
        x.id === c.id ? { ...x, assignment: { type: 'dungeon' as const, dungeonId: 'hollow', startedAt: 1 } } : x,
      ),
    };
    const s1 = buyTreat(inRun, c.id);
    expect(s1.creatures.find((x) => x.id === c.id)!.level).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `npx vitest run test/engine/town.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/town`.

- [ ] **Step 3: Implement.** Create `src/engine/town.ts`:

```ts
import type { GameState, Resources, UpgradeId } from './types';
import { UPGRADES, TREAT_COST_ACORNS, TREAT_XP } from './content';
import { grantXp } from './creatures';

/** Owned level of an upgrade; tolerates pre-v3 states with no `upgrades` field. */
export function upgradeLevel(state: GameState, id: UpgradeId): number {
  return state.upgrades?.[id] ?? 0;
}

/** Cost of buying the NEXT level given `ownedLevel`; null when unknown id or already at max. */
export function upgradeCost(id: UpgradeId, ownedLevel: number): Resources | null {
  const def = UPGRADES[id];
  if (!def || ownedLevel >= def.maxLevel) return null;
  const mult = Math.pow(def.costGrowth, ownedLevel);
  return {
    gold: Math.ceil((def.baseCost.gold ?? 0) * mult),
    wood: Math.ceil((def.baseCost.wood ?? 0) * mult),
    acorns: Math.ceil((def.baseCost.acorns ?? 0) * mult),
  };
}

export function canAfford(state: GameState, id: UpgradeId): boolean {
  const cost = upgradeCost(id, upgradeLevel(state, id));
  if (!cost) return false;
  const r = state.resources;
  return r.gold >= cost.gold && r.wood >= cost.wood && r.acorns >= cost.acorns;
}

/** Buy the next level. No-op (same reference) when unknown, maxed, or unaffordable. */
export function purchaseUpgrade(state: GameState, id: UpgradeId): GameState {
  const level = upgradeLevel(state, id);
  const cost = upgradeCost(id, level);
  if (!cost || !canAfford(state, id)) return state;

  let next: GameState = {
    ...state,
    resources: {
      gold: state.resources.gold - cost.gold,
      wood: state.resources.wood - cost.wood,
      acorns: state.resources.acorns - cost.acorns,
    },
    upgrades: { ...state.upgrades, [id]: level + 1 },
  };
  if (id === 'farm-plot') {
    // Plots are only ever appended, so length+1 always yields a fresh id.
    next = { ...next, plots: [...next.plots, { id: `plot-${next.plots.length + 1}`, crop: null }] };
  }
  return next;
}

/** Spend acorns to grant a flat XP lump. Instant — works regardless of assignment. */
export function buyTreat(state: GameState, creatureId: string): GameState {
  if (state.resources.acorns < TREAT_COST_ACORNS) return state;
  if (!state.creatures.some((c) => c.id === creatureId)) return state;
  return {
    ...state,
    resources: { ...state.resources, acorns: state.resources.acorns - TREAT_COST_ACORNS },
    creatures: state.creatures.map((c) => (c.id === creatureId ? grantXp(c, TREAT_XP) : c)),
  };
}

export function barnCapMult(state: GameState): number {
  return 1 + 0.5 * upgradeLevel(state, 'barn-silo');
}

export function satchelCapMult(state: GameState): number {
  return 1 + 0.5 * upgradeLevel(state, 'satchel-stitch');
}

export function forageMult(state: GameState): number {
  return 1 + 0.15 * upgradeLevel(state, 'forage-tools');
}
```

- [ ] **Step 4: Barrel export.** In `src/engine/index.ts` add `export * from './town';` after the `./forest` line.

- [ ] **Step 5: Run tests to verify they pass.**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites pass (62 existing + the new town suite).

- [ ] **Step 6: Commit.**

```bash
git add src/engine/town.ts src/engine/index.ts test/engine/town.test.ts
git commit -m "feat(town): pure engine module — upgrade purchase, treats, cap/rate multipliers

regression check: npx vitest run test/engine/town.test.ts"
```

---

### Task 3: Wire multipliers into barnCap / satchelCap / forageRatePerSec (TDD)

**Files:**
- Test: `test/engine/town.test.ts` (append a describe block)
- Modify: `src/engine/farm.ts:8-11` (`barnCap`)
- Modify: `src/engine/forest.ts:10-20` (`forageRatePerSec`, `satchelCap`)

- [ ] **Step 1: Write the failing tests.** Append to `test/engine/town.test.ts` (imports to add at the top: `import { barnCap } from '../../src/engine/farm';` and `import { satchelCap, forageRatePerSec, assignCreature } from '../../src/engine/forest';`):

```ts
describe('multipliers wired into caps and rates', () => {
  it('barn-silo scales barnCap (after the 500 floor) and stays an integer', () => {
    const s0 = createInitialState(0); // no production -> floor cap 500
    expect(barnCap(s0)).toBe(500);
    const s1 = { ...s0, upgrades: { 'barn-silo': 1 } };
    expect(barnCap(s1)).toBe(750); // 500 * 1.5
    expect(Number.isInteger(barnCap(s1))).toBe(true);
  });

  it('satchel-stitch scales satchelCap (after the 200 floor) and stays an integer', () => {
    const s0 = createInitialState(0); // nobody foraging -> floor cap 200
    expect(satchelCap(s0)).toBe(200);
    const s1 = { ...s0, upgrades: { 'satchel-stitch': 3 } };
    expect(satchelCap(s1)).toBe(500); // 200 * 2.5
    expect(Number.isInteger(satchelCap(s1))).toBe(true);
  });

  it('forage-tools scales forageRatePerSec, which also lifts the derived satchel cap', () => {
    const s0 = createInitialState(0);
    const foraging = assignCreature(s0, s0.creatures[0].id, 'forage'); // starter #1 = fernling (acorn affinity)
    const mat = foraging.creatures[0].affinity;
    const base = forageRatePerSec(foraging, mat);
    expect(base).toBeGreaterThan(0);
    const boosted = { ...foraging, upgrades: { 'forage-tools': 2 } };
    expect(forageRatePerSec(boosted, mat)).toBeCloseTo(base * 1.3);
    expect(satchelCap(boosted)).toBeGreaterThan(satchelCap(foraging));
    expect(Number.isInteger(satchelCap(boosted))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify the new block fails.**

Run: `npx vitest run test/engine/town.test.ts`
Expected: the three new tests FAIL (caps don't scale yet); everything else passes.

- [ ] **Step 3: Implement.** In `src/engine/farm.ts`, add `import { barnCapMult } from './town';` and change `barnCap` to:

```ts
/** Derived barn capacity = a day's worth of the current farm rate, floored, then upgraded. */
export function barnCap(state: GameState): number {
  const perDay = farmRatePerSec(state) * BARN_HOURS * 3600;
  // Multiplier applies AFTER the floor (upgrade visible at zero production); final round
  // keeps the cap an integer (odd cap x 1.5 would otherwise leak fractions to the UI).
  return Math.round(Math.max(500, Math.round(perDay)) * barnCapMult(state));
}
```

In `src/engine/forest.ts`, add `import { satchelCapMult, forageMult } from './town';` and change the two functions to:

```ts
/** Items/sec produced for one material by all creatures foraging it (upgrade-boosted). */
export function forageRatePerSec(state: GameState, material: Material): number {
  const base = state.creatures
    .filter((c) => c.assignment.type === 'forage' && c.affinity === material)
    .reduce((sum, c) => sum + creatureForageOutput(c), 0);
  return base * forageMult(state);
}

/** Combined satchel capacity = a day's worth of the current total forage rate, floored, then upgraded. */
export function satchelCap(state: GameState): number {
  const perSec = forageRatePerSec(state, 'wood') + forageRatePerSec(state, 'acorn');
  const derived = Math.max(SATCHEL_FLOOR, Math.round(perSec * SATCHEL_HOURS * 3600));
  return Math.round(derived * satchelCapMult(state));
}
```

- [ ] **Step 4: Run the full suite.**

Run: `npx tsc --noEmit && npm test`
Expected: everything passes — at level 0 all multipliers are 1, so no existing expectation moves.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/farm.ts src/engine/forest.ts test/engine/town.test.ts
git commit -m "feat(town): barn/satchel caps + forage rate consume upgrade multipliers

regression check: npm test (all suites)"
```

---

### Task 4: Save migration v3 (TDD)

**Files:**
- Test: `test/persistence/save.test.ts` (edit ONE assertion + append a describe block)
- Modify: `src/persistence/save.ts:5,49-53`

- [ ] **Step 1: Adjust + extend tests.** In `test/persistence/save.test.ts`:
  1. Change the single sanctioned assertion `expect(SAVE_VERSION).toBe(2);` → `expect(SAVE_VERSION).toBe(3);` (it lives in the "leaves a current v2 save untouched" test — also rename that test to `'leaves a current save untouched'`).
  2. Append:

```ts
describe('v2 -> v3 migration', () => {
  it('backfills upgrades on a v2 (forest, pre-town) save', () => {
    const v2State = createInitialState(0) as Record<string, unknown>;
    delete v2State.upgrades; // simulate a save written before Plan 4
    const restored = deserialize(JSON.stringify({ version: 2, state: v2State }));
    expect(restored.upgrades).toEqual({});
  });

  it('chains v1 -> v3: forest fields AND upgrades are backfilled', () => {
    const v1Envelope = JSON.stringify({
      version: 1,
      state: {
        resources: { gold: 5 },
        plots: [{ id: 'plot-1', crop: null }],
        villagers: [],
        storage: { barn: { amount: 0 } },
        meta: { lastSeen: 0 },
      },
    });
    const s = deserialize(v1Envelope);
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 }); // v2 step still ran
    expect(s.upgrades).toEqual({});                            // v3 step ran
  });

  it('preserves owned upgrade levels on a current save', () => {
    const s0 = { ...createInitialState(0), upgrades: { 'barn-silo': 2 } };
    expect(deserialize(serialize(s0)).upgrades).toEqual({ 'barn-silo': 2 });
  });
});
```

- [ ] **Step 2: Run to verify failures.**

Run: `npx vitest run test/persistence/save.test.ts`
Expected: FAIL — `SAVE_VERSION` is still 2 and the v2→v3 backfill doesn't exist.

- [ ] **Step 3: Implement.** In `src/persistence/save.ts`: change line 5 to `export const SAVE_VERSION = 3;` and compose the new branch into `migrate` (keep `addForestFields` — do NOT replace it):

```ts
/** Additive migrations. v1 (farm-only) -> v2 (forest) -> v3 (town upgrades). Idempotent. */
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);
  if (fromVersion < 3) s = { ...s, upgrades: s.upgrades ?? {} };
  return s;
}
```

- [ ] **Step 4: Run the full suite.**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add src/persistence/save.ts test/persistence/save.test.ts
git commit -m "feat(town): save v3 — additive upgrades backfill, v1/v2 chains verified

regression check: npx vitest run test/persistence/save.test.ts"
```

---

### Task 5: Store actions

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Implement.** In `src/store/gameStore.ts`:
  1. Add `purchaseUpgrade, buyTreat` to the `from '../engine'` import list.
  2. Add to the `GameStore` interface (after `collectForage`):

```ts
  purchase: (upgradeId: string) => void;
  feedTreat: (creatureId: string) => void;
```

  3. Add the implementations (after `collectForage`, before `dismissDiscovery`) — plain `commit`, no discovery roll:

```ts
    purchase: (upgradeId) => commit(purchaseUpgrade(applyElapsed(get().state, Date.now()), upgradeId)),

    feedTreat: (creatureId) => commit(buyTreat(applyElapsed(get().state, Date.now()), creatureId)),
```

- [ ] **Step 2: Verify green.**

Run: `npx tsc --noEmit && npm test`
Expected: clean/pass (store has no unit tests; tsc is the gate here).

- [ ] **Step 3: Commit.**

```bash
git add src/store/gameStore.ts
git commit -m "feat(town): store actions purchase + feedTreat (applyElapsed-first, persisted)

regression check: npx tsc --noEmit"
```

---

### Task 6: UI — UpgradeShop, TreatsCard, Town screen, PlotGrid wrap

**Files:**
- Create: `src/ui/components/UpgradeShop.tsx`
- Create: `src/ui/components/TreatsCard.tsx`
- Modify: `app/town.tsx` (replace placeholder)
- Modify: `src/ui/components/PlotGrid.tsx:80-81` (grid wrap)

zustand v5 rule for every selector below: stable slices (`s.state`, `s.state.creatures`) or primitives (`s.state.resources.acorns`) only — never a fresh array/object.

- [ ] **Step 1: Create `src/ui/components/UpgradeShop.tsx`:**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { UPGRADES, UPGRADE_IDS, upgradeCost, upgradeLevel, canAfford } from '../../engine';
import type { Resources } from '../../engine';

function costLine(cost: Resources): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${cost.gold} 🪙`);
  if (cost.wood) parts.push(`${cost.wood} 🪵`);
  if (cost.acorns) parts.push(`${cost.acorns} 🌰`);
  return parts.join(' · ');
}

export function UpgradeShop() {
  // `s.state` is the stable committed snapshot — safe; derive everything in render.
  const state = useGameStore((s) => s.state);
  const purchase = useGameStore((s) => s.purchase);

  return (
    <>
      {UPGRADE_IDS.map((id) => {
        const def = UPGRADES[id];
        const level = upgradeLevel(state, id);
        const cost = upgradeCost(id, level);
        const affordable = canAfford(state, id);
        return (
          <View key={id} style={cards.card}>
            <View style={styles.header}>
              <Text style={cards.title}>{def.emoji} {def.name}</Text>
              <Text style={styles.level}>Lv {level}/{def.maxLevel}</Text>
            </View>
            <Text style={cards.sub}>{def.description}</Text>
            <View style={styles.footer}>
              <Text style={cost ? styles.cost : styles.max}>{cost ? costLine(cost) : 'MAX'}</Text>
              {cost !== null && (
                <Pressable
                  style={[styles.btn, !affordable && styles.btnDisabled]}
                  disabled={!affordable}
                  onPress={() => purchase(id)}
                >
                  <Text style={styles.btnText}>Buy</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cost: { color: theme.text, fontSize: 13 },
  max: { color: theme.textDim, fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 2: Create `src/ui/components/TreatsCard.tsx`:**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { TREAT_COST_ACORNS, TREAT_XP, xpForLevel } from '../../engine';
import { CreatureIcon } from './CreatureIcon';

export function TreatsCard() {
  const creatures = useGameStore((s) => s.state.creatures);
  const acorns = useGameStore((s) => s.state.resources.acorns);
  const feedTreat = useGameStore((s) => s.feedTreat);
  const broke = acorns < TREAT_COST_ACORNS;

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🍪 Treats</Text>
      <Text style={cards.sub}>{TREAT_COST_ACORNS} 🌰 → +{TREAT_XP} XP for a friend</Text>
      {creatures.map((c) => (
        <View key={c.id} style={styles.row}>
          <CreatureIcon speciesId={c.species} emoji={c.emoji} size={24} />
          <View style={styles.info}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>Lv {c.level} · {Math.floor(c.xp)}/{xpForLevel(c.level, c.rarity)} xp</Text>
          </View>
          <Pressable
            style={[styles.btn, broke && styles.btnDisabled]}
            disabled={broke}
            onPress={() => feedTreat(c.id)}
          >
            <Text style={styles.btnText}>Feed</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  info: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 1 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 3: Replace `app/town.tsx`:**

```tsx
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { UpgradeShop } from '../src/ui/components/UpgradeShop';
import { TreatsCard } from '../src/ui/components/TreatsCard';

// No tick loop: resources never accrue passively into `resources`, and every
// purchase runs applyElapsed first in the store.
export default function Town() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <UpgradeShop />
        <TreatsCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
```

- [ ] **Step 4: PlotGrid wrap.** In `src/ui/components/PlotGrid.tsx` styles, change the two lines:

```ts
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  plot: { flexBasis: '30%', flexGrow: 1, backgroundColor: '#3c5a3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
```

(3 plots render exactly as before — three ~30% tiles in one row; 4–6 wrap into rows of three.)

- [ ] **Step 5: Verify green.**

Run: `npx tsc --noEmit && npm test`
Expected: clean/pass.

- [ ] **Step 6: Commit.**

```bash
git add src/ui/components/UpgradeShop.tsx src/ui/components/TreatsCard.tsx app/town.tsx src/ui/components/PlotGrid.tsx
git commit -m "feat(town): Town screen — upgrade shop + treats card, PlotGrid wraps for 4-6 plots

regression check: npx tsc --noEmit && npm test"
```

---

### Task 7: Live browser QA (main session, not a subagent)

**Files:** none (temporary content tweaks reverted with `git checkout`).

- [ ] **Step 1:** `npx expo start --web --port 8090` (NO `CI=1` — it disables rebuilds).
- [ ] **Step 2:** Browse `http://localhost:8090/town`: screen mounts (no "getSnapshot should be cached" crash), 4 upgrade cards + treats card render, Buy/Feed disabled at 0 resources.
- [ ] **Step 3:** Seed resources: temporarily set `resources: { gold: 2000, wood: 800, acorns: 400 }` in `src/engine/state.ts` `createInitialState`, clear site storage, reload.
- [ ] **Step 4:** Buy Barn Silo → gold/wood drop by exactly 40/25, level shows 1/5; Home barn cap reads 750.
- [ ] **Step 5:** Buy Farm Expansion → Home shows 4 plots wrapped into two rows; new plot opens the crop picker and plants.
- [ ] **Step 6:** Feed a treat → acorns −25, creature Lv 1→2 in the row; feed until acorns < 25 → Feed buttons dim.
- [ ] **Step 7:** Reload the page → upgrades, plots, and levels persist (save v3 round-trip).
- [ ] **Step 8:** Check the browser console for errors/warnings.
- [ ] **Step 9:** Revert the seed: `git checkout src/engine/state.ts`. Confirm `git status` clean except intended files.

---

## Self-review (done at write time)

- Spec coverage: types/content (T1), engine town module + treats (T2), multiplier wiring incl. rounding (T3), composed v3 migration + sanctioned test edit (T4), store (T5), UI + PlotGrid wrap (T6), live QA incl. farm-plot grid check (T7). Out-of-scope items untouched.
- No placeholders; all code complete.
- Type consistency: `upgradeCost(id, ownedLevel)` signature used identically in T2/T6; `Resources` return filled with 0s matches `costLine` truthiness checks; `purchase`/`feedTreat` store names match T6 usage.
