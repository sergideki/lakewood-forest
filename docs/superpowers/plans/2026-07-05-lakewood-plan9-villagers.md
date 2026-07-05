# Plan 9 — Villager Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 3 identical farm-only villagers into a workforce you assign across farm/forest/lake, specialize, level up, and recruit more of (cap 8).

**Architecture:** A `villagerBoost(state, station)` multiplier applied at each station's rate site (farm gated, forest/lake additive, contamination-safe — `forageRatePerSec` stays pure so forest boost never leaks into fishing). Villagers gain `specialty`/`level`/`xp` (additive save v6→v7). Recruiting is a Town purchase. New pure module `src/engine/villagers.ts`.

**Tech Stack:** React Native / Expo, TypeScript, Zustand v5, vitest.

Spec: `docs/superpowers/specs/2026-07-05-lakewood-plan9-villagers-design.md` (read its **Skeptic-hardening notes** — they enumerate every existing test the farm-formula change breaks). Base: branch `feat/plan9-villagers`, save v6, 190/190 green.

**CRITICAL invariant (C1):** `villagerBoost` multiplies by `v.level` — any villager missing `level`/`specialty` yields `NaN` that persists as a corrupted save. ALL THREE creation paths MUST set `specialty`/`level`/`xp`: `createInitialState` (Task 1), `addVillagerDepth` migration (Task 1), `recruitVillager` (Task 5).

---

## File Structure

- `src/engine/types.ts` — `Station` type; widen `Villager` (MODIFY)
- `src/engine/content.ts` — villager tuning consts + names + `SPECIALTY_BY_ID` (MODIFY)
- `src/engine/villagers.ts` — `villagerBoost`, leveling, recruit (CREATE)
- `src/engine/state.ts` — seed starters' specialty/level/xp (MODIFY)
- `src/engine/farm.ts` / `forest.ts` / `lake.ts` — wire boost into rate sites (MODIFY)
- `src/engine/idle.ts` — `dripVillagerXp` in `applyElapsed` (MODIFY)
- `src/engine/achievements.ts` — "Full House" (MODIFY)
- `src/engine/index.ts` — re-export `villagers` (MODIFY)
- `src/persistence/save.ts` — v6→v7 `addVillagerDepth` (MODIFY)
- `src/store/gameStore.ts` — widen `assign`, add `recruit()` (MODIFY)
- `src/ui/components/VillagerRow.tsx` — assignment list (MODIFY)
- `src/ui/components/RecruitCard.tsx` — Town recruit card (CREATE); `app/town.tsx` mount (MODIFY)
- Tests: `test/engine/villagers.test.ts` (CREATE); update `farm/idle/save/achievements` tests (MODIFY)

---

## Task 1: Data model + save migration v6→v7

**Files:** `src/engine/types.ts`, `src/engine/content.ts`, `src/engine/state.ts`, `src/engine/index.ts`, `src/persistence/save.ts`; Test: `test/persistence/save.test.ts`, `test/engine/state`-via-`save`.

- [ ] **Step 1: Write the failing tests**

In `test/persistence/save.test.ts`, change the version pin (find `expect(SAVE_VERSION).toBe(6)`) to:
```ts
    expect(SAVE_VERSION).toBe(7);
```
Add:
```ts
import { createInitialState } from '../../src/engine';

describe('v6 -> v7 villager depth migration', () => {
  it('seeds new-state starters with specialty/level/xp', () => {
    const s = createInitialState(0);
    expect(s.villagers.map((v) => v.specialty)).toEqual(['farm', 'forest', 'lake']);
    expect(s.villagers.every((v) => v.level === 1 && v.xp === 0)).toBe(true);
  });
  it('backfills a v6 villager (no specialty/level/xp) without wiping', () => {
    const v6 = { ...createInitialState(0) };
    (v6 as { villagers: unknown }).villagers = [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: 'farm' },
      { id: 'vil-2', name: 'Nan', emoji: '👵', assignedTo: null },
    ];
    const restored = deserialize(JSON.stringify({ version: 6, state: v6 }));
    expect(restored.villagers[0]).toMatchObject({ specialty: 'farm', level: 1, xp: 0, assignedTo: 'farm' });
    expect(restored.villagers[1].specialty).toBe('forest'); // by id
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run test/persistence/save.test.ts`
Expected: FAIL (version pin + missing fields).

- [ ] **Step 3: Add the `Station` type + widen `Villager`**

In `src/engine/types.ts`, replace the `Villager` interface:
```ts
export type Station = 'farm' | 'forest' | 'lake';

export interface Villager {
  id: string;
  name: string;
  emoji: string;
  specialty: Station;
  level: number;
  xp: number;
  assignedTo: Station | null;
}
```

- [ ] **Step 4: Add villager constants to `content.ts`**

Append to `src/engine/content.ts`:
```ts
import type { Station } from './types';  // add Station to the existing type import if present

export const VILLAGER_PER = 0.15;        // boost per villager-level (TUNABLE)
export const VILLAGER_SPEC = 2;          // specialty match doubles contribution (TUNABLE)
export const VILLAGER_XP_PER_SEC = 0.05; // XP/sec while assigned (TUNABLE)
export const MAX_VILLAGERS = 8;
export const VILLAGER_NAMES = ['Bram', 'Wren', 'Tansy', 'Milo', 'Fen', 'Ada', 'Rue', 'Sage', 'Bo', 'Ivy'];
export const SPECIALTY_BY_ID: Record<string, Station> = { 'vil-1': 'farm', 'vil-2': 'forest', 'vil-3': 'lake' };
```
(If `content.ts` already `import type { ... } from './types'`, add `Station` there instead of a second import line.)

- [ ] **Step 5: Seed starters in `createInitialState`**

In `src/engine/state.ts`, replace the three villager literals:
```ts
    villagers: [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', specialty: 'farm', level: 1, xp: 0, assignedTo: null },
      { id: 'vil-2', name: 'Nan', emoji: '👵', specialty: 'forest', level: 1, xp: 0, assignedTo: null },
      { id: 'vil-3', name: 'Rowan', emoji: '🧔', specialty: 'lake', level: 1, xp: 0, assignedTo: null },
    ],
```

- [ ] **Step 6: Add the migration to `save.ts`**

`SAVE_VERSION = 7`. In `migrate()`, after the `addLifetimeCounters` line add:
```ts
  s = addVillagerDepth(s);   // unconditional, per-field ?? — same discipline as addLifetimeCounters
```
Add the function (import `SPECIALTY_BY_ID` from `../engine/content` at top):
```ts
/** v6->v7: villagers gain specialty/level/xp. Per-field ?? (never whole-object) so a partial blob
 *  can't leave undefined fields that villagerBoost turns into NaN. Runs unconditionally (idempotent). */
function addVillagerDepth(old: GameState): GameState {
  return {
    ...old,
    villagers: old.villagers.map((v) => {
      const w = v as Partial<GameState['villagers'][number]>;
      return {
        ...v,
        specialty: w.specialty ?? SPECIALTY_BY_ID[v.id] ?? 'farm',
        level: w.level ?? 1,
        xp: w.xp ?? 0,
      };
    }),
  };
}
```

- [ ] **Step 7: Run — verify it passes; typecheck**

Run: `npx vitest run test/persistence/save.test.ts && npx tsc --noEmit`
Expected: save tests PASS. tsc may FAIL where `assignVillager`/store types still say `'farm'|null` — fixed in Task 3/6. If the ONLY tsc errors are those, proceed.

- [ ] **Step 8: Commit**
```bash
git add src/engine/types.ts src/engine/content.ts src/engine/state.ts src/persistence/save.ts test/persistence/save.test.ts
git commit -m "feat(engine): widen Villager (specialty/level/xp/stations) + save v6->v7"
```

---

## Task 2: `villagerBoost` + `src/engine/villagers.ts`

**Files:** Create `src/engine/villagers.ts`; `src/engine/index.ts`; Test: `test/engine/villagers.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `test/engine/villagers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { villagerBoost } from '../../src/engine/villagers';

const assign = (s, id, to) => ({ ...s, villagers: s.villagers.map((v) => (v.id === id ? { ...v, assignedTo: to } : v)) });

describe('villagerBoost', () => {
  it('farm is gated: 0 farm villagers -> 0', () => {
    expect(villagerBoost(createInitialState(0), 'farm')).toBe(0);
  });
  it('forest/lake are ungated: 0 villagers -> 1', () => {
    const s = createInitialState(0);
    expect(villagerBoost(s, 'forest')).toBe(1);
    expect(villagerBoost(s, 'lake')).toBe(1);
  });
  it('a specialist on their station contributes double a generalist', () => {
    let s = createInitialState(0);
    s = assign(s, 'vil-1', 'farm'); // Pip: farm specialist, L1 -> 0.15*1*2 = 0.30
    expect(villagerBoost(s, 'farm')).toBeCloseTo(1.30, 5);
    s = assign(s, 'vil-2', 'farm'); // Nan: forest specialist on farm -> generalist 0.15
    expect(villagerBoost(s, 'farm')).toBeCloseTo(1.45, 5);
  });
  it('scales with level', () => {
    let s = createInitialState(0);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-2' ? { ...v, level: 3, assignedTo: 'forest' } : v)) };
    expect(villagerBoost(s, 'forest')).toBeCloseTo(1 + 0.15 * 3 * 2, 5); // Nan forest-specialist L3
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run test/engine/villagers.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create the module**

Create `src/engine/villagers.ts`:
```ts
import type { GameState, Station } from './types';
import { VILLAGER_PER, VILLAGER_SPEC } from './content';

/** Multiplier a station's assigned villagers apply to its output. Farm is GATED (no villagers -> 0);
 *  Forest & Lake are ungated (they run on their own; villagers only add on top). */
export function villagerBoost(state: GameState, station: Station): number {
  const bonus = state.villagers
    .filter((v) => v.assignedTo === station)
    .reduce((s, v) => s + VILLAGER_PER * v.level * (v.specialty === station ? VILLAGER_SPEC : 1), 0);
  if (station === 'farm' && bonus === 0) return 0;
  return 1 + bonus;
}
```

- [ ] **Step 4: Re-export**

In `src/engine/index.ts` add `export * from './villagers';`.

- [ ] **Step 5: Run — verify pass + tsc**

Run: `npx vitest run test/engine/villagers.test.ts && npx tsc --noEmit`
Expected: villager tests PASS (tsc may still error on store/assignVillager types — Task 3/6).

- [ ] **Step 6: Commit**
```bash
git add src/engine/villagers.ts src/engine/index.ts test/engine/villagers.test.ts
git commit -m "feat(engine): villagerBoost (farm-gated, forest/lake additive, specialty x2)"
```

---

## Task 3: Wire the boost into farm/forest/lake (contamination-safe) + fix broken tests

**Files:** `src/engine/farm.ts`, `src/engine/forest.ts`, `src/engine/lake.ts`; Test: update `test/engine/farm.test.ts`, `test/engine/idle.test.ts`; extend `test/engine/villagers.test.ts` (or forest/lake tests).

- [ ] **Step 1: Update the farm assertions the new formula changes, and add forest/lake/contamination tests**

In `test/engine/farm.test.ts`:
- The "routes each producer crop" test (assigns `vil-1`): the boost is now ×1.30. Change:
```ts
    expect(r.gold).toBeCloseTo(0.05 * 1.3, 5);
    expect(r.acorns).toBeCloseTo((6 / 180) * 1.3, 5);
    expect(r.wood).toBeCloseTo((6 / 180) * 1.3, 5);
```
- REWRITE the "gives +25% per extra assigned villager" test (that mechanic is gone) to:
```ts
  it('a farm specialist doubles a generalist on the same station', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');       // base 0.05/s gold
    s = assignVillager(s, 'vil-1', 'farm');     // Pip: farm specialist L1 -> x1.30
    expect(farmRatesPerSec(s).gold).toBeCloseTo(0.05 * 1.3, 5);
    s = assignVillager(s, 'vil-2', 'farm');     // Nan: forest specialist on farm = generalist +0.15
    expect(farmRatesPerSec(s).gold).toBeCloseTo(0.05 * 1.45, 5);
  });
```
- The two `accrueBarn` tests asserting `10` (200s at 0.05) → `13` (0.065×200). Change both `toBeCloseTo(10, 5)` to `toBeCloseTo(13, 5)` in the "adds rate * elapsed" and "is immutable" tests.

In `test/engine/idle.test.ts`: `activeFarm` assigns `vil-1`, so barn.gold after 200s is `13`, not `10`. Change the two assertions `toBeCloseTo(10, 5)` (in "fills the barn by the wall-clock gap" and "closes the rollback dupe") to `toBeCloseTo(13, 5)`.

Add to `test/engine/villagers.test.ts` the contamination + station-wiring guards:
```ts
import { farmRatesPerSec } from '../../src/engine/farm';
import { fishRatePerSec, forageRatePerSec as _f } from '../../src/engine';
import { plantCrop } from '../../src/engine';

describe('station wiring', () => {
  it('a forest villager does NOT change fishRatePerSec (no contamination)', () => {
    let s = createInitialState(0);
    const before = fishRatePerSec(s);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-2' ? { ...v, assignedTo: 'forest' } : v)) };
    expect(fishRatePerSec(s)).toBeCloseTo(before, 6); // forest boost must not leak into fishing
  });
  it('a lake villager boosts fishRatePerSec by its multiplier', () => {
    let s = createInitialState(0);
    const before = fishRatePerSec(s);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-3' ? { ...v, assignedTo: 'lake' } : v)) };
    expect(fishRatePerSec(s)).toBeCloseTo(before * 1.3, 6); // Rowan lake-specialist L1 -> x1.30
  });
  it('farm gate holds: 0 farm villagers -> 0 rate even with a crop planted', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    expect(farmRatesPerSec(s).gold).toBe(0);
  });
});
```

- [ ] **Step 2: Run — verify the new/updated tests fail**

Run: `npx vitest run test/engine/farm.test.ts test/engine/idle.test.ts test/engine/villagers.test.ts`
Expected: FAIL (wiring not done yet).

- [ ] **Step 3: Wire farm (`farm.ts`)**

Add import: `import { villagerBoost } from './villagers';`. In `farmRatesPerSec`, replace lines that compute `assigned`/early-return/`multiplier`:
```ts
  const boost = villagerBoost(state, 'farm');
  if (boost === 0) return rates;                       // gate: no farm villagers
  const multiplier = boost * petLeverMult(state, 'farmRate');   // KEEP petLeverMult (crawdad buff)
```
(Delete the old `const assigned = ...` line and the `if (assigned === 0) return rates;`.)

- [ ] **Step 4: Wire forest (`forest.ts`)**

Add import: `import { villagerBoost } from './villagers';`. Add a rate function and use it in cap + accrue:
```ts
/** Forest satchel rate for a material = pure forage output * this station's villager boost. */
export function satchelRatePerSec(state: GameState, material: Material): number {
  return forageRatePerSec(state, material) * villagerBoost(state, 'forest');
}
```
In `satchelCap`: `const perSec = satchelRatePerSec(state, 'wood') + satchelRatePerSec(state, 'acorn');`
In `accrueSatchel`: `const woodRate = satchelRatePerSec(state, 'wood');` and `const acornRate = satchelRatePerSec(state, 'acorn');`
(Leave `forageRatePerSec` itself PURE — do not add the boost inside it.)

- [ ] **Step 5: Wire lake (`lake.ts`)**

Add import: `import { villagerBoost } from './villagers';`. Change `fishRatePerSec`:
```ts
export function fishRatePerSec(state: GameState): number {
  return (BASE_ROD_RATE + forageRatePerSec(state, 'fish')) * villagerBoost(state, 'lake');
}
```

- [ ] **Step 6: Run — full suite + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL green (updated farm/idle assertions + new guards). tsc may still error on the store `assign` type (Task 6). If so, note it and proceed — engine + tests are green.

- [ ] **Step 7: Commit**
```bash
git add src/engine/farm.ts src/engine/forest.ts src/engine/lake.ts test/engine/farm.test.ts test/engine/idle.test.ts test/engine/villagers.test.ts
git commit -m "feat(engine): villagers boost farm/forest/lake (contamination-safe); update farm-rate tests"
```

---

## Task 4: Villager leveling

**Files:** `src/engine/villagers.ts`, `src/engine/idle.ts`; Test: `test/engine/villagers.test.ts`, `test/engine/idle.test.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `test/engine/villagers.test.ts`:
```ts
import { villagerXpForLevel, grantVillagerXp, dripVillagerXp } from '../../src/engine/villagers';

describe('villager leveling', () => {
  it('villagerXpForLevel grows per level', () => {
    expect(villagerXpForLevel(1)).toBe(60);
    expect(villagerXpForLevel(2)).toBe(Math.round(60 * 1.35));
  });
  it('grantVillagerXp levels up and carries remainder', () => {
    const v = { id: 'x', name: 'x', emoji: '', specialty: 'farm' as const, level: 1, xp: 0, assignedTo: 'farm' as const };
    const out = grantVillagerXp(v, 65); // 60 to L2, 5 carried
    expect(out.level).toBe(2);
    expect(out.xp).toBe(5);
  });
  it('dripVillagerXp only feeds ASSIGNED villagers', () => {
    let s = createInitialState(0);
    s = { ...s, villagers: s.villagers.map((v) => (v.id === 'vil-1' ? { ...v, assignedTo: 'farm' } : v)) };
    const out = dripVillagerXp(s, 100); // 0.05*100 = 5 xp to vil-1 only
    expect(out.villagers.find((v) => v.id === 'vil-1').xp).toBe(5);
    expect(out.villagers.find((v) => v.id === 'vil-2').xp).toBe(0); // resting
  });
});
```

Add to `test/engine/idle.test.ts` (assigned villager gains XP through applyElapsed):
```ts
  it('applyElapsed drips XP to assigned villagers', () => {
    const s0 = activeFarm(1_000); // assigns vil-1 to farm
    const s1 = applyElapsed(s0, 1_000 + 100_000); // +100s
    expect(s1.villagers.find((v) => v.id === 'vil-1').xp).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run test/engine/villagers.test.ts test/engine/idle.test.ts` → FAIL.

- [ ] **Step 3: Implement leveling in `villagers.ts`**

Append:
```ts
import { VILLAGER_XP_PER_SEC } from './content';
import type { Villager } from './types';

export function villagerXpForLevel(level: number): number {
  return Math.round(60 * Math.pow(1.35, level - 1));
}
export function grantVillagerXp(v: Villager, amount: number): Villager {
  let level = v.level;
  let xp = v.xp + Math.max(0, amount);
  while (xp >= villagerXpForLevel(level)) { xp -= villagerXpForLevel(level); level += 1; }
  return { ...v, level, xp };
}
/** Drip XP to every ASSIGNED villager over elapsedSec. Resting villagers gain nothing. */
export function dripVillagerXp(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const gain = VILLAGER_XP_PER_SEC * elapsedSec;
  return {
    ...state,
    villagers: state.villagers.map((v) => (v.assignedTo !== null ? grantVillagerXp(v, gain) : v)),
  };
}
```
(Merge the `import { VILLAGER_XP_PER_SEC }` into the existing content import line.)

- [ ] **Step 4: Add to `applyElapsed` (`idle.ts`)**

Add import `import { dripVillagerXp } from './villagers';` and, AFTER the `dripForagerXp` line (drip-last convention), add:
```ts
  next = dripVillagerXp(next, elapsedSec);
```

- [ ] **Step 5: Run — verify pass + full suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: green (tsc store-type error may persist until Task 6).

- [ ] **Step 6: Commit**
```bash
git add src/engine/villagers.ts src/engine/idle.ts test/engine/villagers.test.ts test/engine/idle.test.ts
git commit -m "feat(engine): villager XP leveling + drip to assigned villagers"
```

---

## Task 5: Recruit + "Full House" achievement

**Files:** `src/engine/villagers.ts`, `src/engine/achievements.ts`, `src/store/gameStore.ts`; Test: `test/engine/villagers.test.ts`, `test/engine/achievements.test.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `test/engine/villagers.test.ts`:
```ts
import { recruitCost, recruitVillager } from '../../src/engine/villagers';
import { MAX_VILLAGERS } from '../../src/engine';

describe('recruit', () => {
  it('recruitCost escalates and is null at cap', () => {
    expect(recruitCost(3)).toEqual({ gold: 120, wood: 0, acorns: 40, fish: 0 });
    expect(recruitCost(4)).toEqual({ gold: Math.ceil(120 * 1.8), wood: 0, acorns: Math.ceil(40 * 1.8), fish: 0 });
    expect(recruitCost(MAX_VILLAGERS)).toBeNull();
  });
  it('recruitVillager appends a level-1 unassigned villager and deducts cost (deterministic rng)', () => {
    let s = createInitialState(0);
    s = { ...s, resources: { ...s.resources, gold: 500, acorns: 200 } };
    const out = recruitVillager(s, () => 0); // specialty=farm, name=Bram
    expect(out.villagers).toHaveLength(4);
    const nv = out.villagers[3];
    expect(nv).toMatchObject({ id: 'vil-4', level: 1, xp: 0, assignedTo: null, specialty: 'farm' });
    expect(out.resources.gold).toBe(500 - 120);
    expect(out.resources.acorns).toBe(200 - 40);
  });
  it('recruitVillager is a no-op when unaffordable or at cap', () => {
    const poor = createInitialState(0); // 0 gold
    expect(recruitVillager(poor, () => 0)).toBe(poor);
  });
});
```

Update `test/engine/achievements.test.ts`: the exact-id-list assertion adds `'full-house'`:
```ts
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual(
      ['angler','aquarist','first-friends','forest-complete','full-house','lumberjack','pet-parent','seasoned','townsfolk','veteran','wealthy'].sort(),
    );
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run test/engine/villagers.test.ts test/engine/achievements.test.ts` → FAIL.

- [ ] **Step 3: Implement recruit in `villagers.ts`**

Append (merge imports):
```ts
import type { Resources, Rng } from './types';
import { MAX_VILLAGERS, VILLAGER_NAMES } from './content';

/** Escalating gold+acorns cost by current villager count. null at cap. */
export function recruitCost(count: number): Resources | null {
  if (count >= MAX_VILLAGERS) return null;
  const mult = Math.pow(1.8, Math.max(0, count - 3));
  return { gold: Math.ceil(120 * mult), wood: 0, acorns: Math.ceil(40 * mult), fish: 0 };
}

const STATIONS: Station[] = ['farm', 'forest', 'lake'];

/** Recruit if under cap and affordable. New villager: L1, unassigned, rng-rolled specialty + name.
 *  Draw order is fixed (specialty, then name) for deterministic tests. No-op otherwise. */
export function recruitVillager(state: GameState, rng: Rng): GameState {
  const count = state.villagers.length;
  const cost = recruitCost(count);
  if (!cost) return state;
  const r = state.resources;
  if (r.gold < cost.gold || r.acorns < cost.acorns) return state;
  const specialty = STATIONS[Math.min(2, Math.floor(rng() * 3))];
  const nameIdx = Math.min(VILLAGER_NAMES.length - 1, Math.floor(rng() * VILLAGER_NAMES.length));
  const name = VILLAGER_NAMES[nameIdx] ?? `Villager ${count + 1}`;
  return {
    ...state,
    resources: { ...r, gold: r.gold - cost.gold, acorns: r.acorns - cost.acorns },
    villagers: [
      ...state.villagers,
      { id: `vil-${count + 1}`, name, emoji: '🧑‍🌾', specialty, level: 1, xp: 0, assignedTo: null },
    ],
  };
}
```

- [ ] **Step 4: Add the achievement**

In `src/engine/achievements.ts`, import `MAX_VILLAGERS` (add to the existing `./content` import), and add before the closing `]` of `ACHIEVEMENTS`:
```ts
  { id: 'full-house', name: 'Full House', emoji: '👪', description: 'Recruit a full village (8)',
    progress: (s) => clamp(s.villagers.length, MAX_VILLAGERS) },
```

- [ ] **Step 5: Add the store `recruit()` action**

In `src/store/gameStore.ts`: add `recruit: () => void;` to the interface (near `tradeWood`), import `recruitVillager` from `../engine`, and add the action (mirror `tradeWood`):
```ts
    recruit: () => commit(recruitVillager(applyElapsed(get().state, Date.now()), Math.random)),
```

- [ ] **Step 6: Run — full suite + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: green (store `assign` type still `'farm'|null` — widened in Task 6; if tsc errors only on that, proceed).

- [ ] **Step 7: Commit**
```bash
git add src/engine/villagers.ts src/engine/achievements.ts src/store/gameStore.ts test/engine/villagers.test.ts test/engine/achievements.test.ts
git commit -m "feat(engine): recruit villagers (cap 8, escalating cost) + Full House achievement"
```

---

## Task 6: UI — assignment list + recruit card

**Files:** `src/store/gameStore.ts` (widen `assign`), `src/ui/components/VillagerRow.tsx`, create `src/ui/components/RecruitCard.tsx`, `app/town.tsx`. No unit tests (RN UI — verified in live QA).

- [ ] **Step 1: Widen the store `assign` type**

In `src/store/gameStore.ts`, change the interface line and keep the impl:
```ts
  assign: (villagerId: string, to: Station | null) => void;
```
Import `Station` from `../engine` (add to the existing engine type import). The impl (`commit(assignVillager(...))`) already passes `to` through; `assignVillager` in `farm.ts` — widen its param `to: Station | null` too (find `export function assignVillager(state: GameState, villagerId: string, to: 'farm' | null)`).

- [ ] **Step 2: Rewrite `VillagerRow.tsx` as an assignment list**

Replace the file:
```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { VILLAGER_SPRITES } from '../sprites';
import { SpriteIcon } from './SpriteIcon';
import { villagerXpForLevel } from '../../engine';
import type { Station } from '../../engine';

const STATIONS: { key: Station; label: string; emoji: string }[] = [
  { key: 'farm', label: 'Farm', emoji: '🌱' },
  { key: 'forest', label: 'Forest', emoji: '🌲' },
  { key: 'lake', label: 'Lake', emoji: '🎣' },
];
const SPEC_EMOJI: Record<Station, string> = { farm: '🌱', forest: '🌲', lake: '🎣' };

export function VillagerRow() {
  const villagers = useGameStore((s) => s.state.villagers);
  const assign = useGameStore((s) => s.assign);

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🧑‍🌾 Family</Text>
      <Text style={cards.sub}>Send each helper to a station — they level up where they work</Text>
      {villagers.map((v) => {
        const need = villagerXpForLevel(v.level);
        const pct = Math.max(0, Math.min(1, v.xp / need));
        return (
          <View key={v.id} style={styles.villager}>
            <View style={styles.head}>
              <SpriteIcon sprite={VILLAGER_SPRITES[v.id]} emoji={v.emoji} size={26} />
              <View style={styles.meta}>
                <Text style={styles.name}>{v.name} <Text style={styles.lvl}>Lv {v.level}</Text></Text>
                <Text style={styles.spec}>{SPEC_EMOJI[v.specialty]} {v.specialty} specialist</Text>
              </View>
            </View>
            <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${pct * 100}%` }]} /></View>
            <View style={styles.picker}>
              {STATIONS.map((st) => {
                const on = v.assignedTo === st.key;
                return (
                  <Pressable key={st.key} style={[styles.slot, on && styles.slotOn]}
                    onPress={() => assign(v.id, on ? null : st.key)}>
                    <Text style={[styles.slotText, on && styles.slotTextOn]}>{st.emoji} {st.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.slot, v.assignedTo === null && styles.slotRest]}
                onPress={() => assign(v.id, null)}>
                <Text style={[styles.slotText, v.assignedTo === null && styles.slotTextOn]}>Rest</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  villager: { marginTop: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '700' },
  lvl: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  spec: { color: theme.textDim, fontSize: 11 },
  xpTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(150,210,160,0.15)', overflow: 'hidden' },
  xpFill: { height: 4, backgroundColor: theme.accent },
  picker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  slot: { flexGrow: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#26332a', borderWidth: 1, borderColor: 'transparent' },
  slotOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  slotRest: { borderColor: theme.cardBorder },
  slotText: { color: theme.textDim, fontSize: 11, fontWeight: '600' },
  slotTextOn: { color: theme.text },
});
```

- [ ] **Step 3: Create `RecruitCard.tsx`**

Create `src/ui/components/RecruitCard.tsx` (compute `recruitCost` in the render body from stable slices — never in a selector):
```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { recruitCost, MAX_VILLAGERS } from '../../engine';

export function RecruitCard() {
  const villagers = useGameStore((s) => s.state.villagers);
  const resources = useGameStore((s) => s.state.resources);
  const recruit = useGameStore((s) => s.recruit);

  const cost = recruitCost(villagers.length);           // computed in body — stable-ref safe
  const full = cost === null;
  const canAfford = !!cost && resources.gold >= cost.gold && resources.acorns >= cost.acorns;

  return (
    <View style={cards.card}>
      <Text style={cards.title}>🧑‍🌾 Welcome a Villager</Text>
      <Text style={cards.sub}>{full ? `Full house — ${MAX_VILLAGERS} / ${MAX_VILLAGERS}` : `Grow your village (${villagers.length} / ${MAX_VILLAGERS})`}</Text>
      <View style={styles.row}>
        <Text style={styles.cost}>{full ? '—' : `${cost!.gold}🪙 ${cost!.acorns}🌰`}</Text>
        <Pressable style={[styles.btn, (!canAfford || full) && styles.btnDisabled]}
          disabled={!canAfford || full} onPress={recruit}>
          <Text style={styles.btnText}>Recruit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cost: { color: theme.text, fontSize: 14, fontWeight: '600' },
  btn: { backgroundColor: theme.accent, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: theme.accentInk, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 4: Mount `RecruitCard` on Town**

In `app/town.tsx`: import `import { RecruitCard } from '../src/ui/components/RecruitCard';` and add `<RecruitCard />` inside the `ScrollView`, after `<TreatsCard />` (before/after `TradeCard` — either).

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: BOTH clean/green (this closes the store-type gap from earlier tasks). Confirm no test imports these UI files: `grep -rn "VillagerRow\|RecruitCard" test/` → no matches.

- [ ] **Step 6: Commit**
```bash
git add src/store/gameStore.ts src/engine/farm.ts src/ui/components/VillagerRow.tsx src/ui/components/RecruitCard.tsx app/town.tsx
git commit -m "feat(ui): villager assignment list (farm/forest/lake/rest) + Town recruit card"
```

---

## Task 7: Live QA + green-gate + merge + release

- [ ] **Step 1: Final gate**

Run: `npx vitest run && npx tsc --noEmit` → ALL green, tsc clean. Record the count.

- [ ] **Step 2: Live browser QA** (`npx expo start --web` + browse skill)

- Home → Family: each villager shows specialty + Lv + XP bar + 4-way picker. Assign Pip→Farm, Nan→Forest, Rowan→Lake; confirm no console errors, no zustand crash.
- Verify boosts: with a crop planted + Pip on Farm, barn fills; move Nan to Forest and confirm the satchel rate rises (Forest tab). Assign Rowan→Lake, creel rate rises.
- Town → Welcome a Villager: cost shows (120🪙 40🌰); recruit when affordable → a 4th villager appears (emoji sprite, some specialty), gold/acorns deducted; cost escalates. At 8 → "Full house", button disabled.
- Friends → 🏆 Milestones shows "Full House 3/8" (→ complete at 8).
- Reload /home → save NOT wiped (v7 migration), villager levels/assignments persist. Leave assigned + reload after an idle gap → XP bar advanced.

- [ ] **Step 3: Update HANDOFF.md**

Mark plan9 shipped in the LIVE block (mirror the plan8 entry style). Note release is the next step.

- [ ] **Step 4: Merge + release**
```bash
git checkout main && git merge --no-ff feat/plan9-villagers -m "feat: Plan 9 villager depth — stations + traits + leveling + recruit"
git push origin main
scripts/release.sh --yes   # bump 1.0.5 -> 1.0.6, build, sign, publish
git branch -d feat/plan9-villagers
```

---

## Self-Review notes (author)

- **Spec coverage:** Pillar 1 (stations/boost) → Tasks 2-3; Pillar 2 (traits) → Task 1 (data) + Task 3 (double via villagerBoost); Pillar 3 (leveling) → Task 4; Pillar 4 (recruit) → Task 5; save v7 → Task 1; UI → Task 6. All skeptic-hardening notes mapped: C1 (three set-sites → Tasks 1+5), H1 (version pin → Task 1), H2 (farm/idle test recompute + rewrite → Task 3), H3 (achievements id list → Task 5), M1 (keep petLeverMult → Task 3 Step 3), M2 (recruitCost in render body → Task 6 Step 3), M3 (drip-last → Task 4 Step 4).
- **Type consistency:** `Station` defined in Task 1, used identically in villagers.ts / farm assignVillager / store / UI. `villagerBoost`/`recruitCost`/`recruitVillager`/`dripVillagerXp` signatures consistent across engine + store + UI + tests.
- **Contamination guard** has an explicit test (Task 3 Step 1) — a forest villager must not change `fishRatePerSec`.
