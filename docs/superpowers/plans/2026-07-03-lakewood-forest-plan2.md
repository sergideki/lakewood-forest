# Lakewood Forest — Plan 2: Forest & Creatures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Forest — a second labor loop where discovered creatures forage a capped satchel of wood/acorns and delve no-fail timed dungeons, with rarity-weighted discovery that auto-joins new creatures and passive XP leveling.

**Architecture:** Extend the Plan-1 pure engine (`src/engine/`, RN-free, vitest-tested). Each creature carries one `assignment` field (`idle | forage | dungeon`) — the single source of truth. Foraging is continuous capped accrual (mirrors the barn); dungeon runs complete by timer and are collected as a discrete action. Discovery and loot rolls use an **injected `rng: () => number`** (default `Math.random`, faked in tests) so the engine stays deterministic. A thin Zustand store wraps new actions; the Forest tab renders warm dashboard cards reusing the Plan-1 theme.

**Tech Stack:** Expo (managed) · TypeScript · expo-router · Zustand (+ persist) · AsyncStorage · vitest (engine tests) · EAS Build (APK).

**Spec:** `docs/superpowers/specs/2026-07-03-lakewood-forest-plan2-design.md`.

**Branch:** create `feat/forest-plan2` off `main` before Task 1 (`git switch -c feat/forest-plan2`). Solo personal repo — a branch, not a worktree, is sufficient.

---

## File Structure (built/modified by this plan)

```
lakewood/
├── app/
│   └── forest.tsx               # MODIFY — replace ComingSoon with the Forest dashboard
├── src/
│   ├── engine/
│   │   ├── types.ts             # MODIFY — Rarity, SpeciesId, Rng, Creature, Species, Dungeon, satchel, new GameState fields
│   │   ├── content.ts           # MODIFY — add SPECIES + DUNGEONS tables
│   │   ├── state.ts             # MODIFY — seed 2 starter creatures, satchel, dungeons, discovered
│   │   ├── creatures.ts         # CREATE — makeCreature, forage output, XP/level, teamPower, rollDiscovery, dripForagerXp
│   │   ├── forest.ts            # CREATE — satchelCap, forageRatePerSec, accrueSatchel, collectSatchel, assignCreature, startRun, isRunReady, collectRun
│   │   ├── idle.ts              # MODIFY — applyElapsed extends to satchel accrual + forager XP
│   │   └── index.ts             # MODIFY — export creatures + forest
│   ├── persistence/
│   │   └── save.ts              # MODIFY — SAVE_VERSION=2 + additive v1→v2 migration
│   ├── store/
│   │   └── gameStore.ts         # MODIFY — assignCreature/startRun/collectRun/collectSatchel + lastDiscovery
│   └── ui/
│       └── components/
│           ├── ResourceBar.tsx      # MODIFY — show wood + acorns
│           ├── SatchelCard.tsx      # CREATE
│           ├── CreatureRoster.tsx   # CREATE
│           ├── DungeonCard.tsx      # CREATE
│           └── DiscoveryToast.tsx   # CREATE
├── test/
│   ├── engine/creatures.test.ts # CREATE
│   ├── engine/forest.test.ts    # CREATE
│   ├── engine/idle.test.ts      # MODIFY — satchel accrual + forager XP through applyElapsed
│   └── persistence/save.test.ts # MODIFY — v1→v2 migration
```

**Canonical signatures (fixed — reused across tasks):**
- `type Rarity = 'common' | 'uncommon' | 'rare'` · `type SpeciesId = string` · `type Rng = () => number`
- `makeCreature(species: SpeciesId): Creature`
- `creatureForageOutput(c: Creature): number` · `levelMult(level: number): number` · `xpForLevel(level: number, rarity: Rarity): number`
- `grantXp(c: Creature, amount: number): Creature` · `teamPower(state: GameState, ids: string[]): number`
- `rollDiscovery(state: GameState, chance: number, rng: Rng): GameState` · `dripForagerXp(state: GameState, elapsedSec: number): GameState`
- `forageRatePerSec(state: GameState, material: 'wood' | 'acorn'): number` · `satchelCap(state: GameState): number`
- `accrueSatchel(state: GameState, elapsedSec: number): GameState` · `collectSatchel(state: GameState, rng: Rng): GameState`
- `assignCreature(state: GameState, creatureId: string, to: 'idle' | 'forage'): GameState`
- `startRun(state: GameState, dungeonId: string, creatureIds: string[], now: number): GameState`
- `isRunReady(state: GameState, dungeonId: string, now: number): boolean`
- `collectRun(state: GameState, dungeonId: string, rng: Rng, now: number): GameState`

**Test helper (used throughout):** a sequenced RNG so rolls are deterministic.

```ts
// put at the top of test files that need it
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}
```

---

## Task 1: Types + content tables (Species & Dungeons)

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/content.ts`
- Test: `test/engine/forest.test.ts` (created here, extended later)

- [ ] **Step 1: Write the failing test**

Create `test/engine/forest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SPECIES, DUNGEONS } from '../../src/engine';

describe('content tables', () => {
  it('has ~10 species, each with rarity + wood|acorn affinity', () => {
    const ids = Object.keys(SPECIES);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const s = SPECIES[id];
      expect(s.id).toBe(id);
      expect(['common', 'uncommon', 'rare']).toContain(s.rarity);
      expect(['wood', 'acorn']).toContain(s.affinity);
      expect(s.emoji.length).toBeGreaterThan(0);
    }
  });

  it('includes the two starters fernling + pebblepup', () => {
    expect(SPECIES.fernling).toBeTruthy();
    expect(SPECIES.pebblepup).toBeTruthy();
  });

  it('has 3 dungeons with ascending duration + recommended power', () => {
    expect(DUNGEONS).toHaveLength(3);
    for (let i = 1; i < DUNGEONS.length; i++) {
      expect(DUNGEONS[i].durationSec).toBeGreaterThan(DUNGEONS[i - 1].durationSec);
      expect(DUNGEONS[i].recommendedPower).toBeGreaterThan(DUNGEONS[i - 1].recommendedPower);
    }
    for (const d of DUNGEONS) {
      expect(d.loot.gold).toBeGreaterThan(0);
      expect(d.baseDiscoveryChance).toBeGreaterThan(0);
      expect(d.xpReward).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/forest.test.ts`
Expected: FAIL — `SPECIES` / `DUNGEONS` not exported.

- [ ] **Step 3: Add the new types**

Edit `src/engine/types.ts`. Add these exports (keep everything already there):

```ts
export type Rarity = 'common' | 'uncommon' | 'rare';
export type SpeciesId = string;
export type Material = 'wood' | 'acorn';

/** Injected randomness so engine rolls stay deterministic under test. */
export type Rng = () => number;

export interface Species {
  id: SpeciesId;
  name: string;
  emoji: string;
  rarity: Rarity;
  affinity: Material; // material it forages
}

export interface Creature {
  id: string;
  species: SpeciesId;
  name: string;
  emoji: string;
  rarity: Rarity;
  affinity: Material;
  level: number;
  xp: number;
  assignment: {
    type: 'idle' | 'forage' | 'dungeon';
    dungeonId: string | null;
    startedAt: number; // epoch ms; 0 when idle/forage
  };
}

export interface DungeonRun {
  creatureIds: string[];
  startedAt: number; // epoch ms
}

export interface DungeonState {
  id: string;
  activeRun: DungeonRun | null;
}

export interface Dungeon {
  id: string;
  name: string;
  emoji: string;
  durationSec: number;
  loot: { gold: number; wood: number; acorn: number };
  baseDiscoveryChance: number; // 0..1
  recommendedPower: number;
  xpReward: number; // XP lump per creature on completion
}
```

Change `Resources` to include wood + acorns:

```ts
export interface Resources {
  gold: number;
  wood: number;
  acorns: number;
}
```

Change `Storage` to add the satchel:

```ts
export interface Storage {
  barn: { amount: number };
  satchel: { wood: number; acorn: number };
}
```

Extend `GameState` with the three new collections (keep the existing fields):

```ts
export interface GameState {
  resources: Resources;
  plots: Plot[];
  villagers: Villager[];
  creatures: Creature[];
  storage: Storage;
  dungeons: DungeonState[];
  discovered: SpeciesId[];
  meta: Meta;
}
```

- [ ] **Step 4: Add the content tables**

Edit `src/engine/content.ts`. Keep `CROPS`/`CROP_IDS`; append:

```ts
import type { Species, SpeciesId, Dungeon } from './types';

export const SPECIES: Record<SpeciesId, Species> = {
  fernling:  { id: 'fernling',  name: 'Fernling',   emoji: '🌱', rarity: 'common',   affinity: 'acorn' },
  pebblepup: { id: 'pebblepup', name: 'Pebble Pup', emoji: '🐕', rarity: 'common',   affinity: 'wood'  },
  mossmouse: { id: 'mossmouse', name: 'Moss Mouse', emoji: '🐭', rarity: 'common',   affinity: 'acorn' },
  barkbug:   { id: 'barkbug',   name: 'Bark Bug',   emoji: '🐞', rarity: 'common',   affinity: 'wood'  },
  hedgehush: { id: 'hedgehush', name: 'Hedgehush',  emoji: '🦔', rarity: 'uncommon', affinity: 'acorn' },
  cedarcat:  { id: 'cedarcat',  name: 'Cedar Cat',  emoji: '🐈', rarity: 'uncommon', affinity: 'wood'  },
  lumifox:   { id: 'lumifox',   name: 'Lumi Fox',   emoji: '🦊', rarity: 'uncommon', affinity: 'acorn' },
  owlin:     { id: 'owlin',     name: 'Owlin',      emoji: '🦉', rarity: 'rare',     affinity: 'wood'  },
  stagheart: { id: 'stagheart', name: 'Stagheart',  emoji: '🦌', rarity: 'rare',     affinity: 'acorn' },
  emberkit:  { id: 'emberkit',  name: 'Ember Kit',  emoji: '🦝', rarity: 'rare',     affinity: 'wood'  },
};

export const STARTER_SPECIES: SpeciesId[] = ['fernling', 'pebblepup'];

export const DUNGEONS: Dungeon[] = [
  { id: 'hollow', name: 'Mossy Hollow',  emoji: '🍄', durationSec: 15 * 60,  loot: { gold: 20,  wood: 10,  acorn: 6  }, baseDiscoveryChance: 0.35, recommendedPower: 2,  xpReward: 30  },
  { id: 'grove',  name: 'Whisper Grove', emoji: '🌿', durationSec: 60 * 60,  loot: { gold: 80,  wood: 40,  acorn: 24 }, baseDiscoveryChance: 0.45, recommendedPower: 6,  xpReward: 80  },
  { id: 'deep',   name: 'Deepwood',      emoji: '🌲', durationSec: 4 * 3600, loot: { gold: 300, wood: 150, acorn: 90 }, baseDiscoveryChance: 0.60, recommendedPower: 14, xpReward: 200 },
];

export function getDungeon(id: string): Dungeon | undefined {
  return DUNGEONS.find((d) => d.id === id);
}
```

- [ ] **Step 5: Export from the barrel**

Edit `src/engine/index.ts`. Confirm it already has `export * from './content';` (Plan 1 added it). No change needed if present; if the content export is missing, add `export * from './content';`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- test/engine/forest.test.ts` then `npx tsc --noEmit`
Expected: content-table tests PASS. **tsc will now report errors** in `state.ts`/`save.ts`/`gameStore.ts`/`ResourceBar.tsx` because `Resources`/`Storage`/`GameState` changed shape — those are fixed in Tasks 2, 7, 8, 9. That is expected at this checkpoint; the forest test itself passes.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/content.ts src/engine/index.ts test/engine/forest.test.ts
git commit -m "feat(engine): forest types + species/dungeon content tables

regression check: npm test -- test/engine/forest.test.ts"
```

---

## Task 2: Initial state — starter creatures, satchel, dungeons, discovered

**Files:**
- Modify: `src/engine/state.ts`
- Modify: `src/engine/creatures.ts` (created minimally here for `makeCreature`; extended in Task 3)
- Modify: `src/engine/index.ts`
- Test: `test/engine/forest.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/forest.test.ts`:

```ts
import { createInitialState } from '../../src/engine';

describe('createInitialState (forest fields)', () => {
  it('starts with two idle starter creatures, empty satchel, 3 idle dungeons, both starters discovered', () => {
    const s = createInitialState(1000);
    expect(s.resources.wood).toBe(0);
    expect(s.resources.acorns).toBe(0);
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 });
    expect(s.creatures).toHaveLength(2);
    expect(s.creatures.map((c) => c.species).sort()).toEqual(['fernling', 'pebblepup']);
    expect(s.creatures.every((c) => c.assignment.type === 'idle' && c.level === 1 && c.xp === 0)).toBe(true);
    expect(s.dungeons.map((d) => d.id)).toEqual(['hollow', 'grove', 'deep']);
    expect(s.dungeons.every((d) => d.activeRun === null)).toBe(true);
    expect(s.discovered.sort()).toEqual(['fernling', 'pebblepup']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/forest.test.ts`
Expected: FAIL — `s.creatures` is undefined (old initial state).

- [ ] **Step 3: Add `makeCreature` (minimal creatures module)**

Create `src/engine/creatures.ts`:

```ts
import type { Creature, SpeciesId } from './types';
import { SPECIES } from './content';

/** Build a fresh level-1 idle creature instance for a species. */
export function makeCreature(species: SpeciesId): Creature {
  const sp = SPECIES[species];
  return {
    id: `cr-${species}`, // one instance per species (discovery pool is de-duped), so this is unique
    species,
    name: sp.name,
    emoji: sp.emoji,
    rarity: sp.rarity,
    affinity: sp.affinity,
    level: 1,
    xp: 0,
    assignment: { type: 'idle', dungeonId: null, startedAt: 0 },
  };
}
```

- [ ] **Step 4: Update `createInitialState`**

Rewrite `src/engine/state.ts`:

```ts
import type { GameState } from './types';
import { DUNGEONS, STARTER_SPECIES } from './content';
import { makeCreature } from './creatures';

export function createInitialState(now: number): GameState {
  return {
    resources: { gold: 0, wood: 0, acorns: 0 },
    plots: [
      { id: 'plot-1', crop: null },
      { id: 'plot-2', crop: null },
      { id: 'plot-3', crop: null },
    ],
    villagers: [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: null },
      { id: 'vil-2', name: 'Nan', emoji: '👵', assignedTo: null },
      { id: 'vil-3', name: 'Rowan', emoji: '🧔', assignedTo: null },
    ],
    creatures: STARTER_SPECIES.map(makeCreature),
    storage: { barn: { amount: 0 }, satchel: { wood: 0, acorn: 0 } },
    dungeons: DUNGEONS.map((d) => ({ id: d.id, activeRun: null })),
    discovered: [...STARTER_SPECIES],
    meta: { lastSeen: now },
  };
}
```

- [ ] **Step 5: Export creatures from the barrel**

Edit `src/engine/index.ts`, add:

```ts
export * from './creatures';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- test/engine/forest.test.ts`
Expected: PASS (content + initial-state forest tests green).

- [ ] **Step 7: Commit**

```bash
git add src/engine/state.ts src/engine/creatures.ts src/engine/index.ts test/engine/forest.test.ts
git commit -m "feat(engine): seed starter creatures + satchel + dungeons in initial state

regression check: npm test -- test/engine/forest.test.ts"
```

---

## Task 3: Creature progression — forage output, XP/level, team power

**Files:**
- Modify: `src/engine/creatures.ts`
- Test: `test/engine/creatures.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/engine/creatures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeCreature } from '../../src/engine';
import {
  creatureForageOutput,
  levelMult,
  xpForLevel,
  grantXp,
  teamPower,
} from '../../src/engine/creatures';
import { createInitialState } from '../../src/engine';

describe('levelMult', () => {
  it('is 1.0 at level 1 and +10% per level', () => {
    expect(levelMult(1)).toBeCloseTo(1.0, 5);
    expect(levelMult(3)).toBeCloseTo(1.2, 5);
  });
});

describe('creatureForageOutput', () => {
  it('scales with rarity and level', () => {
    const common = makeCreature('fernling');   // common, BASE 0.05 * 1 * 1
    expect(creatureForageOutput(common)).toBeCloseTo(0.05, 5);
    const rare = makeCreature('stagheart');     // rare mult 2.25
    expect(creatureForageOutput(rare)).toBeCloseTo(0.05 * 2.25, 5);
  });
});

describe('xpForLevel', () => {
  it('grows with level and rarity', () => {
    expect(xpForLevel(1, 'common')).toBe(100);
    expect(xpForLevel(2, 'common')).toBe(200);
    expect(xpForLevel(1, 'rare')).toBe(200); // rare curve x2
  });
});

describe('grantXp', () => {
  it('accumulates xp without leveling below the threshold', () => {
    const c = grantXp(makeCreature('fernling'), 50);
    expect(c.level).toBe(1);
    expect(c.xp).toBe(50);
  });

  it('levels up and carries the remainder', () => {
    const c = grantXp(makeCreature('fernling'), 130); // needs 100 for L1->L2, 30 remains
    expect(c.level).toBe(2);
    expect(c.xp).toBe(30);
  });

  it('can cross multiple levels at once', () => {
    // L1->L2 costs 100, L2->L3 costs 200 => 300 total lands exactly at L3 with 0
    const c = grantXp(makeCreature('fernling'), 300);
    expect(c.level).toBe(3);
    expect(c.xp).toBe(0);
  });

  it('is immutable', () => {
    const c0 = makeCreature('fernling');
    grantXp(c0, 500);
    expect(c0.xp).toBe(0);
    expect(c0.level).toBe(1);
  });
});

describe('teamPower', () => {
  it('sums rarityWeight * level over the given creatures', () => {
    let s = createInitialState(0); // fernling(common,L1)=1, pebblepup(common,L1)=1
    expect(teamPower(s, ['cr-fernling', 'cr-pebblepup'])).toBe(2);
    // level pebblepup to L2 => weight 1 * 2 = 2, total 3
    s = { ...s, creatures: s.creatures.map((c) => (c.id === 'cr-pebblepup' ? { ...c, level: 2 } : c)) };
    expect(teamPower(s, ['cr-fernling', 'cr-pebblepup'])).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/creatures.test.ts`
Expected: FAIL — `creatureForageOutput` / `levelMult` / `xpForLevel` / `grantXp` / `teamPower` not exported.

- [ ] **Step 3: Implement progression**

Append to `src/engine/creatures.ts`:

```ts
import type { GameState, Rarity } from './types';

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4 };
export const FORAGE_RARITY_MULT: Record<Rarity, number> = { common: 1, uncommon: 1.5, rare: 2.25 };
export const RARITY_XP_MULT: Record<Rarity, number> = { common: 1, uncommon: 1.5, rare: 2 };

export const BASE_FORAGE = 0.05; // items/sec at level 1, common

export function levelMult(level: number): number {
  return 1 + 0.1 * (level - 1);
}

/** Items/sec a single creature yields while foraging. */
export function creatureForageOutput(c: Creature): number {
  return BASE_FORAGE * FORAGE_RARITY_MULT[c.rarity] * levelMult(c.level);
}

/** XP needed to advance FROM `level` to `level+1`, scaled by rarity. */
export function xpForLevel(level: number, rarity: Rarity): number {
  return Math.round(100 * level * RARITY_XP_MULT[rarity]);
}

/** Add XP and auto-level across as many thresholds as the total allows. Immutable. */
export function grantXp(c: Creature, amount: number): Creature {
  let level = c.level;
  let xp = c.xp + Math.max(0, amount);
  while (xp >= xpForLevel(level, c.rarity)) {
    xp -= xpForLevel(level, c.rarity);
    level += 1;
  }
  return { ...c, level, xp };
}

/** Combined dungeon power of the named creatures. */
export function teamPower(state: GameState, ids: string[]): number {
  return state.creatures
    .filter((c) => ids.includes(c.id))
    .reduce((sum, c) => sum + RARITY_WEIGHT[c.rarity] * c.level, 0);
}
```

Note: `Creature` is already imported at the top of the file (from Task 2). Add `GameState, Rarity` to that import line rather than a duplicate import if your linter objects to two `import type` lines from `./types`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/engine/creatures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/creatures.ts test/engine/creatures.test.ts
git commit -m "feat(engine): creature forage output + XP/leveling + team power

regression check: npm test -- test/engine/creatures.test.ts"
```

---

## Task 4: Discovery roll + forager XP drip

**Files:**
- Modify: `src/engine/creatures.ts`
- Test: `test/engine/creatures.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/creatures.test.ts`:

```ts
import { rollDiscovery, dripForagerXp } from '../../src/engine/creatures';
import { assignCreature } from '../../src/engine/forest';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}

describe('rollDiscovery', () => {
  it('does nothing when the hit roll misses (rng >= chance)', () => {
    const s = createInitialState(0);
    const next = rollDiscovery(s, 0.5, seqRng([0.9]));
    expect(next.discovered).toEqual(s.discovered);
    expect(next.creatures).toHaveLength(2);
  });

  it('adds a new undiscovered species when the hit roll succeeds', () => {
    const s = createInitialState(0);
    // first rng < chance = hit; second rng selects within the weighted pool
    const next = rollDiscovery(s, 0.5, seqRng([0.0, 0.0]));
    expect(next.discovered.length).toBe(3);
    expect(next.creatures.length).toBe(3);
    const added = next.creatures.find((c) => !s.creatures.some((o) => o.id === c.id))!;
    expect(added.assignment.type).toBe('idle');
    expect(s.discovered).toContain(added.species) // sanity: it was NOT already discovered
      ? undefined
      : expect(next.discovered).toContain(added.species);
  });

  it('is a no-op when every species is already discovered', () => {
    let s = createInitialState(0);
    s = { ...s, discovered: Object.keys((globalThis as any).__SPECIES__ ?? {}) };
    // simpler: force all discovered via the real table
    const all = Object.keys(require('../../src/engine/content').SPECIES);
    s = { ...s, discovered: all };
    const next = rollDiscovery(s, 1.0, seqRng([0.0, 0.0]));
    expect(next.discovered.length).toBe(all.length);
    expect(next.creatures.length).toBe(s.creatures.length);
  });
});

describe('dripForagerXp', () => {
  it('grants xp only to foraging creatures over elapsed seconds', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');
    s = dripForagerXp(s, 100); // 0.02 * 100 = 2 xp
    const fern = s.creatures.find((c) => c.id === 'cr-fernling')!;
    const pebble = s.creatures.find((c) => c.id === 'cr-pebblepup')!;
    expect(fern.xp).toBeCloseTo(2, 5);
    expect(pebble.xp).toBe(0); // idle, no xp
  });
});
```

Note: the middle `rollDiscovery` test's ternary keeps the assertion robust regardless of which species the weighted pick returns; the key invariant is `discovered.length` grew by 1 with a fresh idle creature. Simplify to the length/idle assertions if the ternary reads awkwardly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/creatures.test.ts`
Expected: FAIL — `rollDiscovery` / `dripForagerXp` not exported (and `assignCreature` from forest not yet created — that arrives in Task 5; if this task is run before Task 5, temporarily assign via a hand-built state. Prefer running Task 5 first if your executor is strict about import order — but the functions are independent, so the recommended order is 3 → 4 → 5 with this test's `assignCreature` import satisfied once Task 5 lands. If red purely due to the missing forest import, proceed to Task 5 then re-run.)

- [ ] **Step 3: Implement discovery + XP drip**

Append to `src/engine/creatures.ts`:

```ts
import { SPECIES } from './content';

export const DISCOVERY_WEIGHT: Record<Rarity, number> = { common: 6, uncommon: 3, rare: 1 };
export const FORAGE_XP_PER_SEC = 0.02;

/**
 * With probability `chance`, discover a new (undiscovered) species — weighted toward common —
 * spawning a fresh idle creature and recording the species. Uses two rng draws: hit, then pick.
 */
export function rollDiscovery(state: GameState, chance: number, rng: Rng): GameState {
  if (rng() >= chance) return state;
  const pool = Object.values(SPECIES).filter((sp) => !state.discovered.includes(sp.id));
  if (pool.length === 0) return state;

  const totalWeight = pool.reduce((sum, sp) => sum + DISCOVERY_WEIGHT[sp.rarity], 0);
  let roll = rng() * totalWeight;
  let picked = pool[pool.length - 1];
  for (const sp of pool) {
    roll -= DISCOVERY_WEIGHT[sp.rarity];
    if (roll < 0) { picked = sp; break; }
  }

  return {
    ...state,
    creatures: [...state.creatures, makeCreature(picked.id)],
    discovered: [...state.discovered, picked.id],
  };
}

/** Give every foraging creature XP for `elapsedSec` seconds (auto-levels). Immutable. */
export function dripForagerXp(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const gain = FORAGE_XP_PER_SEC * elapsedSec;
  return {
    ...state,
    creatures: state.creatures.map((c) =>
      c.assignment.type === 'forage' ? grantXp(c, gain) : c,
    ),
  };
}
```

Add `Rng` to the `./types` type-import at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/engine/creatures.test.ts` (after Task 5 lands if the `assignCreature` import is unresolved)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/creatures.ts test/engine/creatures.test.ts
git commit -m "feat(engine): weighted discovery roll + forager XP drip

regression check: npm test -- test/engine/creatures.test.ts"
```

---

## Task 5: Forage — satchel cap, accrual, collect, assignment

**Files:**
- Create: `src/engine/forest.ts`
- Modify: `src/engine/index.ts`
- Test: `test/engine/forest.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/forest.test.ts`:

```ts
import {
  assignCreature,
  forageRatePerSec,
  satchelCap,
  accrueSatchel,
  collectSatchel,
} from '../../src/engine/forest';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0);
}

describe('assignCreature', () => {
  it('sets forage then back to idle, immutably', () => {
    const s0 = createInitialState(0);
    const s1 = assignCreature(s0, 'cr-fernling', 'forage');
    expect(s1.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('forage');
    expect(s0.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('idle');
    const s2 = assignCreature(s1, 'cr-fernling', 'idle');
    expect(s2.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('idle');
  });

  it('refuses to reassign a creature busy in a dungeon (no-op)', () => {
    let s = createInitialState(0);
    s = { ...s, creatures: s.creatures.map((c) =>
      c.id === 'cr-fernling' ? { ...c, assignment: { type: 'dungeon', dungeonId: 'hollow', startedAt: 1 } } : c) };
    const next = assignCreature(s, 'cr-fernling', 'forage');
    expect(next.creatures.find((c) => c.id === 'cr-fernling')!.assignment.type).toBe('dungeon');
  });
});

describe('forageRatePerSec', () => {
  it('sums output of creatures foraging the given material', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');  // acorn-affinity, 0.05/s
    s = assignCreature(s, 'cr-pebblepup', 'forage'); // wood-affinity, 0.05/s
    expect(forageRatePerSec(s, 'acorn')).toBeCloseTo(0.05, 5);
    expect(forageRatePerSec(s, 'wood')).toBeCloseTo(0.05, 5);
  });
});

describe('accrueSatchel + cap', () => {
  it('fills wood and acorn by their rates', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');  // acorn
    s = assignCreature(s, 'cr-pebblepup', 'forage'); // wood
    s = accrueSatchel(s, 100); // +5 each
    expect(s.storage.satchel.acorn).toBeCloseTo(5, 5);
    expect(s.storage.satchel.wood).toBeCloseTo(5, 5);
  });

  it('never lets wood + acorn exceed the cap', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');
    s = assignCreature(s, 'cr-pebblepup', 'forage');
    s = accrueSatchel(s, 10_000_000);
    expect(s.storage.satchel.wood + s.storage.satchel.acorn).toBeLessThanOrEqual(satchelCap(s) + 1e-6);
  });

  it('is a no-op on zero/negative elapsed', () => {
    let s = createInitialState(0);
    s = assignCreature(s, 'cr-fernling', 'forage');
    expect(accrueSatchel(s, 0).storage.satchel.acorn).toBe(0);
    expect(accrueSatchel(s, -5).storage.satchel.acorn).toBe(0);
  });
});

describe('collectSatchel', () => {
  it('banks whole wood + acorn into resources, carries the remainder, may discover', () => {
    let s = createInitialState(0);
    s = { ...s, storage: { ...s.storage, satchel: { wood: 12.4, acorn: 7.9 } } };
    const next = collectSatchel(s, seqRng([0.99])); // discovery misses
    expect(next.resources.wood).toBe(12);
    expect(next.resources.acorns).toBe(7);
    expect(next.storage.satchel.wood).toBeCloseTo(0.4, 5);
    expect(next.storage.satchel.acorn).toBeCloseTo(0.9, 5);
    expect(next.discovered).toEqual(s.discovered);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/forest.test.ts`
Expected: FAIL — module `../../src/engine/forest` not found.

- [ ] **Step 3: Implement the forage engine**

Create `src/engine/forest.ts`:

```ts
import type { GameState, Material, Rng } from './types';
import { creatureForageOutput, rollDiscovery } from './creatures';

export const SATCHEL_HOURS = 24;
export const SATCHEL_FLOOR = 200;
export const FORAGE_DISCOVERY_CHANCE = 0.15;

/** Items/sec produced for one material by all creatures foraging it. */
export function forageRatePerSec(state: GameState, material: Material): number {
  return state.creatures
    .filter((c) => c.assignment.type === 'forage' && c.affinity === material)
    .reduce((sum, c) => sum + creatureForageOutput(c), 0);
}

/** Combined satchel capacity = a day's worth of the current total forage rate, floored. */
export function satchelCap(state: GameState): number {
  const perSec = forageRatePerSec(state, 'wood') + forageRatePerSec(state, 'acorn');
  return Math.max(SATCHEL_FLOOR, Math.round(perSec * SATCHEL_HOURS * 3600));
}

/** Fill wood + acorn by their rates over `elapsedSec`, clamped so their sum <= cap. */
export function accrueSatchel(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const woodRate = forageRatePerSec(state, 'wood');
  const acornRate = forageRatePerSec(state, 'acorn');
  const cap = satchelCap(state);
  const { wood, acorn } = state.storage.satchel;
  const room = Math.max(0, cap - (wood + acorn));

  let gainWood = woodRate * elapsedSec;
  let gainAcorn = acornRate * elapsedSec;
  const totalGain = gainWood + gainAcorn;
  if (totalGain > room && totalGain > 0) {
    const scale = room / totalGain;
    gainWood *= scale;
    gainAcorn *= scale;
  }

  return {
    ...state,
    storage: { ...state.storage, satchel: { wood: wood + gainWood, acorn: acorn + gainAcorn } },
  };
}

/** Bank whole wood + acorn into resources, carry the fractional remainder, roll a discovery. */
export function collectSatchel(state: GameState, rng: Rng): GameState {
  const { wood, acorn } = state.storage.satchel;
  const bankWood = Math.floor(wood);
  const bankAcorn = Math.floor(acorn);
  const banked: GameState = {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood + bankWood,
      acorns: state.resources.acorns + bankAcorn,
    },
    storage: { ...state.storage, satchel: { wood: wood - bankWood, acorn: acorn - bankAcorn } },
  };
  return rollDiscovery(banked, FORAGE_DISCOVERY_CHANCE, rng);
}

/** Move a creature between idle and forage. No-op if it is currently in a dungeon. */
export function assignCreature(state: GameState, creatureId: string, to: 'idle' | 'forage'): GameState {
  return {
    ...state,
    creatures: state.creatures.map((c) => {
      if (c.id !== creatureId) return c;
      if (c.assignment.type === 'dungeon') return c; // locked until the run is collected
      return { ...c, assignment: { type: to, dungeonId: null, startedAt: 0 } };
    }),
  };
}
```

- [ ] **Step 4: Export from the barrel**

Edit `src/engine/index.ts`, add:

```ts
export * from './forest';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/engine/forest.test.ts test/engine/creatures.test.ts`
Expected: PASS (Task 4's `assignCreature`-dependent tests now resolve too).

- [ ] **Step 6: Commit**

```bash
git add src/engine/forest.ts src/engine/index.ts test/engine/forest.test.ts
git commit -m "feat(engine): forage rate + capped satchel accrual/collect + creature assignment

regression check: npm test -- test/engine/forest.test.ts test/engine/creatures.test.ts"
```

---

## Task 6: Dungeons — start, readiness, collect (soft power check)

**Files:**
- Modify: `src/engine/forest.ts`
- Test: `test/engine/forest.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/forest.test.ts`:

```ts
import { startRun, isRunReady, collectRun } from '../../src/engine/forest';
import { getDungeon } from '../../src/engine';

const HOLLOW = 'hollow';
const HOLLOW_MS = 15 * 60 * 1000;

describe('startRun', () => {
  it('marks creatures busy and opens the run', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    expect(s.dungeons.find((d) => d.id === HOLLOW)!.activeRun).toEqual({ creatureIds: ['cr-fernling'], startedAt: 1000 });
    expect(s.creatures.find((c) => c.id === 'cr-fernling')!.assignment).toEqual({ type: 'dungeon', dungeonId: HOLLOW, startedAt: 1000 });
  });

  it('is a no-op with an empty team, a busy creature, or an already-running dungeon', () => {
    const s0 = createInitialState(0);
    expect(startRun(s0, HOLLOW, [], 1000).dungeons.find((d) => d.id === HOLLOW)!.activeRun).toBeNull();
    const running = startRun(s0, HOLLOW, ['cr-fernling'], 1000);
    // pebblepup is free, but hollow already runs => no-op
    expect(startRun(running, HOLLOW, ['cr-pebblepup'], 2000).dungeons.find((d) => d.id === HOLLOW)!.activeRun!.creatureIds).toEqual(['cr-fernling']);
    // fernling is busy => starting grove with it is a no-op
    expect(startRun(running, 'grove', ['cr-fernling'], 2000).dungeons.find((d) => d.id === 'grove')!.activeRun).toBeNull();
  });
});

describe('isRunReady', () => {
  it('is false before the duration elapses, true after', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    expect(isRunReady(s, HOLLOW, 1000 + HOLLOW_MS - 1)).toBe(false);
    expect(isRunReady(s, HOLLOW, 1000 + HOLLOW_MS)).toBe(true);
  });

  it('is false when no run is active', () => {
    expect(isRunReady(createInitialState(0), HOLLOW, 9_999_999)).toBe(false);
  });
});

describe('collectRun', () => {
  it('is a no-op before the run is ready', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    const next = collectRun(s, HOLLOW, () => 0.99, 1000 + HOLLOW_MS - 1);
    expect(next).toBe(s); // unchanged reference
  });

  it('pays power-scaled loot, grants xp, frees creatures, clears the run (discovery miss)', () => {
    const d = getDungeon(HOLLOW)!; // recommendedPower 2, loot gold20/wood10/acorn6, xp30
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling', 'cr-pebblepup'], 1000); // teamPower 2 => mult 1.0
    const next = collectRun(s, HOLLOW, () => 0.99, 1000 + HOLLOW_MS);
    expect(next.resources.gold).toBe(d.loot.gold);
    expect(next.resources.wood).toBe(d.loot.wood);
    expect(next.resources.acorns).toBe(d.loot.acorn);
    expect(next.dungeons.find((x) => x.id === HOLLOW)!.activeRun).toBeNull();
    const fern = next.creatures.find((c) => c.id === 'cr-fernling')!;
    expect(fern.assignment.type).toBe('idle');
    expect(fern.xp + (fern.level - 1) * 100).toBeGreaterThanOrEqual(30); // got at least the xp lump
  });

  it('clamps loot multiplier to a 0.5 floor for an underpowered team', () => {
    const s = startRun(createInitialState(0), 'deep', ['cr-fernling'], 1000); // power 1 vs recommended 14
    const deep = getDungeon('deep')!;
    const next = collectRun(s, 'deep', () => 0.99, 1000 + deep.durationSec * 1000);
    expect(next.resources.gold).toBe(Math.floor(deep.loot.gold * 0.5));
  });

  it('can discover on completion when the roll hits', () => {
    const s = startRun(createInitialState(0), HOLLOW, ['cr-fernling'], 1000);
    const before = s.discovered.length;
    const next = collectRun(s, HOLLOW, seqRng([0.0, 0.0]), 1000 + HOLLOW_MS);
    expect(next.discovered.length).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/forest.test.ts`
Expected: FAIL — `startRun` / `isRunReady` / `collectRun` not exported.

- [ ] **Step 3: Implement the dungeon engine**

Append to `src/engine/forest.ts`:

```ts
import { getDungeon } from './content';
import { teamPower, grantXp } from './creatures';

/** Begin a run: no-op unless the dungeon is idle, the team is non-empty, and all are free. */
export function startRun(state: GameState, dungeonId: string, creatureIds: string[], now: number): GameState {
  const dungeon = state.dungeons.find((d) => d.id === dungeonId);
  if (!dungeon || dungeon.activeRun) return state;
  if (creatureIds.length === 0) return state;
  const team = state.creatures.filter((c) => creatureIds.includes(c.id));
  if (team.length !== creatureIds.length) return state;               // unknown id
  if (team.some((c) => c.assignment.type === 'dungeon')) return state; // busy elsewhere

  return {
    ...state,
    creatures: state.creatures.map((c) =>
      creatureIds.includes(c.id)
        ? { ...c, assignment: { type: 'dungeon', dungeonId, startedAt: now } }
        : c,
    ),
    dungeons: state.dungeons.map((d) =>
      d.id === dungeonId ? { ...d, activeRun: { creatureIds, startedAt: now } } : d,
    ),
  };
}

export function isRunReady(state: GameState, dungeonId: string, now: number): boolean {
  const dungeon = state.dungeons.find((d) => d.id === dungeonId);
  const def = getDungeon(dungeonId);
  if (!dungeon || !dungeon.activeRun || !def) return false;
  return now >= dungeon.activeRun.startedAt + def.durationSec * 1000;
}

/**
 * Collect a ready run: pay loot * clamp(teamPower/recommendedPower, 0.5, 1.5), roll discovery at
 * baseChance * mult, grant each creature the xp lump, free them, clear the run. No-op if not ready.
 */
export function collectRun(state: GameState, dungeonId: string, rng: Rng, now: number): GameState {
  if (!isRunReady(state, dungeonId, now)) return state;
  const def = getDungeon(dungeonId)!;
  const run = state.dungeons.find((d) => d.id === dungeonId)!.activeRun!;
  const power = teamPower(state, run.creatureIds);
  const mult = Math.max(0.5, Math.min(1.5, power / def.recommendedPower));

  const paid: GameState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + Math.floor(def.loot.gold * mult),
      wood: state.resources.wood + Math.floor(def.loot.wood * mult),
      acorns: state.resources.acorns + Math.floor(def.loot.acorn * mult),
    },
    creatures: state.creatures.map((c) =>
      run.creatureIds.includes(c.id)
        ? grantXp({ ...c, assignment: { type: 'idle', dungeonId: null, startedAt: 0 } }, def.xpReward)
        : c,
    ),
    dungeons: state.dungeons.map((d) => (d.id === dungeonId ? { ...d, activeRun: null } : d)),
  };

  return rollDiscovery(paid, Math.min(0.95, def.baseDiscoveryChance * mult), rng);
}
```

Note: `seqRng` is already defined at the top of `test/engine/forest.test.ts` from Task 5 — do not redefine it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/engine/forest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/forest.ts test/engine/forest.test.ts
git commit -m "feat(engine): dungeon runs — start/ready/collect with soft power check + discovery

regression check: npm test -- test/engine/forest.test.ts"
```

---

## Task 7: `applyElapsed` extension (offline satchel fill + forager XP)

**Files:**
- Modify: `src/engine/idle.ts`
- Test: `test/engine/idle.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/idle.test.ts`:

```ts
import { assignCreature } from '../../src/engine/forest';

describe('applyElapsed (forest)', () => {
  it('fills the satchel and drips forager XP over the wall-clock gap', () => {
    let s = createInitialState(1_000);
    s = assignCreature(s, 'cr-fernling', 'forage'); // acorn 0.05/s
    const next = applyElapsed(s, 1_000 + 200_000);  // +200s
    expect(next.storage.satchel.acorn).toBeCloseTo(10, 5); // 0.05 * 200
    const fern = next.creatures.find((c) => c.id === 'cr-fernling')!;
    expect(fern.xp).toBeCloseTo(0.02 * 200, 5); // 4 xp
    expect(next.meta.lastSeen).toBe(1_000 + 200_000);
  });

  it('leaves dungeon runs to be collected later (no auto-collect)', () => {
    let s = createInitialState(0);
    s = { ...s, dungeons: s.dungeons.map((d) => d.id === 'hollow'
      ? { ...d, activeRun: { creatureIds: ['cr-fernling'], startedAt: 0 } } : d) };
    const next = applyElapsed(s, 10 * 3600 * 1000); // long after it would be ready
    expect(next.dungeons.find((d) => d.id === 'hollow')!.activeRun).not.toBeNull();
    expect(next.resources.gold).toBe(0); // nothing paid until collectRun
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/idle.test.ts`
Expected: FAIL — satchel stays 0 (applyElapsed doesn't accrue it yet).

- [ ] **Step 3: Extend the orchestrator**

Edit `src/engine/idle.ts`. Add imports and extend the pipeline:

```ts
import type { GameState } from './types';
import { accrueBarn } from './farm';
import { accrueSatchel } from './forest';
import { dripForagerXp } from './creatures';

/**
 * Apply all offline progress between state.meta.lastSeen and `now` (epoch ms).
 * Pure + clock-safe: negative gaps clamp to zero. Dungeon runs are NOT auto-collected here —
 * they simply become ready and are collected by an explicit user action.
 */
export function applyElapsed(state: GameState, now: number): GameState {
  const elapsedSec = Math.max(0, (now - state.meta.lastSeen) / 1000);
  let next = accrueBarn(state, elapsedSec);
  next = accrueSatchel(next, elapsedSec);
  next = dripForagerXp(next, elapsedSec);
  next = { ...next, meta: { ...next.meta, lastSeen: now } };
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/engine/idle.test.ts`
Expected: PASS (Plan-1 barn tests + new forest tests green).

- [ ] **Step 5: Commit**

```bash
git add src/engine/idle.ts test/engine/idle.test.ts
git commit -m "feat(engine): applyElapsed fills satchel + drips forager XP offline

regression check: npm test -- test/engine/idle.test.ts"
```

---

## Task 8: Persistence — v1→v2 additive migration

**Files:**
- Modify: `src/persistence/save.ts`
- Test: `test/persistence/save.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/persistence/save.test.ts`:

```ts
import { SPECIES } from '../../src/engine';

describe('v1 -> v2 migration', () => {
  it('adds forest fields to a Plan-1 save without throwing', () => {
    // A Plan-1 (v1) envelope: gold-only resources, barn-only storage, no forest fields.
    const v1Envelope = JSON.stringify({
      version: 1,
      state: {
        resources: { gold: 123 },
        plots: [{ id: 'plot-1', crop: 'wheat' }],
        villagers: [{ id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: 'farm' }],
        storage: { barn: { amount: 40 } },
        meta: { lastSeen: 5000 },
      },
    });
    const s = deserialize(v1Envelope);
    expect(s.resources.gold).toBe(123);          // preserved
    expect(s.resources.wood).toBe(0);            // added
    expect(s.resources.acorns).toBe(0);
    expect(s.storage.barn.amount).toBe(40);      // preserved
    expect(s.storage.satchel).toEqual({ wood: 0, acorn: 0 });
    expect(s.creatures.map((c) => c.species).sort()).toEqual(['fernling', 'pebblepup']);
    expect(s.dungeons.map((d) => d.id)).toEqual(['hollow', 'grove', 'deep']);
    expect(s.discovered.sort()).toEqual(['fernling', 'pebblepup']);
  });

  it('leaves a current v2 save untouched', () => {
    const v2 = serialize(plantCrop(createInitialState(1), 'plot-1', 'berry'));
    expect(JSON.parse(v2).version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(2);
    const restored = deserialize(v2);
    expect(restored.creatures).toHaveLength(2);
    expect(Object.keys(SPECIES).length).toBeGreaterThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/persistence/save.test.ts`
Expected: FAIL — v1 blob is rejected as invalid (returns a fresh state, gold 0) because migration isn't wired.

- [ ] **Step 3: Wire the migration**

Rewrite `src/persistence/save.ts`:

```ts
import type { GameState } from '../engine/types';
import { createInitialState, makeCreature } from '../engine';
import { DUNGEONS, STARTER_SPECIES } from '../engine/content';

export const SAVE_VERSION = 2;

interface SaveEnvelope {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

/** Never throws — a corrupt/absent/malformed blob yields a fresh state so the app always boots. */
export function deserialize(json: string | null): GameState {
  if (!json) return createInitialState(Date.now());
  try {
    const parsed = JSON.parse(json) as Partial<SaveEnvelope>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.state) {
      return createInitialState(Date.now());
    }
    if (!isValidBaseState(parsed.state)) {
      return createInitialState(Date.now());
    }
    return migrate(parsed.version, parsed.state);
  } catch {
    return createInitialState(Date.now());
  }
}

/** Validates the fields common to every version. Forest fields are backfilled by migrate(). */
function isValidBaseState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  if (!Array.isArray(s.plots) || !Array.isArray(s.villagers)) return false;
  if (!s.resources || typeof s.resources !== 'object') return false;
  if (!s.meta || typeof s.meta !== 'object') return false;
  const storage = s.storage as { barn?: { amount?: unknown } } | undefined;
  if (!storage || typeof storage !== 'object') return false;
  if (!storage.barn || typeof storage.barn !== 'object') return false;
  if (typeof storage.barn.amount !== 'number') return false;
  return true;
}

/** Additive migrations. v1 (farm-only) -> v2 (forest). Idempotent: only fills missing fields. */
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);
  return s;
}

function addForestFields(old: GameState): GameState {
  const r = old.resources as Partial<GameState['resources']>;
  return {
    ...old,
    resources: { gold: r.gold ?? 0, wood: r.wood ?? 0, acorns: r.acorns ?? 0 },
    storage: {
      barn: old.storage.barn,
      satchel: old.storage.satchel ?? { wood: 0, acorn: 0 },
    },
    creatures: old.creatures ?? STARTER_SPECIES.map(makeCreature),
    dungeons: old.dungeons ?? DUNGEONS.map((d) => ({ id: d.id, activeRun: null })),
    discovered: old.discovered ?? [...STARTER_SPECIES],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/persistence/save.test.ts`
Expected: PASS (round-trip + corrupt-blob tests from Plan 1 still green; new migration tests green).

- [ ] **Step 5: Commit**

```bash
git add src/persistence/save.ts test/persistence/save.test.ts
git commit -m "feat(persistence): SAVE_VERSION 2 + additive v1->v2 forest migration

regression check: npm test -- test/persistence/save.test.ts"
```

---

## Task 9: Store actions + discovery signal

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: none (thin RN-bound wrapper; engine is fully tested). Verified by `npx tsc --noEmit` + the manual drive in Task 12.

- [ ] **Step 1: Extend the store**

Rewrite `src/store/gameStore.ts`:

```ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, CropId, SpeciesId } from '../engine/types';
import {
  createInitialState,
  plantCrop,
  assignVillager,
  collectBarn,
  applyElapsed,
  assignCreature,
  startRun,
  collectRun,
  collectSatchel,
} from '../engine';
import { serialize, deserialize } from '../persistence/save';

const STORAGE_KEY = 'lakewood.save.v1'; // key unchanged; the envelope's `version` drives migration

interface GameStore {
  state: GameState;
  loaded: boolean;
  lastDiscovery: SpeciesId | null;
  load: () => Promise<void>;
  tick: (now: number) => void;
  plant: (plotId: string, cropId: CropId | null) => void;
  assign: (villagerId: string, to: 'farm' | null) => void;
  collect: () => void;
  assignCreatureTo: (creatureId: string, to: 'idle' | 'forage') => void;
  startDungeon: (dungeonId: string, creatureIds: string[]) => void;
  collectDungeon: (dungeonId: string) => void;
  collectForage: () => void;
  dismissDiscovery: () => void;
  save: () => void;
}

function persist(state: GameState) {
  AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
}

/** The species newly present in `next.discovered` but not in `prev.discovered`, if any. */
function newlyDiscovered(prev: GameState, next: GameState): SpeciesId | null {
  const added = next.discovered.filter((id) => !prev.discovered.includes(id));
  return added.length > 0 ? added[added.length - 1] : null;
}

export const useGameStore = create<GameStore>((set, get) => {
  const commit = (next: GameState) => { persist(next); set({ state: next }); };

  /** Run a discovery-capable engine action, surfacing any new species for the toast. */
  const commitWithDiscovery = (prev: GameState, next: GameState) => {
    const found = newlyDiscovered(prev, next);
    persist(next);
    set(found ? { state: next, lastDiscovery: found } : { state: next });
  };

  return {
    state: createInitialState(Date.now()),
    loaded: false,
    lastDiscovery: null,

    load: async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const restored = applyElapsed(deserialize(raw), Date.now());
      persist(restored);
      set({ state: restored, loaded: true });
    },

    tick: (now) => set({ state: applyElapsed(get().state, now) }),

    plant: (plotId, cropId) => commit(plantCrop(applyElapsed(get().state, Date.now()), plotId, cropId)),

    assign: (villagerId, to) => commit(assignVillager(applyElapsed(get().state, Date.now()), villagerId, to)),

    collect: () => commit(collectBarn(applyElapsed(get().state, Date.now()))),

    assignCreatureTo: (creatureId, to) =>
      commit(assignCreature(applyElapsed(get().state, Date.now()), creatureId, to)),

    startDungeon: (dungeonId, creatureIds) => {
      const now = Date.now();
      commit(startRun(applyElapsed(get().state, now), dungeonId, creatureIds, now));
    },

    collectDungeon: (dungeonId) => {
      const now = Date.now();
      const caught = applyElapsed(get().state, now);
      commitWithDiscovery(caught, collectRun(caught, dungeonId, Math.random, now));
    },

    collectForage: () => {
      const caught = applyElapsed(get().state, Date.now());
      commitWithDiscovery(caught, collectSatchel(caught, Math.random));
    },

    dismissDiscovery: () => set({ lastDiscovery: null }),

    save: () => persist(get().state),
  };
});
```

- [ ] **Step 2: Verify types + engine tests**

Run: `npm test && npx tsc --noEmit`
Expected: all engine + persistence tests PASS; **tsc still errors only in `ResourceBar.tsx`** (references `r.wood`/`r.acorns` after Task 9? no — ResourceBar is Task 10). At this checkpoint tsc should be **clean** except any UI not yet built. If tsc reports store errors, fix before committing.

- [ ] **Step 3: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat(store): creature/dungeon/forage actions + discovery signal

regression check: npm test && npx tsc --noEmit"
```

---

## Task 10: ResourceBar (wood/acorns) + SatchelCard + CreatureRoster

**Files:**
- Modify: `src/ui/components/ResourceBar.tsx`
- Create: `src/ui/components/SatchelCard.tsx`
- Create: `src/ui/components/CreatureRoster.tsx`

- [ ] **Step 1: Show wood + acorns in the ResourceBar**

Rewrite `src/ui/components/ResourceBar.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';

export function ResourceBar() {
  const r = useGameStore((s) => s.state.resources);
  return (
    <View style={styles.row}>
      <Text style={styles.item}>🪙 {r.gold}</Text>
      <Text style={styles.item}>🪵 {r.wood}</Text>
      <Text style={styles.item}>🌰 {r.acorns}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  item: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: SatchelCard (dual meter + Collect)**

Create `src/ui/components/SatchelCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { satchelCap } from '../../engine';

export function SatchelCard() {
  const satchel = useGameStore((s) => s.state.storage.satchel);
  const cap = useGameStore((s) => satchelCap(s.state));
  const collect = useGameStore((s) => s.collectForage);

  const wood = Math.floor(satchel.wood);
  const acorn = Math.floor(satchel.acorn);
  const total = satchel.wood + satchel.acorn;
  const pct = Math.min(100, Math.round((total / cap) * 100));
  const empty = wood + acorn === 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🎒 Satchel</Text>
        <Pressable
          style={[styles.btn, empty && styles.btnDisabled]}
          disabled={empty}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>🪵 {wood}   🌰 {acorn}   ({pct}% full)</Text>
      <View style={styles.meter}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  meter: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, marginTop: 6 },
  fill: { height: '100%', backgroundColor: theme.accent, borderRadius: 5 },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 3: CreatureRoster (rest/forage toggle; dungeon = locked)**

Create `src/ui/components/CreatureRoster.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { getDungeon } from '../../engine';
import type { Rarity } from '../../engine/types';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb6a4',
  uncommon: '#7fc8ff',
  rare: '#e6b3ff',
};

export function CreatureRoster() {
  const creatures = useGameStore((s) => s.state.creatures);
  const assignTo = useGameStore((s) => s.assignCreatureTo);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🐿️ Creatures</Text>
      <Text style={styles.sub}>Tap to send foraging (🪵/🌰 by nature); dungeon teams are set below</Text>
      {creatures.map((c) => {
        const inDungeon = c.assignment.type === 'dungeon';
        const foraging = c.assignment.type === 'forage';
        const dungeonName = inDungeon && c.assignment.dungeonId ? getDungeon(c.assignment.dungeonId)?.name : null;
        const status = inDungeon ? `delving ${dungeonName ?? '…'}` : foraging ? `foraging ${c.affinity === 'wood' ? '🪵' : '🌰'}` : 'resting';
        return (
          <Pressable
            key={c.id}
            style={[styles.rowItem, foraging && styles.rowItemOn, inDungeon && styles.rowItemLocked]}
            disabled={inDungeon}
            onPress={() => assignTo(c.id, foraging ? 'idle' : 'forage')}
          >
            <Text style={styles.emoji}>{c.emoji}</Text>
            <View style={styles.meta}>
              <Text style={styles.name}>
                {c.name} <Text style={[styles.rarity, { color: RARITY_COLOR[c.rarity] }]}>• {c.rarity}</Text>
              </Text>
              <Text style={styles.status}>Lv {c.level} · {status}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 10, backgroundColor: '#26332a', marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  rowItemOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  rowItemLocked: { opacity: 0.55 },
  emoji: { fontSize: 24 },
  meta: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  rarity: { fontSize: 11, fontWeight: '600' },
  status: { color: theme.textDim, fontSize: 12, marginTop: 1 },
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (these components + the store all agree on shapes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ResourceBar.tsx src/ui/components/SatchelCard.tsx src/ui/components/CreatureRoster.tsx
git commit -m "feat(ui): ResourceBar wood/acorns + SatchelCard + CreatureRoster

regression check: npx tsc --noEmit"
```

---

## Task 11: DungeonCard + DiscoveryToast + assemble the Forest screen

**Files:**
- Create: `src/ui/components/DungeonCard.tsx`
- Create: `src/ui/components/DiscoveryToast.tsx`
- Modify: `app/forest.tsx`

- [ ] **Step 1: DungeonCard (team assembly → run → collect)**

Create `src/ui/components/DungeonCard.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { getDungeon, teamPower } from '../../engine';

function fmt(sec: number): string {
  if (sec <= 0) return 'ready';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function DungeonCard({ dungeonId, now }: { dungeonId: string; now: number }) {
  const def = getDungeon(dungeonId)!;
  const dungeon = useGameStore((s) => s.state.dungeons.find((d) => d.id === dungeonId)!);
  const idleCreatures = useGameStore((s) => s.state.creatures.filter((c) => c.assignment.type === 'idle'));
  const powerOf = useGameStore((s) => (ids: string[]) => teamPower(s.state, ids));
  const startDungeon = useGameStore((s) => s.startDungeon);
  const collectDungeon = useGameStore((s) => s.collectDungeon);

  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const run = dungeon.activeRun;
  const remaining = run ? Math.ceil((run.startedAt + def.durationSec * 1000 - now) / 1000) : 0;
  const ready = run !== null && remaining <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{def.emoji} {def.name}</Text>
        <Text style={styles.rec}>⚔️ ~{def.recommendedPower}</Text>
      </View>

      {run === null && (
        <>
          <Text style={styles.sub}>Pick a team, then delve ({fmt(def.durationSec)})</Text>
          <View style={styles.chips}>
            {idleCreatures.length === 0 && <Text style={styles.sub}>No resting creatures.</Text>}
            {idleCreatures.map((c) => {
              const on = selected.includes(c.id);
              return (
                <Pressable key={c.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(c.id)}>
                  <Text style={styles.chipText}>{c.emoji} {c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.btn, selected.length === 0 && styles.btnDisabled]}
            disabled={selected.length === 0}
            onPress={() => { startDungeon(dungeonId, selected); setSelected([]); }}
          >
            <Text style={styles.btnText}>Delve · power {powerOf(selected)}</Text>
          </Pressable>
        </>
      )}

      {run !== null && !ready && (
        <>
          <Text style={styles.sub}>Delving… {run.creatureIds.length} on the trail</Text>
          <Text style={styles.timer}>⏳ {fmt(remaining)}</Text>
        </>
      )}

      {ready && (
        <Pressable style={styles.btn} onPress={() => collectDungeon(dungeonId)}>
          <Text style={styles.btnText}>✨ Collect loot</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  rec: { color: theme.textDim, fontSize: 12 },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  timer: { color: theme.accent, fontSize: 18, fontWeight: '700', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 10 },
  chip: { backgroundColor: '#26332a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  chipText: { color: theme.text, fontSize: 12, fontWeight: '600' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 2: DiscoveryToast (the "ooh, a new one!" moment)**

Create `src/ui/components/DiscoveryToast.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { SPECIES } from '../../engine';

export function DiscoveryToast() {
  const speciesId = useGameStore((s) => s.lastDiscovery);
  const dismiss = useGameStore((s) => s.dismissDiscovery);
  if (!speciesId) return null;
  const sp = SPECIES[speciesId];

  return (
    <Pressable style={styles.overlay} onPress={dismiss}>
      <View style={styles.card}>
        <Text style={styles.spark}>✨ New friend discovered! ✨</Text>
        <Text style={styles.emoji}>{sp.emoji}</Text>
        <Text style={styles.name}>{sp.name}</Text>
        <Text style={styles.rarity}>{sp.rarity} · forages {sp.affinity === 'wood' ? '🪵' : '🌰'}</Text>
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
  emoji: { fontSize: 56, marginVertical: 8 },
  name: { color: theme.text, fontSize: 22, fontWeight: '800' },
  rarity: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  tap: { color: theme.textDim, fontSize: 11, marginTop: 16 },
});
```

- [ ] **Step 3: Assemble the Forest screen**

Rewrite `app/forest.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';
import { DUNGEONS } from '../src/engine';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { SatchelCard } from '../src/ui/components/SatchelCard';
import { CreatureRoster } from '../src/ui/components/CreatureRoster';
import { DungeonCard } from '../src/ui/components/DungeonCard';
import { DiscoveryToast } from '../src/ui/components/DiscoveryToast';

export default function Forest() {
  const tick = useGameStore((s) => s.tick);
  const [now, setNow] = useState(() => Date.now());

  // Drive live satchel fill + dungeon countdowns; hard catch-up on foreground.
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
        <SatchelCard />
        <CreatureRoster />
        {DUNGEONS.map((d) => (
          <DungeonCard key={d.id} dungeonId={d.id} now={now} />
        ))}
      </ScrollView>
      <DiscoveryToast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
```

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all engine + persistence tests PASS.

- [ ] **Step 5: Manual drive (web is fastest)**

Run: `npx expo start --web --port 8081`
Verify in the browser:
1. Forest tab shows Satchel (0), two resting creatures, three dungeon cards.
2. Tap a creature → it reads "foraging 🪵/🌰"; watch the Satchel tick up; **Collect** banks wood/acorns into the top bar.
3. Build a team on Mossy Hollow → **Delve** → countdown appears. (For a fast check, temporarily lower `hollow.durationSec` to e.g. `10` in `content.ts`, verify the ready→Collect→loot+possible discovery flow, then restore `15 * 60`.)
4. A discovery shows the ✨ toast; dismiss it; the new creature appears in the roster.
5. Reload the page → state persisted (creatures/satchel/discovered survive).

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/DungeonCard.tsx src/ui/components/DiscoveryToast.tsx app/forest.tsx
git commit -m "feat(ui): Forest screen — satchel, roster, dungeon runs, discovery toast

regression check: npx tsc --noEmit && npm test"
```

---

## Task 12: Publish as "Lakewood Forest" (founder-owed, end of plan)

**Files:**
- Create: `README.md`
- Modify: `app.json` (app name), `.gitignore`

> Per the spec §8. This closes the `founder-license` + `.claude/settings.json` handoff items. Publishing is a public, outward-facing action — confirm with the founder before the `gh repo create` push.

- [ ] **Step 1: Rename the app to "Lakewood Forest"**

Edit `app.json` — set `expo.name` to `"Lakewood Forest"` and `expo.slug` to `"lakewood-forest"` (leave `scheme: "lakewood"` as-is; deep-link scheme need not change).

- [ ] **Step 2: Gitignore the local Expo dev config**

Append to `.gitignore`:

```
.claude/settings.json
```

Then untrack it if it was committed: `git rm --cached .claude/settings.json 2>/dev/null || true`.

- [ ] **Step 3: Write the README**

Create `README.md`:

```markdown
# Lakewood Forest

A cozy, warm, offline idle game. Tend a forest farm, send your family to the fields and your
discovered creatures to forage and delve gentle dungeons — then close the app and come back to
loot. No ads, no gacha, no leaderboards. Actually slow.

Built with React Native + Expo. Fully offline, single-player, local save.

## Run it

```bash
npm install
npx expo start        # then open in Expo Go, or press `w` for web
```

## Build an Android APK

```bash
eas build -p android --profile preview
```

## License

MIT — see [LICENSE](LICENSE). Clean-room build; no code derived from any other game.
```

- [ ] **Step 4: Verify green + commit**

Run: `npx tsc --noEmit && npm test`
Expected: clean + all green.

```bash
git add README.md app.json .gitignore
git commit -m "chore: rename to Lakewood Forest + README + gitignore local Expo config

regression check: npx tsc --noEmit && npm test"
```

- [ ] **Step 5: Merge the branch to main**

```bash
git switch main
git merge --no-ff feat/forest-plan2 -m "Merge Plan 2: Forest & creatures"
```

- [ ] **Step 6: Create the public repo (CONFIRM with founder first)**

```bash
# uses the personal account already authed as `sergideki`
gh repo create sergideki/lakewood-forest --public --source=. --remote=origin --push \
  --description "A cozy, warm, offline idle game — forest farm + creatures. React Native + Expo."
```

Verify the repo is public and `main` is pushed. Done.

---

## Definition of Done (Plan 2)

- `npm test` green (engine + persistence, including discovery determinism + v1→v2 migration).
- `npx tsc --noEmit` clean.
- In the running app: assign creatures to forage → Satchel fills live + offline → Collect banks wood/acorns; build a dungeon team → Delve → countdown → Collect pays power-scaled loot; discovery shows the ✨ toast and the new creature joins the roster; a Plan-1 save migrates without loss.
- Repo published public as `sergideki/lakewood-forest`, titled **Lakewood Forest**, MIT, with a README (founder-confirmed).

## Self-Review (completed)

- **Spec coverage:** §2 decision 1 (full Forest) → Tasks 3–11. Decision 2 (auto-join discovery on completion) → `rollDiscovery` (Task 4) wired into `collectSatchel` (Task 5) + `collectRun` (Task 6). Decision 3 (one satchel, affinity picks material) → `satchel {wood,acorn}` + `forageRatePerSec(material)` (Tasks 1,5). Decision 4 (no-fail soft power check) → `collectRun` mult clamp `[0.5,1.5]`, never a loss (Task 6). Decision 5 (passive XP auto-level) → `dripForagerXp` + dungeon xp lump (Tasks 4,6,7). §3 architecture (assignment-per-creature, injected rng) → `Creature.assignment` + `Rng` (Task 1). §3.3 migration → Task 8. §4 all engine fns → Tasks 3–6. §5 UI → Tasks 10–11. §6 testing (deterministic rng) → `seqRng` throughout. §7 error handling → clamp/guards in accrue + start/collect. §8 publish → Task 12.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code. The one "temporarily lower durationSec" is an explicit manual-QA convenience with a restore instruction, not a code placeholder.
- **Type consistency:** `Creature.assignment {type,dungeonId,startedAt}`, `Rng`, `satchel {wood,acorn}`, `Dungeon {loot:{gold,wood,acorn},recommendedPower,xpReward}` are used identically across engine, store, and UI. Function names (`assignCreature`, `startRun`, `isRunReady`, `collectRun`, `collectSatchel`, `satchelCap`, `teamPower`, `grantXp`, `rollDiscovery`, `dripForagerXp`) match between definitions, barrel exports, store imports, and test imports. Store action names (`assignCreatureTo`, `startDungeon`, `collectDungeon`, `collectForage`, `dismissDiscovery`, `lastDiscovery`) match their UI call sites.
- **Known ordering note:** Task 4's test imports `assignCreature` from `forest.ts` (built in Task 5). If executed strictly in order, run Task 4's implementation, then Task 5, then re-run both test files together (Task 5 Step 5) — called out inline in Task 4 Step 2/4.
```
