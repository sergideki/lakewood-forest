# Lakewood Plan 5 — The Lake 🎣 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the lake — a passive fishing rod that fills a **fish** creel, **habitats** you build to attract specific water creatures (directed discovery), and **pets** caught by chance while collecting the creel (cozy collectibles).

**Architecture:** New pure engine module `src/engine/lake.ts` (fishing accrual + habitat lifecycle + pet catch) alongside a data-model expansion — `fish` resource, `'fish'` material, `creel` store, `habitats`/`pets` on `GameState`. Fishing reuses the material-generic `forageRatePerSec`; habitats are directed/deterministic (no rng); pets mirror `rollDiscovery` over a separate pool. Save envelope bumps to v4 (additive). A new Lake tab hosts the UI.

**Tech Stack:** React Native + Expo (expo-router), TypeScript, zustand v5, vitest (node env). Engine stays pure/RN-free.

**Spec:** `docs/superpowers/specs/2026-07-03-lakewood-plan5-lake-design.md` — read it before starting.

**Conventions that bind every task:**
- Run everything from the worktree root (`git worktree` at `.worktrees/plan5-lake`, branch `feat/plan5-lake`). The worktree needs `node_modules` symlinked: `ln -s <repo>/node_modules <worktree>/node_modules` (Expo/Metro gotcha — see HANDOFF).
- Commit messages need a `regression check:` line in the body (commit-msg hook).
- Engine modules import each other directly (`./content`, `./forest`), NEVER via the barrel `./index` (cycle risk).
- zustand v5: a `useGameStore` selector must NEVER return a freshly-built array/object — stable slices (`s.state`, `s.state.creatures`, `s.state.pets`, `s.state.storage.creel`) or computed primitives only. `.filter`/`.map`/`.find` go in the render body. This crashed a screen on mount in Plan 3.
- `fish` and `creel` are REQUIRED fields once added — tsc will flag every hand-built literal that drops them. The full inventory is handled in Task 1.

---

### Task 1: Data model — types, content, initial state, and the `fish`/`creel` ripple

Adding required `Resources.fish` + `Storage.creel` + `GameState.habitats`/`pets` forces edits to every hand-built literal so the tree still compiles. This task lands them all together and stays on `SAVE_VERSION` 3 (the v4 migration is Task 5).

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/content.ts`
- Modify: `src/engine/state.ts`
- Modify: `src/engine/town.ts` (`upgradeCost`, `purchaseUpgrade` — hand-built resources literals)
- Modify: `src/persistence/save.ts` (`addForestFields` — hand-built resources + storage literals)
- Modify: `test/engine/town.test.ts` (5 sanctioned literal/assertion edits)

- [ ] **Step 1: Types.** In `src/engine/types.ts`:
  1. Change `export type Material = 'wood' | 'acorn';` → `export type Material = 'wood' | 'acorn' | 'fish';`
  2. Add `fish: number;` to `Resources` (after `acorns`).
  3. Add `creel: { fish: number };` to `Storage` (after `satchel`).
  4. After the `Dungeon` interface, add:

```ts
export interface HabitatState {
  id: string;
  builtAt: number | null; // epoch ms; null = unbuilt
}

export interface Habitat {
  id: string;
  name: string;
  emoji: string;
  attracts: SpeciesId;      // the ONE water creature this habitat attracts
  cost: Partial<Resources>; // absent component = 0
  attractSec: number;       // build → ready
}

export type PetId = string;

export interface Pet {
  id: PetId;
  name: string;
  emoji: string;
  rarity: Rarity;
}
```

  5. Add to `GameState` (after `upgrades`):

```ts
  habitats: HabitatState[];
  pets: PetId[]; // discovered pet ids; absent/[] = none caught
```

- [ ] **Step 2: Content.** In `src/engine/content.ts`:
  1. Extend the type import to:
`import type { Crop, CropId, Species, SpeciesId, Dungeon, TownUpgrade, UpgradeId, Habitat, Pet, PetId } from './types';`
  2. Add the four water species INSIDE the existing `SPECIES` record (after `emberkit`):

```ts
  ripplefrog:  { id: 'ripplefrog',  name: 'Ripple Frog',  emoji: '🐸', rarity: 'common',   affinity: 'fish' },
  puddleduck:  { id: 'puddleduck',  name: 'Puddle Duck',  emoji: '🦆', rarity: 'common',   affinity: 'fish' },
  koisprite:   { id: 'koisprite',   name: 'Koi Sprite',   emoji: '🎏', rarity: 'uncommon', affinity: 'fish' },
  mistleotter: { id: 'mistleotter', name: 'Mistle Otter', emoji: '🦦', rarity: 'rare',     affinity: 'fish' },
```

  3. Append at the end of the file:

```ts
export const HABITATS: Habitat[] = [
  { id: 'lilypads',  name: 'Lily Pads',  emoji: '🪷', attracts: 'ripplefrog',  cost: { fish: 20 },            attractSec: 15 * 60  },
  { id: 'reedbed',   name: 'Reed Bed',   emoji: '🎋', attracts: 'puddleduck',  cost: { fish: 40, wood: 20 },  attractSec: 60 * 60  },
  { id: 'koistones', name: 'Koi Stones', emoji: '🪨', attracts: 'koisprite',   cost: { fish: 80, gold: 50 },  attractSec: 2 * 3600 },
  { id: 'otterholt', name: 'Otter Holt', emoji: '🕳️', attracts: 'mistleotter', cost: { fish: 150, wood: 60 }, attractSec: 4 * 3600 },
];

export function getHabitat(id: string): Habitat | undefined {
  return HABITATS.find((h) => h.id === id);
}

export const HABITAT_IDS: string[] = HABITATS.map((h) => h.id);

export const PETS: Record<PetId, Pet> = {
  pondsnail:    { id: 'pondsnail',    name: 'Pond Snail',    emoji: '🐌', rarity: 'common'   },
  waterbeetle:  { id: 'waterbeetle',  name: 'Water Beetle',  emoji: '🪲', rarity: 'common'   },
  dragonfly:    { id: 'dragonfly',    name: 'Dragonfly',     emoji: '🦋', rarity: 'uncommon' },
  pebbleturtle: { id: 'pebbleturtle', name: 'Pebble Turtle', emoji: '🐢', rarity: 'uncommon' },
  crawdad:      { id: 'crawdad',      name: 'Crawdad',       emoji: '🦞', rarity: 'rare'     },
  pondnewt:     { id: 'pondnewt',     name: 'Pond Newt',     emoji: '🦎', rarity: 'rare'     },
};

export const PET_IDS: PetId[] = Object.keys(PETS);

export const BASE_ROD_RATE = 0.05; // fish/sec with zero water creatures (bootstraps the loop)
export const CREEL_HOURS = 24;     // creel holds ~a day of the current fish rate
export const CREEL_FLOOR = 200;    // minimum creel capacity
export const CATCH_CHANCE = 0.25;  // chance to catch a pet per NON-EMPTY creel collect
```

- [ ] **Step 3: Initial state.** In `src/engine/state.ts`:
  1. Add `HABITATS` to the content import: `import { DUNGEONS, STARTER_SPECIES, HABITATS } from './content';`
  2. Change the `resources` line to `resources: { gold: 0, wood: 0, acorns: 0, fish: 0 },`
  3. Change the `storage` line to `storage: { barn: { amount: 0 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },`
  4. After the `upgrades: {},` line add:

```ts
    habitats: HABITATS.map((h) => ({ id: h.id, builtAt: null })),
    pets: [],
```

- [ ] **Step 4: Fix the town.ts literals.** In `src/engine/town.ts`:
  1. In `upgradeCost`'s return object add `fish: Math.ceil((def.baseCost.fish ?? 0) * mult),` (after `acorns`).
  2. In `purchaseUpgrade`'s `resources` object literal add `fish: state.resources.fish - cost.fish,` (after `acorns`).

- [ ] **Step 5: Fix the save.ts migration literal.** In `src/persistence/save.ts` `addForestFields`:
  1. Change the resources line to:
`resources: { gold: r.gold ?? 0, wood: r.wood ?? 0, acorns: r.acorns ?? 0, fish: r.fish ?? 0 },`
  2. Add `creel: old.storage.creel ?? { fish: 0 },` to the `storage` object (after `satchel`).

- [ ] **Step 6: Sanctioned test edits.** In `test/engine/town.test.ts`:
  - Line ~20 (`rich()` helper): change the return to `return { ...s, resources: { gold, wood, acorns, fish: 0 } };`
  - Line ~43: `expect(c0).toEqual({ gold: 40, wood: 25, acorns: 0, fish: 0 });`
  - Line ~44: `expect(c1).toEqual({ gold: Math.ceil(40 * 1.8), wood: Math.ceil(25 * 1.8), acorns: 0, fish: 0 });`
  - Line ~58: `expect(s1.resources).toEqual({ gold: 10_000 - 40, wood: 10_000 - 25, acorns: 10_000, fish: 0 });`
  - Line ~117 (`broke`): `const broke = { ...rich(), resources: { gold: 0, wood: 0, acorns: TREAT_COST_ACORNS - 1, fish: 0 } };`

- [ ] **Step 7: Verify green.**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean (all literals now carry `fish`/`creel`); all **80** tests pass. If tsc flags any other `Resources`/`Storage`/`GameState` literal not listed above, add the missing field with a zero default (`fish: 0` / `creel: { fish: 0 }`) — but none are expected (only `town.test.ts` holds Resources literals; every other site spreads).

- [ ] **Step 8: Commit.**

```bash
git add src/engine/types.ts src/engine/content.ts src/engine/state.ts src/engine/town.ts src/persistence/save.ts test/engine/town.test.ts
git commit -m "feat(lake): data model — fish resource, creel, habitats, pets + water species content

regression check: npx tsc --noEmit && npm test (80 passing)"
```

---

### Task 2: Engine `lake.ts` — fishing + pet catch (TDD)

**Files:**
- Test: `test/engine/lake.test.ts` (create)
- Create: `src/engine/lake.ts`
- Modify: `src/engine/index.ts` (barrel)
- Modify: `src/engine/idle.ts` (wire `accrueCreel` into `applyElapsed`)

- [ ] **Step 1: Write the failing tests.** Create `test/engine/lake.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { assignCreature } from '../../src/engine/forest';
import { BASE_ROD_RATE, CREEL_FLOOR, CREEL_HOURS, PET_IDS } from '../../src/engine/content';
import { fishRatePerSec, creelCap, accrueCreel, collectCreel, rollCatch } from '../../src/engine/lake';
import type { GameState } from '../../src/engine/types';

// A state with one discovered fish-affinity creature set to forage (fills the creel).
function withWaterForager(): GameState {
  const s = createInitialState(0);
  const frog = {
    id: 'cr-ripplefrog', species: 'ripplefrog', name: 'Ripple Frog', emoji: '🐸',
    rarity: 'common' as const, affinity: 'fish' as const, level: 1, xp: 0,
    assignment: { type: 'forage' as const, dungeonId: null, startedAt: 0 },
  };
  return { ...s, creatures: [...s.creatures, frog], discovered: [...s.discovered, 'ripplefrog'] };
}

describe('fishRatePerSec', () => {
  it('is the flat rod base with zero water creatures', () => {
    expect(fishRatePerSec(createInitialState(0))).toBe(BASE_ROD_RATE);
  });
  it('rises when a fish-affinity creature forages', () => {
    expect(fishRatePerSec(withWaterForager())).toBeGreaterThan(BASE_ROD_RATE);
  });
  it('forage-tools lifts only the creature part, not the rod base', () => {
    const s = withWaterForager();
    const creaturePart = fishRatePerSec(s) - BASE_ROD_RATE;
    const boosted = { ...s, upgrades: { 'forage-tools': 2 } };
    expect(fishRatePerSec(boosted)).toBeCloseTo(BASE_ROD_RATE + creaturePart * 1.3);
  });
});

describe('creelCap', () => {
  it('is a day of the current fish rate, at least the floor, integer', () => {
    const cap = creelCap(createInitialState(0));
    expect(cap).toBe(Math.max(CREEL_FLOOR, Math.round(BASE_ROD_RATE * CREEL_HOURS * 3600)));
    expect(Number.isInteger(cap)).toBe(true);
  });
  it('rises with more foragers', () => {
    expect(creelCap(withWaterForager())).toBeGreaterThan(creelCap(createInitialState(0)));
  });
});

describe('accrueCreel', () => {
  it('fills at the fish rate over elapsed seconds', () => {
    const after = accrueCreel(createInitialState(0), 100);
    expect(after.storage.creel.fish).toBeCloseTo(BASE_ROD_RATE * 100);
  });
  it('clamps at the cap', () => {
    const s = createInitialState(0);
    expect(accrueCreel(s, 10 ** 9).storage.creel.fish).toBe(creelCap(s));
  });
  it('is a no-op for zero or negative elapsed', () => {
    const s = createInitialState(0);
    expect(accrueCreel(s, 0)).toBe(s);
    expect(accrueCreel(s, -5)).toBe(s);
  });
});

describe('collectCreel', () => {
  const lowRng = () => 0;      // "hit" the catch, pick the first pet
  const highRng = () => 0.999; // never catch

  it('banks whole fish and carries the remainder', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 12.7 } } };
    const after = collectCreel(s, highRng); // isolate banking from catching
    expect(after.resources.fish).toBe(12);
    expect(after.storage.creel.fish).toBeCloseTo(0.7);
  });
  it('empty creel is a no-op — no bank, no catch roll', () => {
    const s = createInitialState(0); // creel.fish = 0
    expect(collectCreel(s, lowRng)).toBe(s);
    expect(collectCreel(s, lowRng).pets.length).toBe(0);
  });
  it('catches a pet when rng is below CATCH_CHANCE and fish were banked', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 5 } } };
    expect(collectCreel(s, lowRng).pets.length).toBe(1);
  });
  it('catches nothing when rng is above CATCH_CHANCE', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 5 } } };
    expect(collectCreel(s, highRng).pets.length).toBe(0);
  });
});

describe('rollCatch', () => {
  it('no-ops (same ref) when the pool is exhausted', () => {
    const full = { ...createInitialState(0), pets: [...PET_IDS] };
    expect(rollCatch(full, 1, () => 0)).toBe(full);
  });
  it('respects the chance gate', () => {
    const s = createInitialState(0);
    expect(rollCatch(s, 0, () => 0.5)).toBe(s);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run test/engine/lake.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/lake`.

- [ ] **Step 3: Implement.** Create `src/engine/lake.ts`:

```ts
import type { GameState, Rng } from './types';
import { PETS, PET_IDS, BASE_ROD_RATE, CREEL_HOURS, CREEL_FLOOR, CATCH_CHANCE } from './content';
import { DISCOVERY_WEIGHT } from './creatures';
import { forageRatePerSec } from './forest';

/** Fish/sec = flat rod base + all fish-affinity foragers (creature part is forageMult-boosted). */
export function fishRatePerSec(state: GameState): number {
  return BASE_ROD_RATE + forageRatePerSec(state, 'fish');
}

/** Creel capacity = a day of the current fish rate, floored. (No creel upgrade in v1.) */
export function creelCap(state: GameState): number {
  return Math.max(CREEL_FLOOR, Math.round(fishRatePerSec(state) * CREEL_HOURS * 3600));
}

/** Fill the creel by the fish rate over elapsedSec, clamped to cap. Immutable. */
export function accrueCreel(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const rate = fishRatePerSec(state);
  const cap = creelCap(state);
  const cur = state.storage.creel.fish;
  const next = Math.min(cap, cur + rate * elapsedSec);
  if (next === cur) return state;
  return { ...state, storage: { ...state.storage, creel: { fish: next } } };
}

/**
 * With probability `chance`, catch a new (uncaught) pet — weighted toward common — and record it.
 * Two rng draws: hit, then weighted pick. No-op (same ref) on miss or exhausted pool.
 */
export function rollCatch(state: GameState, chance: number, rng: Rng): GameState {
  if (rng() >= chance) return state;
  const pool = PET_IDS.filter((id) => !state.pets.includes(id)).map((id) => PETS[id]);
  if (pool.length === 0) return state;

  const totalWeight = pool.reduce((sum, p) => sum + DISCOVERY_WEIGHT[p.rarity], 0);
  let roll = rng() * totalWeight;
  let picked = pool[pool.length - 1];
  for (const p of pool) {
    roll -= DISCOVERY_WEIGHT[p.rarity];
    if (roll < 0) { picked = p; break; }
  }
  return { ...state, pets: [...state.pets, picked.id] };
}

/**
 * Bank whole fish into resources, carry the fractional remainder, then roll a pet catch.
 * An EMPTY creel banks nothing and NEVER rolls (no free pets).
 */
export function collectCreel(state: GameState, rng: Rng): GameState {
  const bankFish = Math.floor(state.storage.creel.fish);
  if (bankFish <= 0) return state;
  const banked: GameState = {
    ...state,
    resources: { ...state.resources, fish: state.resources.fish + bankFish },
    storage: { ...state.storage, creel: { fish: state.storage.creel.fish - bankFish } },
  };
  return rollCatch(banked, CATCH_CHANCE, rng);
}
```

- [ ] **Step 4: Barrel + idle wiring.**
  1. In `src/engine/index.ts` add `export * from './lake';` after the `./town` line.
  2. In `src/engine/idle.ts`: add `import { accrueCreel } from './lake';` and, in `applyElapsed`, add `next = accrueCreel(next, elapsedSec);` immediately after the `accrueSatchel` line.

  (No cycle: `idle → lake → forest/creatures/content`; nothing imports `idle` except the barrel.)

- [ ] **Step 5: Run to verify pass.**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites pass (80 existing + the new lake suite so far).

- [ ] **Step 6: Commit.**

```bash
git add src/engine/lake.ts src/engine/index.ts src/engine/idle.ts test/engine/lake.test.ts
git commit -m "feat(lake): pure engine — fishing accrual (creel) + chance pet catch, wired into applyElapsed

regression check: npx vitest run test/engine/lake.test.ts"
```

---

### Task 3: Engine `lake.ts` — habitats (directed discovery, TDD)

**Files:**
- Test: `test/engine/lake.test.ts` (append)
- Modify: `src/engine/lake.ts` (append habitat functions)

- [ ] **Step 1: Write the failing tests.** Append to `test/engine/lake.test.ts` (add these imports at the top: `import { getHabitat, HABITATS } from '../../src/engine/content';` and `import { SPECIES } from '../../src/engine';` and `import { habitatStatus, canBuildHabitat, buildHabitat, collectHabitat } from '../../src/engine/lake';`):

```ts
function richFish(): GameState {
  return { ...createInitialState(0), resources: { gold: 10_000, wood: 10_000, acorns: 10_000, fish: 10_000 } };
}

describe('habitatStatus', () => {
  it('is unbuilt initially and for unknown ids', () => {
    expect(habitatStatus(createInitialState(0), 'lilypads', 0)).toBe('unbuilt');
    expect(habitatStatus(createInitialState(0), 'nope', 0)).toBe('unbuilt');
  });
  it('unbuilt → attracting → ready → done across time and discovery', () => {
    const def = getHabitat('lilypads')!;
    let s = buildHabitat(richFish(), 'lilypads', 1000);
    expect(habitatStatus(s, 'lilypads', 1000)).toBe('attracting');
    const readyAt = 1000 + def.attractSec * 1000;
    expect(habitatStatus(s, 'lilypads', readyAt)).toBe('ready');
    s = collectHabitat(s, 'lilypads', readyAt);
    expect(habitatStatus(s, 'lilypads', readyAt)).toBe('done');
  });
});

describe('buildHabitat', () => {
  it('pays the exact cost across all resources and stamps builtAt', () => {
    const s = buildHabitat(richFish(), 'reedbed', 5000); // cost: fish 40, wood 20
    expect(s.resources.fish).toBe(10_000 - 40);
    expect(s.resources.wood).toBe(10_000 - 20);
    expect(s.resources.gold).toBe(10_000);
    expect(s.habitats.find((h) => h.id === 'reedbed')!.builtAt).toBe(5000);
  });
  it('is a no-op when unaffordable, already built, or unknown', () => {
    const broke = createInitialState(0); // 0 fish
    expect(buildHabitat(broke, 'lilypads', 0)).toBe(broke);
    const built = buildHabitat(richFish(), 'lilypads', 1);
    expect(buildHabitat(built, 'lilypads', 2)).toBe(built);
    const s = richFish();
    expect(buildHabitat(s, 'nope', 0)).toBe(s);
  });
  it('canBuildHabitat matches build behaviour', () => {
    expect(canBuildHabitat(richFish(), 'lilypads')).toBe(true);
    expect(canBuildHabitat(createInitialState(0), 'lilypads')).toBe(false);
    expect(canBuildHabitat(richFish(), 'nope')).toBe(false);
  });
});

describe('collectHabitat', () => {
  it('is a no-op unless ready', () => {
    const s = buildHabitat(richFish(), 'lilypads', 1000);
    expect(collectHabitat(s, 'lilypads', 1000)).toBe(s); // attracting
    const fresh = createInitialState(0);
    expect(collectHabitat(fresh, 'lilypads', 0)).toBe(fresh); // unbuilt
  });
  it('discovers exactly the target species and spawns one creature when ready', () => {
    const def = getHabitat('lilypads')!;
    const built = buildHabitat(richFish(), 'lilypads', 1000);
    const readyAt = 1000 + def.attractSec * 1000;
    const before = built.creatures.length;
    const after = collectHabitat(built, 'lilypads', readyAt);
    expect(after.discovered).toContain(def.attracts);
    expect(after.creatures.length).toBe(before + 1);
    expect(after.creatures.some((c) => c.species === def.attracts)).toBe(true);
  });
  it('is idempotent — a second collect is a no-op (status is done)', () => {
    const def = getHabitat('lilypads')!;
    const readyAt = 1000 + def.attractSec * 1000;
    const once = collectHabitat(buildHabitat(richFish(), 'lilypads', 1000), 'lilypads', readyAt);
    expect(collectHabitat(once, 'lilypads', readyAt)).toBe(once);
  });
});

describe('habitat content integrity', () => {
  it('every habitat targets a known fish-affinity species', () => {
    for (const h of HABITATS) {
      expect(SPECIES[h.attracts]).toBeTruthy();
      expect(SPECIES[h.attracts].affinity).toBe('fish');
    }
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run test/engine/lake.test.ts`
Expected: FAIL — `habitatStatus`/`buildHabitat`/`collectHabitat`/`canBuildHabitat` are not exported.

- [ ] **Step 3: Implement.** Append to `src/engine/lake.ts` (and extend its content import to add `HABITATS`, and add `makeCreature` to the creatures import):

```ts
// extend existing imports:
//   from './content'  → add  HABITATS
//   from './creatures' → add makeCreature   (i.e. `import { DISCOVERY_WEIGHT, makeCreature } from './creatures';`)

export type HabitatStatus = 'unbuilt' | 'attracting' | 'ready' | 'done';

/** Derived status — no separate "collected" flag (a water species is discovered ONLY via habitat). */
export function habitatStatus(state: GameState, id: string, now: number): HabitatStatus {
  const def = HABITATS.find((h) => h.id === id);
  const h = state.habitats.find((x) => x.id === id);
  if (!def || !h) return 'unbuilt';
  if (state.discovered.includes(def.attracts)) return 'done';
  if (h.builtAt === null) return 'unbuilt';
  return now >= h.builtAt + def.attractSec * 1000 ? 'ready' : 'attracting';
}

export function canBuildHabitat(state: GameState, id: string): boolean {
  const def = HABITATS.find((h) => h.id === id);
  const h = state.habitats.find((x) => x.id === id);
  if (!def || !h || h.builtAt !== null || state.discovered.includes(def.attracts)) return false;
  const r = state.resources;
  return (
    r.gold >= (def.cost.gold ?? 0) &&
    r.wood >= (def.cost.wood ?? 0) &&
    r.acorns >= (def.cost.acorns ?? 0) &&
    r.fish >= (def.cost.fish ?? 0)
  );
}

/** Pay cost + stamp builtAt. No-op (same ref) unless unbuilt & affordable. */
export function buildHabitat(state: GameState, id: string, now: number): GameState {
  if (!canBuildHabitat(state, id)) return state;
  const def = HABITATS.find((h) => h.id === id)!;
  return {
    ...state,
    resources: {
      gold: state.resources.gold - (def.cost.gold ?? 0),
      wood: state.resources.wood - (def.cost.wood ?? 0),
      acorns: state.resources.acorns - (def.cost.acorns ?? 0),
      fish: state.resources.fish - (def.cost.fish ?? 0),
    },
    habitats: state.habitats.map((h) => (h.id === id ? { ...h, builtAt: now } : h)),
  };
}

/** DETERMINISTIC directed discovery: on 'ready', discover the target + spawn it. No rng. No-op otherwise. */
export function collectHabitat(state: GameState, id: string, now: number): GameState {
  if (habitatStatus(state, id, now) !== 'ready') return state;
  const def = HABITATS.find((h) => h.id === id)!;
  return {
    ...state,
    creatures: [...state.creatures, makeCreature(def.attracts)],
    discovered: [...state.discovered, def.attracts],
  };
}
```

- [ ] **Step 4: Run to verify pass.**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all pass.

- [ ] **Step 5: Commit.**

```bash
git add src/engine/lake.ts test/engine/lake.test.ts
git commit -m "feat(lake): habitats — directed, deterministic water-creature discovery (build → attract → collect)

regression check: npx vitest run test/engine/lake.test.ts"
```

---

### Task 4: Forest random-roll excludes water creatures (TDD)

**Files:**
- Test: `test/engine/lake.test.ts` (append)
- Modify: `src/engine/creatures.ts` (`rollDiscovery` pool filter)

- [ ] **Step 1: Write the failing test.** Append to `test/engine/lake.test.ts` (add `import { rollDiscovery } from '../../src/engine/creatures';` at the top):

```ts
describe('rollDiscovery excludes water creatures (directed-only)', () => {
  it('never randomly discovers a fish-affinity species, even when only water species remain', () => {
    const land = Object.values(SPECIES).filter((sp) => sp.affinity !== 'fish').map((sp) => sp.id);
    const s = { ...createInitialState(0), discovered: land };
    const after = rollDiscovery(s, 1, () => 0); // chance 1; land-only pool must be empty → no-op
    expect(after).toBe(s);
    expect(after.discovered.some((id) => SPECIES[id].affinity === 'fish')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run test/engine/lake.test.ts`
Expected: FAIL — `rollDiscovery` currently pools ALL undiscovered species, so it discovers a water species and `after !== s`.

- [ ] **Step 3: Implement.** In `src/engine/creatures.ts` `rollDiscovery`, change the pool line to:

```ts
  const pool = Object.values(SPECIES).filter(
    (sp) => !state.discovered.includes(sp.id) && sp.affinity !== 'fish',
  );
```

- [ ] **Step 4: Run to verify pass.**

Run: `npx tsc --noEmit && npm test`
Expected: all pass — the existing `creatures.test.ts` discovery tests still hold (land species unaffected).

- [ ] **Step 5: Commit.**

```bash
git add src/engine/creatures.ts test/engine/lake.test.ts
git commit -m "feat(lake): forest random discovery excludes water creatures — lake stays directed-only

regression check: npx vitest run test/engine/lake.test.ts test/engine/creatures.test.ts"
```

---

### Task 5: Save migration → v4 (TDD)

**Files:**
- Test: `test/persistence/save.test.ts` (edit 1 assertion + append a describe block)
- Modify: `src/persistence/save.ts`

- [ ] **Step 1: Adjust + extend tests.** In `test/persistence/save.test.ts`:
  1. Add `HABITATS` to the engine import (line 2): `import { createInitialState, plantCrop, SPECIES, HABITATS } from '../../src/engine';`
  2. Change line 57 `expect(SAVE_VERSION).toBe(3);` → `expect(SAVE_VERSION).toBe(4);`
  3. Append:

```ts
describe('v3 -> v4 migration', () => {
  it('backfills fish, creel, habitats, pets on a v3 (pre-lake) save', () => {
    const base = createInitialState(0) as Record<string, unknown>;
    const v3State = {
      ...base,
      resources: { gold: 1, wood: 2, acorns: 3 },                          // no fish
      storage: { barn: { amount: 0 }, satchel: { wood: 0, acorn: 0 } },    // no creel
    } as Record<string, unknown>;
    delete v3State.habitats;
    delete v3State.pets;
    const restored = deserialize(JSON.stringify({ version: 3, state: v3State }));
    expect(restored.resources.fish).toBe(0);
    expect(restored.storage.creel).toEqual({ fish: 0 });
    expect(restored.habitats.length).toBe(HABITATS.length);
    expect(restored.habitats.every((h) => h.builtAt === null)).toBe(true);
    expect(restored.pets).toEqual([]);
  });

  it('chains v1 -> v4: forest, upgrades, AND lake fields all present', () => {
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
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 }); // v2
    expect(s.upgrades).toEqual({});                            // v3
    expect(s.resources.fish).toBe(0);                          // v4
    expect(s.storage.creel).toEqual({ fish: 0 });             // v4
    expect(s.habitats.length).toBe(HABITATS.length);           // v4
    expect(s.pets).toEqual([]);                                // v4
  });

  it('preserves lake state on a current save (round-trip)', () => {
    const s0 = {
      ...createInitialState(0),
      resources: { gold: 0, wood: 0, acorns: 0, fish: 42 },
      pets: ['pondsnail'],
    };
    const round = deserialize(serialize(s0));
    expect(round.resources.fish).toBe(42);
    expect(round.pets).toEqual(['pondsnail']);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

Run: `npx vitest run test/persistence/save.test.ts`
Expected: FAIL — `SAVE_VERSION` is still 3 and the v3→v4 backfill doesn't exist.

- [ ] **Step 3: Implement.** In `src/persistence/save.ts`:
  1. Change `export const SAVE_VERSION = 3;` → `export const SAVE_VERSION = 4;`
  2. Add `HABITATS` to the content import: `import { DUNGEONS, STARTER_SPECIES, HABITATS } from '../engine/content';`
  3. Add the v4 branch to `migrate` (keep the earlier branches):

```ts
/** Additive migrations. v1 (farm) -> v2 (forest) -> v3 (town) -> v4 (lake). Idempotent. */
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);
  if (fromVersion < 3) s = { ...s, upgrades: s.upgrades ?? {} };
  if (fromVersion < 4) s = addLakeFields(s);
  return s;
}
```

  4. Add the backfill helper (next to `addForestFields`):

```ts
function addLakeFields(old: GameState): GameState {
  return {
    ...old,
    resources: { ...old.resources, fish: old.resources.fish ?? 0 },
    storage: { ...old.storage, creel: old.storage.creel ?? { fish: 0 } },
    habitats: old.habitats ?? HABITATS.map((h) => ({ id: h.id, builtAt: null })),
    pets: old.pets ?? [],
  };
}
```

- [ ] **Step 4: Run the full suite.**

Run: `npx tsc --noEmit && npm test`
Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add src/persistence/save.ts test/persistence/save.test.ts
git commit -m "feat(lake): save v4 — additive fish/creel/habitats/pets backfill, v1->v4 chain verified

regression check: npx vitest run test/persistence/save.test.ts"
```

---

### Task 6: Store actions

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Implement.** In `src/store/gameStore.ts`:
  1. Add `collectCreel, buildHabitat, collectHabitat` to the `from '../engine'` import list.
  2. Add `PetId` to the type import: `import type { GameState, CropId, SpeciesId, PetId } from '../engine/types';`
  3. Add to the `GameStore` interface (after `feedTreat`):

```ts
  collectFish: () => void;
  buildHabitat: (habitatId: string) => void;
  collectHabitat: (habitatId: string) => void;
  dismissCatch: () => void;
```

  4. Also add `lastCatch: PetId | null;` to the interface (after `lastDiscovery`).
  5. Add the `newlyCaught` helper next to `newlyDiscovered`:

```ts
/** The pet newly present in next.pets but not prev.pets, if any. */
function newlyCaught(prev: GameState, next: GameState): PetId | null {
  const added = next.pets.filter((id) => !prev.pets.includes(id));
  return added.length > 0 ? added[added.length - 1] : null;
}
```

  6. Inside the store factory, add a `commitWithCatch` next to `commitWithDiscovery`:

```ts
  /** Run a catch-capable action (creel collect), surfacing a new pet for the catch toast. */
  const commitWithCatch = (prev: GameState, next: GameState) => {
    const caught = newlyCaught(prev, next);
    if (get().loaded) persist(next);
    set(caught ? { state: next, lastCatch: caught } : { state: next });
  };
```

  7. Add `lastCatch: null,` to the returned initial store object (after `lastDiscovery: null,`).
  8. Add the actions (after `feedTreat`, before `dismissDiscovery`):

```ts
    collectFish: () => {
      const caught = applyElapsed(get().state, Date.now());
      commitWithCatch(caught, collectCreel(caught, Math.random));
    },

    buildHabitat: (habitatId) => {
      const now = Date.now();
      commit(buildHabitat(applyElapsed(get().state, now), habitatId, now));
    },

    collectHabitat: (habitatId) => {
      const now = Date.now();
      const caught = applyElapsed(get().state, now);
      commitWithDiscovery(caught, collectHabitat(caught, habitatId, now));
    },
```

  9. Add `dismissCatch: () => set({ lastCatch: null }),` (after `dismissDiscovery`).

  (The store method keys `buildHabitat`/`collectHabitat` do not shadow the imported engine
  functions — object property names are not lexical bindings, so the calls inside resolve to the
  imports. This matches how `collectForage` calls `collectSatchel` etc.)

- [ ] **Step 2: Verify green.**

Run: `npx tsc --noEmit && npm test`
Expected: clean/pass (the store has no unit tests; tsc is the gate).

- [ ] **Step 3: Commit.**

```bash
git add src/store/gameStore.ts
git commit -m "feat(lake): store actions — collectFish, buildHabitat, collectHabitat + lastCatch toast state

regression check: npx tsc --noEmit"
```

---

### Task 7: UI — Lake tab, cards, toast, and existing-component edits

zustand v5 rule binds every selector below: stable slices or primitives only — never a fresh array/object from a selector.

**Files:**
- Create: `src/ui/components/CreelCard.tsx`
- Create: `src/ui/components/HabitatCard.tsx`
- Create: `src/ui/components/CatchToast.tsx`
- Create: `app/lake.tsx`
- Modify: `app/_layout.tsx` (add the Lake tab)
- Modify: `src/ui/components/ResourceBar.tsx` (add 🐟)
- Modify: `src/ui/components/CreatureRoster.tsx` (filter prop + fish glyph)
- Modify: `src/ui/components/DiscoveryToast.tsx` (fish glyph)
- Modify: `src/ui/components/FriendsJournal.tsx` (fish affinity glyph + Pets section)

- [ ] **Step 1: Create `src/ui/components/CreelCard.tsx`:**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { creelCap } from '../../engine';

export function CreelCard() {
  const creel = useGameStore((s) => s.state.storage.creel);
  const cap = useGameStore((s) => creelCap(s.state));
  const collect = useGameStore((s) => s.collectFish);

  const fish = Math.floor(creel.fish);
  const pct = Math.min(100, Math.round((creel.fish / cap) * 100));
  const empty = fish === 0;

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>🪣 Creel</Text>
        <Pressable style={[styles.btn, empty && styles.btnDisabled]} disabled={empty} onPress={collect}>
          <Text style={styles.btnText}>Collect</Text>
        </Pressable>
      </View>
      <Text style={styles.meterSub}>🐟 {fish}   ({pct}% full)</Text>
      <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterSub: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 6 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 2: Create `src/ui/components/HabitatCard.tsx`:**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { getHabitat, habitatStatus, canBuildHabitat, SPECIES } from '../../engine';
import type { Resources } from '../../engine';
import { CreatureIcon } from './CreatureIcon';

function fmt(sec: number): string {
  if (sec <= 0) return 'ready';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function costLine(cost: Partial<Resources>): string {
  const parts: string[] = [];
  if (cost.fish) parts.push(`${cost.fish} 🐟`);
  if (cost.gold) parts.push(`${cost.gold} 🪙`);
  if (cost.wood) parts.push(`${cost.wood} 🪵`);
  if (cost.acorns) parts.push(`${cost.acorns} 🌰`);
  return parts.join(' · ');
}

export function HabitatCard({ habitatId, now }: { habitatId: string; now: number }) {
  const def = getHabitat(habitatId)!;
  const state = useGameStore((s) => s.state);
  const build = useGameStore((s) => s.buildHabitat);
  const collect = useGameStore((s) => s.collectHabitat);

  // Derive from the already-subscribed stable `state` — never compute in the selector.
  const status = habitatStatus(state, habitatId, now);
  const h = state.habitats.find((x) => x.id === habitatId)!;
  const remaining = h.builtAt ? Math.ceil((h.builtAt + def.attractSec * 1000 - now) / 1000) : 0;
  const affordable = canBuildHabitat(state, habitatId);
  const sp = SPECIES[def.attracts];

  return (
    <View style={cards.card}>
      <View style={styles.header}>
        <Text style={cards.title}>{def.emoji} {def.name}</Text>
        {status === 'done' && <CreatureIcon speciesId={sp.id} emoji={sp.emoji} size={20} />}
      </View>

      {status === 'unbuilt' && (
        <>
          <Text style={styles.sub}>Build to attract a shy pond-dweller ({fmt(def.attractSec)})</Text>
          <View style={styles.footer}>
            <Text style={styles.cost}>{costLine(def.cost)}</Text>
            <Pressable
              style={[styles.btn, !affordable && styles.btnDisabled]}
              disabled={!affordable}
              onPress={() => build(habitatId)}
            >
              <Text style={styles.btnText}>Build</Text>
            </Pressable>
          </View>
        </>
      )}

      {status === 'attracting' && (
        <>
          <Text style={styles.sub}>Attracting… someone's getting curious</Text>
          <Text style={styles.timer}>⏳ {fmt(remaining)}</Text>
        </>
      )}

      {status === 'ready' && (
        <Pressable style={styles.btn} onPress={() => collect(habitatId)}>
          <Text style={styles.btnText}>✨ A friend arrived!</Text>
        </Pressable>
      )}

      {status === 'done' && <Text style={styles.sub}>{sp.name} lives here 💚</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  timer: { color: theme.accent, fontSize: 18, fontWeight: '700', marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cost: { color: theme.text, fontSize: 13 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 3: Create `src/ui/components/CatchToast.tsx`:**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { PETS } from '../../engine';

export function CatchToast() {
  const petId = useGameStore((s) => s.lastCatch);
  const dismiss = useGameStore((s) => s.dismissCatch);
  if (!petId) return null;
  const pet = PETS[petId];

  return (
    <Pressable style={styles.overlay} onPress={dismiss}>
      <View style={styles.card}>
        <Text style={styles.spark}>🎣 You caught a critter! 🎣</Text>
        <Text style={styles.icon}>{pet.emoji}</Text>
        <Text style={styles.name}>{pet.name}</Text>
        <Text style={styles.rarity}>{pet.rarity} · a cozy pet</Text>
        <Text style={styles.tap}>tap to continue</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: theme.card, borderColor: theme.accent, borderWidth: 2, borderRadius: 18,
    padding: 24, alignItems: 'center', width: '80%' },
  spark: { color: theme.accent, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  icon: { fontSize: 56, lineHeight: 64, marginVertical: 8 },
  name: { color: theme.text, fontSize: 22, fontWeight: '800' },
  rarity: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  tap: { color: theme.textDim, fontSize: 11, marginTop: 16 },
});
```

- [ ] **Step 4: Edit `src/ui/components/CreatureRoster.tsx`** — add a filter/labels prop (default = land creatures) and a fish-safe glyph. Replace the component signature + the first two hooks + the `status` glyph, and add the empty-state + glyph map:

  1. Add `import type { Creature } from '../../engine/types';` at the top.
  2. Add above the component: `const FORAGE_GLYPH = { wood: '🪵', acorn: '🌰', fish: '🐟' } as const;`
  3. Change the signature and top of the function to:

```tsx
export function CreatureRoster({
  filter = (c: Creature) => c.affinity !== 'fish',
  title = '🐿️ Creatures',
  subtitle = 'Tap to send foraging (🪵/🌰 by nature); dungeon teams are set below',
  emptyLabel,
}: {
  filter?: (c: Creature) => boolean;
  title?: string;
  subtitle?: string;
  emptyLabel?: string;
} = {}) {
  const creatures = useGameStore((s) => s.state.creatures);
  const assignTo = useGameStore((s) => s.assignCreatureTo);
  const shown = creatures.filter(filter);
```

  4. Replace the two hardcoded strings in the JSX: `<Text style={cards.title}>{title}</Text>` and `<Text style={cards.sub}>{subtitle}</Text>`.
  5. Change `{creatures.map((c) => {` → `{shown.length === 0 && emptyLabel && <Text style={cards.sub}>{emptyLabel}</Text>}` on its own line, then `{shown.map((c) => {`.
  6. Change the `status` line's glyph to use the map:

```tsx
        const status = inDungeon ? `delving ${dungeonName ?? '…'}` : foraging ? `foraging ${FORAGE_GLYPH[c.affinity]}` : 'resting';
```

  (Forest calls `<CreatureRoster />` with no args — the `= {}` default keeps it land-only, unchanged.)

- [ ] **Step 5: Edit `src/ui/components/DiscoveryToast.tsx`** — fish-safe forage glyph:
  1. Add above the component: `const FORAGE_GLYPH = { wood: '🪵', acorn: '🌰', fish: '🐟' } as const;`
  2. Change line 21 to: `<Text style={styles.rarity}>{sp.rarity} · forages {FORAGE_GLYPH[sp.affinity]}</Text>`

- [ ] **Step 6: Edit `src/ui/components/FriendsJournal.tsx`** — fish affinity glyph + a Pets section:
  1. Change `const AFFINITY_EMOJI = { wood: '🪵', acorn: '🌰' } as const;` → `const AFFINITY_EMOJI = { wood: '🪵', acorn: '🌰', fish: '🐟' } as const;`
  2. Extend the engine import: `import { SPECIES, PETS, PET_IDS } from '../../engine';`
  3. Add a pets slice after the `discovered` slice: `const pets = useGameStore((s) => s.state.pets);`
  4. Immediately before the closing `</View>` of the outer wrapper (after the creatures `grid` View), add:

```tsx
      <View style={cards.card}>
        <Text style={cards.title}>🐾 Pets</Text>
        <Text style={cards.sub}>{pets.length} / {PET_IDS.length} caught</Text>
      </View>
      <View style={styles.grid}>
        {PET_IDS.map((id) => {
          const pet = PETS[id];
          const caught = pets.includes(id);
          if (!caught) {
            return (
              <View key={id} style={[styles.cell, styles.cellLocked]}>
                <Text style={styles.lockGlyph}>❔</Text>
                <Text style={styles.name}>???</Text>
              </View>
            );
          }
          return (
            <View key={id} style={styles.cell}>
              <Text style={styles.lockGlyph}>{pet.emoji}</Text>
              <Text style={styles.name}>{pet.name}</Text>
              <Text style={[styles.rarity, { color: RARITY_COLOR[pet.rarity] }]}>• {pet.rarity}</Text>
            </View>
          );
        })}
      </View>
```

  (Pets render as an emoji `<Text>` — they have no sprite registry. `RARITY_COLOR` is already imported.)

- [ ] **Step 7: Edit `src/ui/components/ResourceBar.tsx`** — add fish after acorns:

```tsx
      <Text style={styles.item}>🐟 {r.fish}</Text>
```

- [ ] **Step 8: Create `app/lake.tsx`:**

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';
import { HABITATS } from '../src/engine';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { CreelCard } from '../src/ui/components/CreelCard';
import { CreatureRoster } from '../src/ui/components/CreatureRoster';
import { HabitatCard } from '../src/ui/components/HabitatCard';
import { DiscoveryToast } from '../src/ui/components/DiscoveryToast';
import { CatchToast } from '../src/ui/components/CatchToast';

export default function Lake() {
  const tick = useGameStore((s) => s.tick);
  const [now, setNow] = useState(() => Date.now());

  // Live creel fill + habitat countdowns; hard catch-up on foreground.
  useEffect(() => {
    const interval = setInterval(() => { const t = Date.now(); tick(t); setNow(t); }, 1000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { const t = Date.now(); tick(t); setNow(t); }
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [tick]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <CreelCard />
        <CreatureRoster
          filter={(c) => c.affinity === 'fish'}
          title="🐟 Water Friends"
          subtitle="Tap to send fishing — they fill the creel"
          emptyLabel="Build a habitat to attract your first water friend."
        />
        {HABITATS.map((hb) => (
          <HabitatCard key={hb.id} habitatId={hb.id} now={now} />
        ))}
      </ScrollView>
      <DiscoveryToast />
      <CatchToast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
```

- [ ] **Step 9: Register the tab.** In `app/_layout.tsx`, add after the Town screen line:

```tsx
        <Tabs.Screen name="lake"    options={{ title: '🎣 Lake' }} />
```

- [ ] **Step 10: Verify green.**

Run: `npx tsc --noEmit && npm test`
Expected: clean/pass.

- [ ] **Step 11: Commit.**

```bash
git add src/ui/components/CreelCard.tsx src/ui/components/HabitatCard.tsx src/ui/components/CatchToast.tsx app/lake.tsx app/_layout.tsx src/ui/components/ResourceBar.tsx src/ui/components/CreatureRoster.tsx src/ui/components/DiscoveryToast.tsx src/ui/components/FriendsJournal.tsx
git commit -m "feat(lake): Lake tab — creel, habitats, catch toast, water roster + fish glyphs & Pets journal

regression check: npx tsc --noEmit && npm test"
```

---

### Task 8: Live browser QA (main session, not a subagent)

**Files:** none (temporary content tweaks reverted with `git checkout`).

- [ ] **Step 1:** From the worktree, `npx expo start --web --port 8091` (NO `CI=1` — it disables rebuilds). If bundles 404, confirm the `node_modules` symlink exists.
- [ ] **Step 2:** Browse `http://localhost:8091/lake`: screen mounts (no "getSnapshot should be cached" crash), Creel card + "Water Friends" empty-state + 4 habitat cards render. ResourceBar shows 🐟.
- [ ] **Step 3:** Watch the creel fill live (rod base ~0.05/s); after a few seconds Collect enables. Tap Collect → 🐟 in ResourceBar rises; creel resets toward 0.
- [ ] **Step 4:** Seed resources to test builds without waiting: temporarily set `resources: { gold: 2000, wood: 800, acorns: 400, fish: 500 }` in `src/engine/state.ts` `createInitialState`, clear site storage, reload `/lake`.
- [ ] **Step 5:** Build **Lily Pads** → fish −20; card flips to "Attracting… ⏳". To see the reveal without waiting 15 min, temporarily set `lilypads` `attractSec` to `5` in `content.ts`, reload; after 5 s the card shows "✨ A friend arrived!" → Collect → **DiscoveryToast** appears naming Ripple Frog; card flips to "Ripple Frog lives here 💚".
- [ ] **Step 6:** On `/lake`, the new Ripple Frog appears in "Water Friends" — tap to send it fishing; the fish rate/creel cap rise. On `/forest`, confirm the Ripple Frog is NOT in the land roster.
- [ ] **Step 7:** Pet catch: with a stocked creel, tap Collect repeatedly (25% each) until the **CatchToast** fires ("You caught a …"). Check `/friends` → the caught pet is revealed in the 🐾 Pets grid; others show ??? .
- [ ] **Step 8:** Persistence: reload `/lake` → fish, built/occupied habitats, and the water creature persist (save v4). Deep-link reload directly to `/lake` (not via Home) → no save wipe (Plan 4 hydration fix holds).
- [ ] **Step 9:** Console check: no errors/warnings on `/lake`, `/friends`, `/forest`.
- [ ] **Step 10:** Revert all seeds/tweaks: `git checkout src/engine/state.ts src/engine/content.ts`. Confirm `git status` clean except intended files.

---

## Self-review (done at write time)

- **Spec coverage:** fish/material/creel/habitats/pets types + content + initial state (T1); fishing accrual + pet catch engine (T2); habitat directed-discovery engine (T3); forest land-only roll filter (T4); save v4 additive migration (T5); store actions + catch toast state (T6); Lake tab + all UI incl. the DiscoveryToast/CreatureRoster/FriendsJournal/ResourceBar edits the skeptic flagged (T7); live QA incl. deep-link hydration + forest-exclusion checks (T8).
- **Skeptic fixes folded in:** the full `fish`/`creel` literal inventory incl. `save.ts addForestFields` (T1 Steps 4–5) and the 5 `town.test.ts` edits (T1 Step 6); `DiscoveryToast` fish glyph + mounted on the Lake screen (T7 Steps 5, 8); the "80 stay green after sanctioned test edits" reality (T1 Step 7).
- **No placeholders:** every code step shows complete code; every run step shows the command + expected result.
- **Type consistency:** `collectCreel`/`buildHabitat`/`collectHabitat`/`habitatStatus`/`canBuildHabitat`/`rollCatch`/`fishRatePerSec`/`creelCap`/`accrueCreel` signatures are identical across T2/T3 (engine), T6 (store), and T7 (UI); `HabitatStatus` union values (`unbuilt`/`attracting`/`ready`/`done`) match between T3 and the HabitatCard branches; `Partial<Resources>` cost shape matches `costLine` truthiness checks; store method names (`collectFish`/`buildHabitat`/`collectHabitat`/`dismissCatch`) match their T7 usages.
- **DRY/YAGNI:** creel reuses `forageRatePerSec`; pets reuse `DISCOVERY_WEIGHT`; CreelCard/HabitatCard/CatchToast mirror Satchel/Dungeon/DiscoveryToast; no lake upgrades (deferred). Out-of-scope items untouched.
```
