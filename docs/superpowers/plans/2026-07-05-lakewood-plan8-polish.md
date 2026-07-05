# Plan 8 — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subtle idle bob to every sprite, a lifetime-counter-backed achievements/milestones system shown on the Friends screen, and refresh the 3 weakest sprite arts.

**Architecture:** Achievements are PURE DERIVATIONS over game state — the only new persisted state is a `lifetime` counter object, bumped inside the four collect functions and backfilled by an additive v5→v6 save migration. The idle bob is one shared module-level `Animated.Value` in `SpriteIcon`, lazy-started on first render (import stays side-effect-free for node/vitest). The art pass is mechanical edits to `gen-sprites.py`.

**Tech Stack:** React Native / Expo, react-native-web (browser QA), TypeScript, Zustand v5, vitest, Python/PIL (sprite generator).

Spec: `docs/superpowers/specs/2026-07-05-lakewood-plan8-polish-design.md`. Base: branch `feat/plan8-polish`, HEAD after `ae3b962`, save v5, 177/177 green.

---

## File Structure

- `src/engine/types.ts` — add `Lifetime` interface + `lifetime` field on `GameState` (MODIFY)
- `src/engine/lifetime.ts` — pure `bumpLifetime(state, delta)` helper (CREATE)
- `src/engine/state.ts` — seed `lifetime` zeros in `createInitialState` (MODIFY)
- `src/engine/farm.ts` / `forest.ts` / `lake.ts` — bump lifetime inside the 4 collect fns (MODIFY)
- `src/engine/index.ts` — re-export `lifetime` + `achievements` (MODIFY)
- `src/persistence/save.ts` — `SAVE_VERSION=6` + `addLifetimeCounters` migration (MODIFY)
- `src/engine/achievements.ts` — `ACHIEVEMENTS`, `isComplete`, `completedCount` (CREATE)
- `src/ui/components/MilestonesSection.tsx` — the 🏆 section (CREATE)
- `src/ui/components/FriendsJournal.tsx` — mount `MilestonesSection` (MODIFY)
- `src/ui/components/SpriteIcon.tsx` — Animated bob wrapper (MODIFY)
- `scripts/gen-sprites.py` — redraw pebbleturtle / wheat / vil-1 (MODIFY)
- Tests: `test/engine/lifetime.test.ts`, `test/engine/achievements.test.ts` (CREATE); extend `test/engine/{farm,forest,lake}.test.ts` + `test/persistence/save.test.ts` (MODIFY)

---

## Task 1: `lifetime` state field + `bumpLifetime` helper

**Files:**
- Modify: `src/engine/types.ts` (add `Lifetime`, extend `GameState`)
- Create: `src/engine/lifetime.ts`
- Modify: `src/engine/state.ts` (seed zeros)
- Modify: `src/engine/index.ts` (re-export)
- Test: `test/engine/lifetime.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/engine/lifetime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { bumpLifetime } from '../../src/engine/lifetime';

describe('lifetime', () => {
  it('createInitialState seeds all lifetime counters at zero', () => {
    const s = createInitialState(0);
    expect(s.lifetime).toEqual({ gold: 0, wood: 0, acorns: 0, fish: 0 });
  });

  it('bumpLifetime adds a partial delta and leaves other keys unchanged', () => {
    const s = createInitialState(0);
    const next = bumpLifetime(s, { fish: 5, gold: 2 });
    expect(next.lifetime).toEqual({ gold: 2, wood: 0, acorns: 0, fish: 5 });
    expect(s.lifetime.fish).toBe(0); // pure — original untouched
  });

  it('bumpLifetime accumulates across calls', () => {
    let s = createInitialState(0);
    s = bumpLifetime(s, { wood: 3 });
    s = bumpLifetime(s, { wood: 4, acorns: 1 });
    expect(s.lifetime).toEqual({ gold: 0, wood: 7, acorns: 1, fish: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine/lifetime.test.ts`
Expected: FAIL — `bumpLifetime` is not exported / `lifetime` undefined.

- [ ] **Step 3: Add the `Lifetime` type and `GameState.lifetime` field**

In `src/engine/types.ts`, after the `Resources` interface add:

```ts
/** Cumulative counters that only ever go up — never spent. Backs achievements. */
export interface Lifetime {
  gold: number;
  wood: number;
  acorns: number;
  fish: number;
}
```

Then in `interface GameState`, add the field (next to `pets`):

```ts
  lifetime: Lifetime; // cumulative banked totals; additive save v6
```

- [ ] **Step 4: Create the helper**

Create `src/engine/lifetime.ts`:

```ts
import type { GameState, Lifetime } from './types';

/** Add a partial delta onto the cumulative lifetime counters. Pure. Absent keys add 0. */
export function bumpLifetime(state: GameState, delta: Partial<Lifetime>): GameState {
  return {
    ...state,
    lifetime: {
      gold: state.lifetime.gold + (delta.gold ?? 0),
      wood: state.lifetime.wood + (delta.wood ?? 0),
      acorns: state.lifetime.acorns + (delta.acorns ?? 0),
      fish: state.lifetime.fish + (delta.fish ?? 0),
    },
  };
}
```

- [ ] **Step 5: Seed zeros in `createInitialState`**

In `src/engine/state.ts`, inside the returned object add (after `pets: [],`):

```ts
    lifetime: { gold: 0, wood: 0, acorns: 0, fish: 0 },
```

- [ ] **Step 6: Re-export from the engine barrel**

In `src/engine/index.ts`, add a line:

```ts
export * from './lifetime';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run test/engine/lifetime.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — `createInitialState` is fine, but `save.ts`/tests that build a `GameState` literal without `lifetime` may error. That is expected and fixed in Task 3. If the ONLY errors are "missing lifetime" in `save.ts`/tests, proceed. Note them.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/lifetime.ts src/engine/state.ts src/engine/index.ts test/engine/lifetime.test.ts
git commit -m "feat(engine): lifetime counters + bumpLifetime helper"
```

---

## Task 2: Bump lifetime inside the four collect functions

Each collect function banks the FLOORED whole-unit amount into `resources`. Bump `lifetime` by the SAME floored value, using the exact local variable already computed (never re-derive). Bump AFTER any `bank <= 0` early return so an empty collect adds nothing.

**Files:**
- Modify: `src/engine/farm.ts` (`collectBarn`), `src/engine/forest.ts` (`collectSatchel`, `collectRun`), `src/engine/lake.ts` (`collectCreel`)
- Test: extend `test/engine/farm.test.ts`, `test/engine/forest.test.ts`, `test/engine/lake.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `test/engine/lake.test.ts`:

```ts
import { collectCreel } from '../../src/engine';
// ... within a describe:
it('collectCreel bumps lifetime.fish by the floored bank; the wood->fish trade never does', () => {
  const base = createInitialState(0);
  const withCreel = { ...base, storage: { ...base.storage, creel: { fish: 4.7 } } };
  const collected = collectCreel(withCreel, () => 0.99); // rng high → no pet catch
  expect(collected.lifetime.fish).toBe(4);      // floored
  expect(collected.resources.fish).toBe(4);
  expect(collected.storage.creel.fish).toBeCloseTo(0.7, 5);
});

it('collectCreel on an empty creel bumps nothing', () => {
  const s = createInitialState(0);
  expect(collectCreel(s, () => 0.99).lifetime.fish).toBe(0);
});
```

Append to `test/engine/farm.test.ts`:

```ts
import { collectBarn } from '../../src/engine';
it('collectBarn bumps lifetime by the floored bank per resource', () => {
  const base = createInitialState(0);
  const s = { ...base, storage: { ...base.storage, barn: { gold: 10.9, wood: 3.2, acorns: 0 } } };
  const out = collectBarn(s);
  expect(out.lifetime).toEqual({ gold: 10, wood: 3, acorns: 0, fish: 0 });
});
```

Append to `test/engine/forest.test.ts`:

```ts
import { collectSatchel } from '../../src/engine';
it('collectSatchel bumps lifetime.wood and lifetime.acorns by the floored bank', () => {
  const base = createInitialState(0);
  const s = { ...base, storage: { ...base.storage, satchel: { wood: 6.4, acorn: 2.9 } } };
  const out = collectSatchel(s, () => 0.99); // rng high → no discovery
  expect(out.lifetime.wood).toBe(6);
  expect(out.lifetime.acorns).toBe(2);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/engine/lake.test.ts test/engine/farm.test.ts test/engine/forest.test.ts`
Expected: FAIL — lifetime stays 0 (not yet bumped).

- [ ] **Step 3: Wire `collectBarn` (farm.ts)**

Add import at top of `src/engine/farm.ts`:

```ts
import { bumpLifetime } from './lifetime';
import type { GameState, CropId, BarnResource, Lifetime } from './types';
```
(merge the `Lifetime` into the existing `import type` line).

Rewrite `collectBarn`:

```ts
export function collectBarn(state: GameState): GameState {
  const barn = { ...state.storage.barn };
  const resources = { ...state.resources };
  const gained: Partial<Lifetime> = {};
  for (const res of BARN_RESOURCES) {
    const banked = Math.floor(barn[res]);
    if (banked <= 0) continue;
    resources[res] += banked;
    barn[res] -= banked;
    gained[res] = banked;
  }
  const next = { ...state, resources, storage: { ...state.storage, barn } };
  return bumpLifetime(next, gained);
}
```

- [ ] **Step 4: Wire `collectSatchel` and `collectRun` (forest.ts)**

Add import at top of `src/engine/forest.ts`:

```ts
import { bumpLifetime } from './lifetime';
```

In `collectSatchel`, change the final return so it bumps before rolling discovery:

```ts
  const withLifetime = bumpLifetime(banked, { wood: bankWood, acorns: bankAcorn });
  return rollDiscovery(withLifetime, FORAGE_DISCOVERY_CHANCE, rng);
```

In `collectRun`, extract the floored loot into named consts and reuse them for both `resources` and the bump. Replace the `paid` block:

```ts
  const gainGold = Math.floor(def.loot.gold * mult);
  const gainWood = Math.floor(def.loot.wood * mult);
  const gainAcorns = Math.floor(def.loot.acorn * mult);
  const paid: GameState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + gainGold,
      wood: state.resources.wood + gainWood,
      acorns: state.resources.acorns + gainAcorns,
    },
    creatures: state.creatures.map((c) =>
      run.creatureIds.includes(c.id)
        ? grantXp({ ...c, assignment: { type: 'idle', dungeonId: null, startedAt: 0 } }, def.xpReward)
        : c,
    ),
    dungeons: state.dungeons.map((d) => (d.id === dungeonId ? { ...d, activeRun: null } : d)),
  };
  const withLifetime = bumpLifetime(paid, { gold: gainGold, wood: gainWood, acorns: gainAcorns });
  return rollDiscovery(withLifetime, Math.min(0.95, def.baseDiscoveryChance * mult), rng);
```

- [ ] **Step 5: Wire `collectCreel` (lake.ts)**

Add import at top of `src/engine/lake.ts`:

```ts
import { bumpLifetime } from './lifetime';
```

In `collectCreel`, bump on the banked state before rolling the catch:

```ts
  const banked: GameState = {
    ...state,
    resources: { ...state.resources, fish: state.resources.fish + bankFish },
    storage: { ...state.storage, creel: { fish: state.storage.creel.fish - bankFish } },
  };
  const withLifetime = bumpLifetime(banked, { fish: bankFish });
  return rollCatch(withLifetime, creelCatchChance(state), rng);
```

(Leave the pre-bank `creelCatchChance(state)` argument exactly as-is — the dormancy semantics depend on the PRE-bank state.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/engine/lake.test.ts test/engine/farm.test.ts test/engine/forest.test.ts`
Expected: PASS (new + existing cases green).

- [ ] **Step 7: Full suite (expect only the save version-pin to fail, fixed next task)**

Run: `npx vitest run`
Expected: the ONLY failures are in `test/persistence/save.test.ts` (deep-equal round-trips now carry `lifetime`, and the `SAVE_VERSION` pin) — Task 3 fixes them. If any OTHER test fails, stop and investigate.

- [ ] **Step 8: Commit**

```bash
git add src/engine/farm.ts src/engine/forest.ts src/engine/lake.ts test/engine/farm.test.ts test/engine/forest.test.ts test/engine/lake.test.ts
git commit -m "feat(engine): collect fns bump lifetime counters (fishing/barn/satchel/dungeon)"
```

---

## Task 3: Save migration v5 → v6 (additive, per-field backfill)

**Files:**
- Modify: `src/persistence/save.ts`
- Test: `test/persistence/save.test.ts`

- [ ] **Step 1: Write the failing tests**

In `test/persistence/save.test.ts`, update the version-pin assertion (find `expect(SAVE_VERSION).toBe(5)`) to:

```ts
    expect(SAVE_VERSION).toBe(6);
```

Add a new describe block:

```ts
describe('v5 -> v6 lifetime migration', () => {
  it('backfills lifetime zeros on a v5 save and does not wipe it', () => {
    const s5 = { ...createInitialState(0), resources: { gold: 42, wood: 0, acorns: 0, fish: 9 } };
    delete (s5 as { lifetime?: unknown }).lifetime;         // simulate a real v5 blob (no lifetime)
    const blob = JSON.stringify({ version: 5, state: s5 });
    const restored = deserialize(blob);
    expect(restored.resources.gold).toBe(42);               // not wiped
    expect(restored.lifetime).toEqual({ gold: 0, wood: 0, acorns: 0, fish: 0 });
  });

  it('backfills a PARTIAL lifetime object per field (no NaN)', () => {
    const s = { ...createInitialState(0) };
    (s as { lifetime: unknown }).lifetime = { gold: 5 };    // partial (bad import)
    const restored = tryDeserialize(JSON.stringify({ version: 6, state: s }));
    expect(restored?.lifetime).toEqual({ gold: 5, wood: 0, acorns: 0, fish: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/persistence/save.test.ts`
Expected: FAIL — version pin + missing/partial `lifetime`.

- [ ] **Step 3: Bump the version and add the migration**

In `src/persistence/save.ts`:

Change the constant:

```ts
export const SAVE_VERSION = 6;
```

Add `< 6` to the migrate chain (after the `addCropRework` line):

```ts
  if (fromVersion < 5) s = addCropRework(s);
  if (fromVersion < 6) s = addLifetimeCounters(s);
  return s;
```

Add the migration function (mirror `addLakeFields`'s per-field `??` style):

```ts
/** v5->v6: backfill cumulative lifetime counters. Per-field ?? so a partial import blob
 *  ({lifetime:{gold:5}}) can't leave an undefined key that a later bump turns into NaN. */
function addLifetimeCounters(old: GameState): GameState {
  const l = old.lifetime as Partial<GameState['lifetime']> | undefined;
  return {
    ...old,
    lifetime: {
      gold: l?.gold ?? 0,
      wood: l?.wood ?? 0,
      acorns: l?.acorns ?? 0,
      fish: l?.fish ?? 0,
    },
  };
}
```

Do NOT touch `isValidBaseState` — it must stay pre-migration-safe (a real v5 blob has no `lifetime`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/persistence/save.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL green (was 177, now higher), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/persistence/save.ts test/persistence/save.test.ts
git commit -m "feat(save): v5->v6 additive lifetime migration (per-field backfill)"
```

---

## Task 4: `achievements.ts` — pure derived milestones

**Files:**
- Create: `src/engine/achievements.ts`
- Modify: `src/engine/index.ts` (re-export)
- Test: `test/engine/achievements.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/engine/achievements.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, SPECIES, PET_IDS, UPGRADE_IDS, UPGRADES } from '../../src/engine';
import { ACHIEVEMENTS, isComplete, completedCount } from '../../src/engine/achievements';

const byId = (id: string) => {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`no achievement ${id}`);
  return a;
};

describe('achievements', () => {
  it('exposes exactly the 10 planned milestones', () => {
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual(
      ['angler','aquarist','first-friends','forest-complete','lumberjack','pet-parent','seasoned','townsfolk','veteran','wealthy'].sort(),
    );
  });

  it('fresh state: two starters discovered, nothing else complete', () => {
    const s = createInitialState(0);
    expect(byId('first-friends').progress(s)).toEqual({ current: 2, target: 3 });
    expect(isComplete(s, byId('first-friends'))).toBe(false);
    expect(completedCount(s)).toBe(0);
  });

  it('forest-complete targets all land species; aquarist targets all water species', () => {
    const land = Object.values(SPECIES).filter((sp) => sp.affinity !== 'fish').map((sp) => sp.id);
    const water = Object.values(SPECIES).filter((sp) => sp.affinity === 'fish').map((sp) => sp.id);
    const s = { ...createInitialState(0), discovered: [...land, ...water] };
    expect(byId('forest-complete').progress(s)).toEqual({ current: land.length, target: land.length });
    expect(byId('aquarist').progress(s)).toEqual({ current: water.length, target: water.length });
    expect(isComplete(s, byId('forest-complete'))).toBe(true);
  });

  it('lifetime + level + pets + upgrades milestones read the right fields, current clamps to target', () => {
    const maxed: Record<string, number> = {};
    for (const id of UPGRADE_IDS) maxed[id] = UPGRADES[id].maxLevel;
    const s = {
      ...createInitialState(0),
      lifetime: { gold: 99999, wood: 5000, acorns: 0, fish: 2500 },
      pets: [...PET_IDS],
      upgrades: maxed,
      creatures: [{ ...createInitialState(0).creatures[0], level: 25 }],
    };
    expect(byId('angler').progress(s)).toEqual({ current: 1000, target: 1000 });   // clamped
    expect(byId('wealthy').progress(s)).toEqual({ current: 10000, target: 10000 });
    expect(byId('lumberjack').progress(s)).toEqual({ current: 1000, target: 1000 });
    expect(byId('pet-parent').progress(s)).toEqual({ current: PET_IDS.length, target: PET_IDS.length });
    expect(byId('seasoned').progress(s)).toEqual({ current: 10, target: 10 });
    expect(byId('veteran').progress(s)).toEqual({ current: 20, target: 20 });
    expect(byId('townsfolk').progress(s)).toEqual({ current: UPGRADE_IDS.length, target: UPGRADE_IDS.length });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/engine/achievements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/engine/achievements.ts`:

```ts
import type { GameState } from './types';
import { SPECIES, PET_IDS, UPGRADE_IDS, UPGRADES } from './content';

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** `current` is clamped to `target` so a progress bar never overfills. */
  progress(state: GameState): { current: number; target: number };
}

/** Clamp raw progress so the UI never shows current > target. isComplete still fires at ==target. */
const clamp = (current: number, target: number) => ({ current: Math.min(current, target), target });

const LAND_SPECIES = Object.values(SPECIES).filter((s) => s.affinity !== 'fish').map((s) => s.id);
const WATER_SPECIES = Object.values(SPECIES).filter((s) => s.affinity === 'fish').map((s) => s.id);

const maxLevel = (s: GameState): number =>
  s.creatures.reduce((m, c) => Math.max(m, c.level), 0);
const discoveredIn = (s: GameState, ids: string[]): number =>
  ids.filter((id) => s.discovered.includes(id)).length;
const maxedUpgrades = (s: GameState): number =>
  UPGRADE_IDS.filter((id) => (s.upgrades[id] ?? 0) >= UPGRADES[id].maxLevel).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-friends', name: 'First Friends', emoji: '🌱', description: 'Discover 3 creatures',
    progress: (s) => clamp(s.discovered.length, 3) },
  { id: 'forest-complete', name: 'Forest Complete', emoji: '🌲', description: 'Discover every forest creature',
    progress: (s) => clamp(discoveredIn(s, LAND_SPECIES), LAND_SPECIES.length) },
  { id: 'aquarist', name: 'Aquarist', emoji: '🌊', description: 'Discover every water creature',
    progress: (s) => clamp(discoveredIn(s, WATER_SPECIES), WATER_SPECIES.length) },
  { id: 'pet-parent', name: 'Pet Parent', emoji: '🐾', description: 'Catch all pets',
    progress: (s) => clamp(s.pets.length, PET_IDS.length) },
  { id: 'seasoned', name: 'Seasoned', emoji: '⭐', description: 'Raise a creature to level 10',
    progress: (s) => clamp(maxLevel(s), 10) },
  { id: 'veteran', name: 'Veteran', emoji: '🎖️', description: 'Raise a creature to level 20',
    progress: (s) => clamp(maxLevel(s), 20) },
  { id: 'angler', name: 'Angler', emoji: '🐟', description: 'Catch 1,000 fish',
    progress: (s) => clamp(s.lifetime.fish, 1000) },
  { id: 'wealthy', name: 'Wealthy', emoji: '🪙', description: 'Earn 10,000 gold',
    progress: (s) => clamp(s.lifetime.gold, 10000) },
  { id: 'lumberjack', name: 'Lumberjack', emoji: '🪵', description: 'Gather 1,000 wood',
    progress: (s) => clamp(s.lifetime.wood, 1000) },
  { id: 'townsfolk', name: 'Townsfolk', emoji: '🏘️', description: 'Max every town upgrade',
    progress: (s) => clamp(maxedUpgrades(s), UPGRADE_IDS.length) },
];

export function isComplete(state: GameState, a: Achievement): boolean {
  const { current, target } = a.progress(state);
  return current >= target;
}

export function completedCount(state: GameState): number {
  return ACHIEVEMENTS.filter((a) => isComplete(state, a)).length;
}
```

- [ ] **Step 4: Re-export from the barrel**

In `src/engine/index.ts` add:

```ts
export * from './achievements';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/engine/achievements.test.ts`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green, tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/achievements.ts src/engine/index.ts test/engine/achievements.test.ts
git commit -m "feat(engine): pure derived achievements module (10 milestones)"
```

---

## Task 5: `MilestonesSection` on the Friends screen

**Files:**
- Create: `src/ui/components/MilestonesSection.tsx`
- Modify: `src/ui/components/FriendsJournal.tsx`

No test (UI, node env has no RN runtime). Verified in live QA.

- [ ] **Step 1: Create the component**

Create `src/ui/components/MilestonesSection.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { useGameStore } from '../../store/gameStore';
import { ACHIEVEMENTS, completedCount } from '../../engine';

export function MilestonesSection() {
  // Subscribe the STABLE whole-state ref (zustand v5: never build a fresh array in the selector).
  const state = useGameStore((s) => s.state);
  const done = completedCount(state);

  return (
    <View>
      <View style={cards.card}>
        <Text style={cards.title}>🏆 Milestones</Text>
        <Text style={cards.sub}>{done} / {ACHIEVEMENTS.length} complete</Text>
      </View>
      <View style={styles.list}>
        {ACHIEVEMENTS.map((a) => {
          const { current, target } = a.progress(state);
          const pct = target > 0 ? Math.min(1, current / target) : 0;
          const complete = current >= target;
          return (
            <View key={a.id} style={styles.row}>
              <Text style={styles.emoji}>{a.emoji}</Text>
              <View style={styles.body}>
                <Text style={styles.name}>
                  {a.name} {complete ? '✓' : ''}
                </Text>
                <Text style={styles.desc}>{a.description}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                </View>
              </View>
              <Text style={[styles.count, complete && styles.countDone]}>
                {Math.min(current, target)}/{target}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: 12,
    marginBottom: theme.gap,
    gap: 12,
  },
  emoji: { fontSize: 28 },
  body: { flex: 1, gap: 4 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  desc: { color: theme.textDim, fontSize: 12 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(150,210,160,0.15)',
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: theme.accent },
  count: { color: theme.textDim, fontSize: 12, fontWeight: '600', minWidth: 52, textAlign: 'right' },
  countDone: { color: theme.accent },
});
```

- [ ] **Step 2: Mount it on Friends**

In `src/ui/components/FriendsJournal.tsx`:

Add the import near the other component imports:

```tsx
import { MilestonesSection } from './MilestonesSection';
```

Then, just before the FINAL closing `</View>` of the returned tree (after the Pets grid `</View>`), add:

```tsx
      <MilestonesSection />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/MilestonesSection.tsx src/ui/components/FriendsJournal.tsx
git commit -m "feat(ui): Milestones section on the Friends screen"
```

(Live QA of this screen happens in the final QA pass, Task 8.)

---

## Task 6: Idle bob in `SpriteIcon`

**Files:**
- Modify: `src/ui/components/SpriteIcon.tsx`

- [ ] **Step 1: Rewrite `SpriteIcon.tsx`**

Replace the whole file with:

```tsx
import { useRef } from 'react';
import { Animated, Easing, Text } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

type Props = {
  sprite: ImageSourcePropType | undefined;
  emoji: string;
  size: number;
};

// One shared clock for every icon: a single Animated.Value looping 0->1->0.
// Lazy-started on first render (NOT at import) so importing this module stays
// side-effect-free — vitest runs in a node env with no requestAnimationFrame,
// and an import-time loop would crash any test that transitively imports this.
const bob = new Animated.Value(0);
let started = false;
function ensureStarted() {
  if (started) return;
  started = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]),
  ).start();
}

// 0->1 maps to a gentle -1.5px lift and back. Tiny on purpose — breathing, not bouncing.
const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });

/**
 * Single render path for any entity icon. Renders the sprite PNG when the caller's
 * registry has one; otherwise the emoji at the same size. Both gently idle-bob.
 */
export function SpriteIcon({ sprite, emoji, size }: Props) {
  useRef(ensureStarted()).current; // fire once on first mount, no re-render

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      {sprite ? (
        <Animated.Image source={sprite} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <Text style={{ fontSize: size }}>{emoji}</Text>
      )}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Confirm no test imports this file**

Run: `grep -rn "SpriteIcon\|FriendsJournal\|MilestonesSection" test/`
Expected: NO matches (the only sprite test, `test/sprite-assets.test.ts`, is fs-only and parses `src/ui/sprites.ts` as text). If a match exists, that test will crash — stop and reconsider.

- [ ] **Step 4: Full suite**

Run: `npx vitest run`
Expected: all green (SpriteIcon is never imported by a test).

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SpriteIcon.tsx
git commit -m "feat(ui): gentle shared-clock idle bob on every sprite"
```

---

## Task 7: Art pass — pebbleturtle, wheat, vil-1 (Pip)

Mechanical. Only `draw_<id>()` edits in `scripts/gen-sprites.py`; regenerate those groups; overwrite the same PNG names. No code, no registry, no test change.

**Files:**
- Modify: `scripts/gen-sprites.py` (the `draw_pebbleturtle`, `draw_wheat`, `draw_vil_1`/Pip draw functions)
- Overwrite: `assets/pets/pebbleturtle.png`, `assets/crops/wheat.png`, `assets/villagers/vil-1.png`

- [ ] **Step 1: Locate the three draw functions**

Run: `grep -n "def draw_" scripts/gen-sprites.py | grep -Ei "pebbleturtle|wheat|vil_1|pip"`
Read each and the shared drawing helpers (palette bands, outline) so edits match the house pixel style.

- [ ] **Step 2: Improve each draw function**

Refine the three `draw_*` bodies for clearer silhouettes/shading (turtle: rounder shell + visible ridges + head; wheat: distinct grain head + stalk, less blobby; Pip: readable farmer face/hat vs the other villagers). Keep to the existing palette helpers and the 44px native → nearest ×64 pipeline — do not change the generator's shared machinery.

- [ ] **Step 3: Regenerate only those groups**

Run: `python3 scripts/gen-sprites.py pets crops villagers`
(Confirm the exact group arg names via `python3 scripts/gen-sprites.py --help` or the arg-parsing block; run per-group if needed.)
Verify `scripts/contact-sheet.png` was refreshed; eyeball the three sprites.

- [ ] **Step 4: Confirm the fs-only sprite test still passes**

Run: `npx vitest run test/sprite-assets.test.ts`
Expected: PASS (files still exist, still 64×64, still registered).

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-sprites.py assets/pets/pebbleturtle.png assets/crops/wheat.png assets/villagers/vil-1.png scripts/contact-sheet.png
git commit -m "art(sprites): redraw pebbleturtle, wheat, Pip (weakest three)"
```

---

## Task 8: Live QA + green-gate

- [ ] **Step 1: Final automated gate**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL green, tsc clean. Record the test count.

- [ ] **Step 2: Live browser QA** (via the `browse` skill / `npx expo start --web`)

- Home: sprites (crops/plots) visibly bob; collect the barn → resources rise; no console errors.
- Lake: collect the creel a few times; confirm fish banked.
- Friends: scroll to 🏆 Milestones — `first-friends` shows 2/3, bars render, completed rows show ✓; sprites in the grid bob; no zustand "getSnapshot" crash on mount or on deep-link to /friends.
- Reload the page (deep-link /friends) → save is NOT wiped (v6 migration), lifetime persists.
- Confirm the 3 redrawn sprites render where they appear (pebbleturtle in Friends Pets, wheat on a plot, Pip in the villager row).

- [ ] **Step 3: Update HANDOFF.md LIVE block**

Mark `id:plan8-polish` done; note it shipped. (Release/APK is a separate founder-gated step via `scripts/release.sh`.)

- [ ] **Step 4: Merge to main**

```bash
git checkout main && git merge --no-ff feat/plan8-polish -m "feat: Plan 8 polish — idle bob + achievements + art pass" && git worktree prune
```
(Or open a PR if the founder prefers review.)

---

## Self-Review notes (author)

- **Spec coverage:** bob → Task 6; lifetime+migration → Tasks 1-3; achievements module → Task 4; Friends milestones UI → Task 5; art pass → Task 7; all skeptic-hardening notes (version-pin test, per-field migration, lazy start, selector rule, plural mapping, import guardrail) → embedded in Tasks 2/3/5/6.
- **Type consistency:** `Lifetime` (Task 1) used identically in `bumpLifetime`, `save.ts`, `achievements.ts`; `progress()` shape `{current,target}` consistent across Task 4 module + Task 5 UI; `clamp` applied in `progress` so UI never overfills.
- **Known plural trap:** `collectSatchel` local `bankAcorn` (singular) → `lifetime.acorns` (plural) — called out in Task 2 Step 4.
