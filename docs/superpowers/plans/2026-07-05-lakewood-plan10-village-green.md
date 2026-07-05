# Plan 10: Village Green — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Steps use `- [ ]` checkboxes.

**Goal:** Add an endgame resource sink — 8 buildable landmarks (each a small perpetual buff) + an infinite Lantern Festival track (Prosperity ×), plus a "Feed all friends" button — on the Town screen.

**Architecture:** Landmarks mirror the pet-lever pattern (`landmarks.ts` ≈ `pets.ts`): a derived `landmarkLeverMult(state, lever)` multiplies into each existing seam. Festival adds a linear `prosperityMult` into 3 leaf-rate functions. New save fields `landmarks`/`festivalLevel`; `SAVE_VERSION 7→8` additive migration. Sprites via a new `landmarks` group in `gen-sprites.py`.

**Tech Stack:** TypeScript, React Native/Expo, zustand, vitest; Python/PIL for sprites.

Spec: `docs/superpowers/specs/2026-07-05-lakewood-plan10-village-green-design.md`. Skeptic verdict BUILD-WITH-FIXES (M1 save-test bump, M2 fish-seam non-identity test) — both folded below.

---

## File map

- **Modify** `src/engine/types.ts` — add `LandmarkId`, `LandmarkLever`, `Landmark`; add `landmarks`/`festivalLevel` to `GameState`.
- **Modify** `src/engine/content.ts` — `LANDMARKS`, `LANDMARK_IDS`, `getLandmark`, festival constants.
- **Create** `src/engine/landmarks.ts` — levers + actions (`buildLandmark`, `fundFestival`, `feedAllTreats` lives in town.ts).
- **Modify** `src/engine/state.ts` — seed `landmarks: []`, `festivalLevel: 0`.
- **Modify** `src/persistence/save.ts` — `SAVE_VERSION = 8`; `addVillageGreen` migrate step.
- **Modify** seams: `farm.ts` (farmRate+prosperity), `town.ts` (barnCap, forageMult, buyTreat, tradeWoodForFish, feedAllTreats), `lake.ts` (creelCap, creelCatchChance, fishRatePerSec prosperity), `forest.ts` (forageRatePerSec prosperity), `villagers.ts` (dripVillagerXp).
- **Modify** `src/engine/index.ts` — `export * from './landmarks'`.
- **Modify** `src/store/gameStore.ts` — `buildLandmark`, `fundFestival`, `feedAll` actions.
- **Create** `src/ui/components/VillageGreenCard.tsx`; **modify** `src/ui/components/TreatsCard.tsx`, `app/town.tsx`.
- **Modify** `scripts/gen-sprites.py` (landmarks group) + `src/ui/sprites.ts` (`LANDMARK_SPRITES`); **create** `assets/landmarks/*.png`.
- **Create** `test/engine/landmarks.test.ts`; **modify** `test/persistence/save.test.ts:91`.

---

## Task 1: Types

**Files:** Modify `src/engine/types.ts`

- [ ] Add near `PetId`:
```ts
export type LandmarkId = string;
export type LandmarkLever =
  | 'treatXp' | 'catchChance' | 'forageRate' | 'villagerXp'
  | 'barnCap' | 'tradeYield' | 'creelCap' | 'farmRate';
export interface Landmark {
  id: LandmarkId;
  name: string;
  emoji: string;
  blurb: string;
  cost: Partial<Resources>;
  lever: LandmarkLever;
  amount: number;
}
```
- [ ] In `GameState` add: `landmarks: LandmarkId[];` and `festivalLevel: number;`
- [ ] `npx tsc --noEmit` will now fail in `state.ts`/`save.ts` (missing fields) — expected until Task 3.

---

## Task 2: Content

**Files:** Modify `src/engine/content.ts` (import `Landmark, LandmarkId` from types)

- [ ] Append:
```ts
// --- Plan 10: Village Green landmarks (one-time builds, each a small perpetual buff) ---
export const LANDMARKS: Record<LandmarkId, Landmark> = {
  bakery:   { id: 'bakery',   name: 'Bakery',       emoji: '🍞', blurb: 'Warm treats go further.',      lever: 'treatXp',     amount: 0.25, cost: { gold: 1200, wood: 400, acorns: 300 } },
  fountain: { id: 'fountain', name: 'Fountain',     emoji: '⛲', blurb: 'Shy pond-folk come closer.',    lever: 'catchChance', amount: 0.05, cost: { gold: 1600, fish: 200 } },
  lanterns: { id: 'lanterns', name: 'Lantern Row',  emoji: '🏮', blurb: 'Foragers work by lantern-light.', lever: 'forageRate', amount: 0.10, cost: { gold: 1000, wood: 800, acorns: 200 } },
  bridge:   { id: 'bridge',   name: 'Stone Bridge', emoji: '🌉', blurb: 'Villagers learn faster.',       lever: 'villagerXp',  amount: 0.20, cost: { gold: 2000, wood: 1200 } },
  gazebo:   { id: 'gazebo',   name: 'Gazebo',       emoji: '🏛️', blurb: 'A roomier barn.',              lever: 'barnCap',     amount: 0.15, cost: { gold: 2500, wood: 900, acorns: 600 } },
  market:   { id: 'market',   name: 'Market Stall', emoji: '🪧', blurb: 'Better trades at the post.',     lever: 'tradeYield',  amount: 0.50, cost: { gold: 1800, wood: 600, acorns: 400, fish: 300 } },
  koipond:  { id: 'koipond',  name: 'Koi Pond',     emoji: '🎏', blurb: 'The creel holds more.',         lever: 'creelCap',    amount: 0.15, cost: { gold: 2200, fish: 800 } },
  windmill: { id: 'windmill', name: 'Windmill',     emoji: '🌬️', blurb: 'The whole farm hums along.',    lever: 'farmRate',    amount: 0.10, cost: { gold: 3000, wood: 1500, acorns: 800 } },
};
export const LANDMARK_IDS: LandmarkId[] = Object.keys(LANDMARKS);
export function getLandmark(id: string): Landmark | undefined { return LANDMARKS[id]; }

// Lantern Festival — infinite tail unlocked once all 8 landmarks are built.
export const FESTIVAL_PROSPERITY_PER_LEVEL = 0.02;
export const FESTIVAL_BASE_COST: Resources = { gold: 4000, wood: 2000, acorns: 2000, fish: 1000 };
export const FESTIVAL_COST_GROWTH = 1.15;
```

---

## Task 3: State seed + save migration

**Files:** Modify `src/engine/state.ts`, `src/persistence/save.ts`, `test/persistence/save.test.ts`

- [ ] In `createInitialState` return object add: `landmarks: [],` and `festivalLevel: 0,` (next to `pets: []`).
- [ ] `save.ts`: `export const SAVE_VERSION = 8;`
- [ ] Add migrate step (after `addVillagerDepth`, unconditional per-field `??`):
```ts
s = addVillageGreen(s);
```
```ts
/** v7->v8: Village Green fields. Per-field ?? (0 ?? 0 === 0 preserves a real festivalLevel 0). Idempotent. */
function addVillageGreen(old: GameState): GameState {
  const o = old as Partial<GameState>;
  return { ...old, landmarks: o.landmarks ?? [], festivalLevel: o.festivalLevel ?? 0 };
}
```
- [ ] Update the migrate JSDoc chain comment to end `…->v7(villagers)->v8(village green)`.
- [ ] `test/persistence/save.test.ts:91`: change `expect(SAVE_VERSION).toBe(7);` → `.toBe(8);`
- [ ] `npx tsc --noEmit` clean; `npx vitest run test/persistence/save.test.ts` green.
- [ ] Commit: `feat(engine): Village Green types/content/state + save v7->v8`

---

## Task 4: landmarks.ts engine (TDD)

**Files:** Create `src/engine/landmarks.ts`, `test/engine/landmarks.test.ts`; modify `src/engine/index.ts`

- [ ] **Test first** `test/engine/landmarks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import {
  landmarkLeverMult, landmarkCatchBonus, prosperityMult,
  canBuildLandmark, buildLandmark, allLandmarksBuilt,
  festivalCost, canFundFestival, fundFestival,
} from '../../src/engine/landmarks';
import { LANDMARK_IDS, LANDMARKS, FESTIVAL_BASE_COST } from '../../src/engine/content';

const rich = () => ({ ...createInitialState(0), resources: { gold: 1e6, wood: 1e6, acorns: 1e6, fish: 1e6 } });

describe('landmark levers', () => {
  it('identity when none built', () => {
    const s = createInitialState(0);
    expect(landmarkLeverMult(s, 'farmRate')).toBe(1);
    expect(landmarkCatchBonus(s)).toBe(0);
    expect(prosperityMult(s)).toBe(1);
  });
  it('sums only built landmarks on the matching lever', () => {
    const s = { ...rich(), landmarks: ['windmill'] }; // farmRate 0.10
    expect(landmarkLeverMult(s, 'farmRate')).toBeCloseTo(1.10);
    expect(landmarkLeverMult(s, 'barnCap')).toBe(1);
  });
  it('fountain feeds catch bonus additively', () => {
    expect(landmarkCatchBonus({ ...rich(), landmarks: ['fountain'] })).toBeCloseTo(0.05);
  });
});

describe('buildLandmark', () => {
  it('pays exact cost and appends when affordable', () => {
    const s = buildLandmark(rich(), 'bakery');
    expect(s.landmarks).toContain('bakery');
    expect(s.resources.gold).toBe(1e6 - LANDMARKS.bakery.cost.gold!);
    expect(s.resources.acorns).toBe(1e6 - LANDMARKS.bakery.cost.acorns!);
  });
  it('no-op (same ref) when unaffordable / duplicate / unknown', () => {
    const poor = createInitialState(0);
    expect(buildLandmark(poor, 'bakery')).toBe(poor);
    const built = buildLandmark(rich(), 'bakery');
    expect(buildLandmark(built, 'bakery')).toBe(built);
    const s = rich();
    expect(buildLandmark(s, 'nope')).toBe(s);
  });
});

describe('festival', () => {
  it('cost scales by growth^level', () => {
    expect(festivalCost(0)).toEqual(FESTIVAL_BASE_COST);
    expect(festivalCost(1).gold).toBe(Math.ceil(FESTIVAL_BASE_COST.gold * 1.15));
  });
  it('gated on all 8 landmarks built', () => {
    expect(canFundFestival(rich())).toBe(false);
    const all = { ...rich(), landmarks: [...LANDMARK_IDS] };
    expect(allLandmarksBuilt(all)).toBe(true);
    expect(canFundFestival(all)).toBe(true);
  });
  it('fundFestival pays + increments; prosperity is linear', () => {
    const all = { ...rich(), landmarks: [...LANDMARK_IDS] };
    const s = fundFestival(all);
    expect(s.festivalLevel).toBe(1);
    expect(s.resources.gold).toBe(1e6 - FESTIVAL_BASE_COST.gold);
    expect(prosperityMult(s)).toBeCloseTo(1.02);
  });
});
```
- [ ] Run → FAIL (module missing).
- [ ] Implement `src/engine/landmarks.ts`:
```ts
import type { GameState, LandmarkLever, Resources } from './types';
import {
  LANDMARKS, LANDMARK_IDS, getLandmark,
  FESTIVAL_PROSPERITY_PER_LEVEL, FESTIVAL_BASE_COST, FESTIVAL_COST_GROWTH,
} from './content';

function sumFor(state: GameState, lever: LandmarkLever): number {
  let sum = 0;
  for (const id of state.landmarks) {
    const def = LANDMARKS[id];
    if (def && def.lever === lever) sum += def.amount;
  }
  return sum;
}
export function landmarkLeverMult(state: GameState, lever: Exclude<LandmarkLever, 'catchChance'>): number {
  return 1 + sumFor(state, lever);
}
export function landmarkCatchBonus(state: GameState): number {
  return sumFor(state, 'catchChance');
}
export function prosperityMult(state: GameState): number {
  return 1 + FESTIVAL_PROSPERITY_PER_LEVEL * state.festivalLevel;
}
export function allLandmarksBuilt(state: GameState): boolean {
  return state.landmarks.length === LANDMARK_IDS.length;
}
function affordable(r: Resources, cost: Partial<Resources>): boolean {
  return r.gold >= (cost.gold ?? 0) && r.wood >= (cost.wood ?? 0)
    && r.acorns >= (cost.acorns ?? 0) && r.fish >= (cost.fish ?? 0);
}
function pay(r: Resources, cost: Partial<Resources>): Resources {
  return {
    gold: r.gold - (cost.gold ?? 0), wood: r.wood - (cost.wood ?? 0),
    acorns: r.acorns - (cost.acorns ?? 0), fish: r.fish - (cost.fish ?? 0),
  };
}
export function canBuildLandmark(state: GameState, id: string): boolean {
  const def = getLandmark(id);
  if (!def || state.landmarks.includes(id)) return false;
  return affordable(state.resources, def.cost);
}
export function buildLandmark(state: GameState, id: string): GameState {
  if (!canBuildLandmark(state, id)) return state;
  const def = getLandmark(id)!;
  return { ...state, resources: pay(state.resources, def.cost), landmarks: [...state.landmarks, id] };
}
export function festivalCost(level: number): Resources {
  const m = Math.pow(FESTIVAL_COST_GROWTH, level);
  return {
    gold: Math.ceil(FESTIVAL_BASE_COST.gold * m), wood: Math.ceil(FESTIVAL_BASE_COST.wood * m),
    acorns: Math.ceil(FESTIVAL_BASE_COST.acorns * m), fish: Math.ceil(FESTIVAL_BASE_COST.fish * m),
  };
}
export function canFundFestival(state: GameState): boolean {
  if (!allLandmarksBuilt(state)) return false;
  return affordable(state.resources, festivalCost(state.festivalLevel));
}
export function fundFestival(state: GameState): GameState {
  if (!canFundFestival(state)) return state;
  const cost = festivalCost(state.festivalLevel);
  return { ...state, resources: pay(state.resources, cost), festivalLevel: state.festivalLevel + 1 };
}
```
- [ ] `src/engine/index.ts`: add `export * from './landmarks';`
- [ ] Run tests → PASS. `npx tsc --noEmit` clean.
- [ ] Commit: `feat(engine): landmarks.ts — levers, build, festival (TDD)`

---

## Task 5: Wire buff seams + prosperity (TDD guarded)

**Files:** Modify `farm.ts`, `town.ts`, `lake.ts`, `forest.ts`, `villagers.ts`; extend `test/engine/landmarks.test.ts`

Each edit adds a factor that is ×1.0 at defaults (regression-safe). Import `landmarkLeverMult`/`landmarkCatchBonus`/`prosperityMult` from `./landmarks` in each file.

- [ ] `farm.ts` `farmRatesPerSec`: change
  `const multiplier = boost * petLeverMult(state, 'farmRate');`
  →
  `const multiplier = boost * petLeverMult(state, 'farmRate') * landmarkLeverMult(state, 'farmRate') * prosperityMult(state);`
- [ ] `town.ts` `barnCapMult`: append `* landmarkLeverMult(state, 'barnCap')`.
- [ ] `town.ts` `forageMult`: append `* landmarkLeverMult(state, 'forageRate')`.
- [ ] `lake.ts` `creelCap`: change `base * petLeverMult(state,'creelCap')` → `base * petLeverMult(state,'creelCap') * landmarkLeverMult(state,'creelCap')`.
- [ ] `lake.ts` `creelCatchChance`: final line → `return Math.min(1, marigoldChance + petCatchBonus(state) + landmarkCatchBonus(state));`
- [ ] `forest.ts` `forageRatePerSec`: `return base * forageMult(state) * prosperityMult(state);`
- [ ] `lake.ts` `fishRatePerSec` (⚠ M2 — rewrite, prosperity on rod term ONLY):
  `return (BASE_ROD_RATE * prosperityMult(state) + forageRatePerSec(state, 'fish')) * villagerBoost(state, 'lake');`
- [ ] `villagers.ts` `dripVillagerXp`: `const gain = VILLAGER_XP_PER_SEC * elapsedSec * landmarkLeverMult(state, 'villagerXp');`
- [ ] Add regression + non-identity tests to `test/engine/landmarks.test.ts`:
```ts
import { farmRatesPerSec } from '../../src/engine/farm';
import { fishRatePerSec, creelCap, creelCatchChance } from '../../src/engine/lake';
import { barnCapMult, forageMult } from '../../src/engine/town';

describe('buff seams', () => {
  const base = () => {
    const s = rich();
    // one farm villager + one fish forager so rates are nonzero
    return {
      ...s,
      villagers: s.villagers.map(v => ({ ...v, assignedTo: v.specialty })),
      creatures: [{ id: 'cr-x', species: 'ripplefrog', name: 'R', emoji: '🐸', rarity: 'common', affinity: 'fish', level: 1, xp: 0, assignment: { type: 'forage', dungeonId: null, startedAt: 0 } }],
    } as any;
  };
  it('windmill lifts farm output ~10%', () => {
    const b = base();
    const w = { ...b, landmarks: ['windmill'] };
    expect(farmRatesPerSec(w).gold).toBeCloseTo(farmRatesPerSec(b).gold * 1.10, 6);
  });
  it('gazebo lifts barnCapMult 15%, lanterns forageMult 10%', () => {
    expect(barnCapMult({ ...rich(), landmarks: ['gazebo'] })).toBeCloseTo(barnCapMult(rich()) * 1.15, 6);
    expect(forageMult({ ...rich(), landmarks: ['lanterns'] })).toBeCloseTo(forageMult(rich()) * 1.10, 6);
  });
  it('fountain adds 0.05 catch chance', () => {
    const b = base();
    expect(creelCatchChance({ ...b, landmarks: ['fountain'] })).toBeCloseTo(creelCatchChance(b) + 0.05, 6);
  });
  it('M2: prosperity scales rod + forager each exactly once (no double count)', () => {
    const b = base();
    const p = { ...b, festivalLevel: 25 }; // prosperity 1.5
    // forageRatePerSec already carries prosperity, rod term multiplied separately → whole rate ×1.5
    expect(fishRatePerSec(p)).toBeCloseTo(fishRatePerSec(b) * 1.5, 6);
  });
});
```
- [ ] Run full suite `npx vitest run` → all green (existing exact-value tests unchanged at defaults). Fix any surprise.
- [ ] `npx tsc --noEmit` clean.
- [ ] Commit: `feat(engine): wire landmark buffs + festival prosperity into seams`

---

## Task 6: feedAllTreats + treat XP buff (TDD)

**Files:** Modify `src/engine/town.ts`; extend `test/engine/landmarks.test.ts`

- [ ] `town.ts` `buyTreat`: XP now buffed — replace `grantXp(c, TREAT_XP)` with `grantXp(c, treatXp(state))` where:
```ts
import { landmarkLeverMult } from './landmarks';
function treatXp(state: GameState): number {
  return Math.round(TREAT_XP * landmarkLeverMult(state, 'treatXp'));
}
```
(Keep the acorn cost + guards identical.)
- [ ] Add `feedAllTreats`:
```ts
/** Treat every creature once in roster order, spending TREAT_COST_ACORNS each, until acorns run out.
 *  No-op (same ref) when no creatures or < one treat's cost. */
export function feedAllTreats(state: GameState): GameState {
  if (state.creatures.length === 0 || state.resources.acorns < TREAT_COST_ACORNS) return state;
  let acorns = state.resources.acorns;
  const xp = treatXp(state);
  const creatures = state.creatures.map((c) => {
    if (acorns < TREAT_COST_ACORNS) return c;
    acorns -= TREAT_COST_ACORNS;
    return grantXp(c, xp);
  });
  return { ...state, resources: { ...state.resources, acorns }, creatures };
}
```
- [ ] Tests:
```ts
import { buyTreat, feedAllTreats } from '../../src/engine/town';
describe('treats', () => {
  const withCreatures = (n: number, acorns: number) => ({
    ...createInitialState(0),
    resources: { gold: 0, wood: 0, acorns, fish: 0 },
    creatures: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, species: 'fernling', name: 'F', emoji: '🌱', rarity: 'common', affinity: 'acorn', level: 1, xp: 0, assignment: { type: 'idle', dungeonId: null, startedAt: 0 } })),
  } as any);
  it('feeds all when affordable, spends exact acorns', () => {
    const s = feedAllTreats(withCreatures(3, 100));
    expect(s.resources.acorns).toBe(100 - 75);
    expect(s.creatures.every(c => c.xp > 0 || c.level > 1)).toBe(true);
  });
  it('feeds only as many as affordable', () => {
    const s = feedAllTreats(withCreatures(3, 60)); // 2 treats
    expect(s.resources.acorns).toBe(60 - 50);
  });
  it('no-op when broke', () => {
    const poor = withCreatures(3, 10);
    expect(feedAllTreats(poor)).toBe(poor);
  });
  it('bakery boosts treat XP', () => {
    const s = withCreatures(1, 100);
    const boosted = { ...s, landmarks: ['bakery'] };
    expect(buyTreat(boosted, 'c0').creatures[0].xp).toBeGreaterThan(buyTreat(s, 'c0').creatures[0].xp);
  });
});
```
- [ ] Run → PASS; `npx tsc --noEmit` clean.
- [ ] Commit: `feat(engine): feedAllTreats + bakery treat-XP buff`

---

## Task 7: Store actions

**Files:** Modify `src/store/gameStore.ts`

- [ ] Import `buildLandmark, fundFestival, feedAllTreats` from `../engine`.
- [ ] Add to `GameStore` interface: `buildLandmark: (id: string) => void; fundFestival: () => void; feedAll: () => void;`
- [ ] Add actions (same `applyElapsed`→`commit` shape):
```ts
buildLandmark: (id) => commit(buildLandmark(applyElapsed(get().state, Date.now()), id)),
fundFestival: () => commit(fundFestival(applyElapsed(get().state, Date.now()))),
feedAll: () => commit(feedAllTreats(applyElapsed(get().state, Date.now()))),
```
- [ ] `npx tsc --noEmit` clean. Commit: `feat(store): landmark/festival/feed-all actions`

---

## Task 8: Sprites

**Files:** Modify `scripts/gen-sprites.py`, `src/ui/sprites.ts`; create `assets/landmarks/*.png`

- [ ] In `gen-sprites.py`, add 8 `draw_<id>()` functions (bakery, fountain, lanterns, bridge, gazebo, market, koipond, windmill) using existing primitives (`canvas`, `band`, `outline`, `crunch`, rectangles/ellipses/polygons) in the same cel-band + dark-outline style as `draw_wheat`/`draw_sapling`. Inanimate structures — NO `eyes`/`smile`/`blush`. Each ≤20 colors, centered in the 512 canvas, filling ~NATIVE 30–40px of the 44 native grid.
- [ ] Add group to `SPRITES`: `'landmarks': {'dir': 'landmarks', 'draw': { 'bakery': draw_bakery, ... }}`.
- [ ] Extend `contact_sheet()` file glob to include `sorted((ROOT/'assets').glob('landmarks/*.png'))`.
- [ ] Run `python3 scripts/gen-sprites.py landmarks` → 8 PNGs at 64×64, each printing ≤20 colors (no `TOO MANY COLORS`). Regenerate contact sheet, eyeball it.
- [ ] `src/ui/sprites.ts`: add
```ts
import type { ... LandmarkId } from '../engine/types';
export const LANDMARK_SPRITES: Partial<Record<LandmarkId, ImageSourcePropType>> = {
  bakery: require('../../assets/landmarks/bakery.png'),
  fountain: require('../../assets/landmarks/fountain.png'),
  lanterns: require('../../assets/landmarks/lanterns.png'),
  bridge: require('../../assets/landmarks/bridge.png'),
  gazebo: require('../../assets/landmarks/gazebo.png'),
  market: require('../../assets/landmarks/market.png'),
  koipond: require('../../assets/landmarks/koipond.png'),
  windmill: require('../../assets/landmarks/windmill.png'),
};
```
(Every entry must point at a file that EXISTS — Metro breaks on a missing require.)
- [ ] Commit: `feat(art): landmark sprites (16-bit gen pipeline)`

---

## Task 9: UI

**Files:** Create `src/ui/components/VillageGreenCard.tsx`; modify `TreatsCard.tsx`, `app/town.tsx`

- [ ] `VillageGreenCard.tsx`: a `LandmarkIcon` (mirrors `CreatureIcon`, uses `LANDMARK_SPRITES`), then a card listing each landmark via `LANDMARK_IDS`: sprite/emoji, name, blurb, buff+cost line, **Build** button (`canBuildLandmark` → disabled/greyed; built → "✓ built" with buff). When `allLandmarksBuilt`, render a Lantern Festival sub-card: `🏮 Lantern Festival`, current `Prosperity ×{(prosperityMult*100-100).toFixed(0)}%`, next-level `festivalCost(festivalLevel)` cost line, **Hold Festival** button (`canFundFestival`). Reuse `costLine`/`fmt` styling from `HabitatCard`. Selectors: subscribe to `s.state` then derive (never compute in selector).
- [ ] `TreatsCard.tsx`: add a **"Feed all · {N}🌰"** button (N = `Math.min(creatures.length, floor(acorns/25))*25`) that calls `feedAll`, disabled when `acorns < TREAT_COST_ACORNS`. Place above the per-creature list.
- [ ] `app/town.tsx`: import + render `<VillageGreenCard />` after `<TreatsCard />` (before RecruitCard, or at the end — cozy build stuff grouped).
- [ ] `npx tsc --noEmit` clean. Commit: `feat(ui): Village Green card + Feed-all button`

---

## Task 10: QA gate + release

- [ ] `npx tsc --noEmit` → clean.
- [ ] `npx vitest run` → full suite green.
- [ ] Sanity: build Metro bundle check if fast (`npx expo export --platform android` optional) OR trust tsc+prebuild in release.
- [ ] `scripts/release.sh --yes` → bumps to v1.0.7 / versionCode 8, prebuild, gradle assembleRelease, sign, verify, tag `v1.0.7`, `gh release create`, publish. (Founder pre-authorized publish.)
- [ ] Update `HANDOFF.md`: Plan 10 shipped + version published.

---

## Self-review notes
- Spec coverage: §2–9 each map to Tasks 1–9; §11 → Task 10. ✓
- Skeptic M1 (save-test) → Task 3; M2 (fish non-identity test) → Task 5. ✓
- Type consistency: `landmarkLeverMult`/`landmarkCatchBonus`/`prosperityMult`/`buildLandmark`/`fundFestival`/`feedAllTreats`/`canFundFestival`/`allLandmarksBuilt` used identically across tasks. ✓
- No placeholders — all code inline. ✓
