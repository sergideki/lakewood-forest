# Lakewood — Plan 1: Playable Vertical Slice (Farm Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real Android APK with the complete cozy idle loop for the farm only — plant crops, assign a villager, close the app, reopen, watch the barn fill, tap Collect.

**Architecture:** A **pure, framework-free idle engine** in `src/engine/` (plain TypeScript, no React Native imports) is the tested heart. It computes offline progress as `(state, now) → newState` with an **injected clock** and **capped storage**. A **Zustand store** wraps the engine, persists to AsyncStorage, and re-runs catch-up on app foreground. **expo-router** renders a warm dashboard **Home** screen over the store. Keeping the engine RN-free lets us unit-test it fast with **vitest**.

**Tech Stack:** Expo (managed) · TypeScript · expo-router · Zustand (+ persist) · AsyncStorage · vitest (engine tests) · EAS Build (APK).

**Spec:** `docs/superpowers/specs/2026-07-02-lakewood-cozy-idle-design.md` (this plan covers pillars 1–2 for the farm only; Forest/Friends/Town are later plans).

---

## File Structure (built by this plan)

```
lakewood/
├── app/
│   ├── _layout.tsx              # expo-router root + bottom tabs
│   ├── index.tsx                # Home / Farm screen (the slice UI)
│   ├── forest.tsx               # placeholder tab (Plan 2)
│   ├── friends.tsx              # placeholder tab (Plan 3)
│   └── town.tsx                 # placeholder tab (Plan 4)
├── src/
│   ├── engine/
│   │   ├── types.ts             # GameState + all data types
│   │   ├── content.ts           # CROPS content table
│   │   ├── state.ts             # createInitialState()
│   │   ├── farm.ts              # farmRatePerSec, accrueBarn, collectBarn, plantCrop, assignVillager
│   │   ├── idle.ts              # applyElapsed() orchestrator + clock guard
│   │   └── index.ts             # barrel re-export
│   ├── persistence/
│   │   └── save.ts              # serialize/deserialize + SAVE_VERSION + migrate
│   ├── store/
│   │   └── gameStore.ts         # Zustand store, actions, persist, foreground tick
│   └── ui/
│       ├── theme.ts             # colors/spacing tokens (warm cozy palette)
│       └── components/
│           ├── ResourceBar.tsx
│           ├── BarnCard.tsx
│           ├── PlotGrid.tsx
│           └── VillagerRow.tsx
├── test/
│   ├── engine/farm.test.ts
│   ├── engine/idle.test.ts
│   └── persistence/save.test.ts
├── vitest.config.ts
├── eas.json
├── app.json
├── tsconfig.json
└── package.json
```

**Key interfaces (defined in Task 2, reused everywhere — names are fixed):**
- `createInitialState(now: number): GameState`
- `CROPS: Record<CropId, Crop>`
- `farmRatePerSec(state: GameState): number`
- `accrueBarn(state: GameState, elapsedSec: number): GameState`
- `collectBarn(state: GameState): GameState`
- `plantCrop(state: GameState, plotId: string, cropId: CropId): GameState`
- `assignVillager(state: GameState, villagerId: string, to: 'farm' | null): GameState`
- `applyElapsed(state: GameState, now: number): GameState`
- `serialize(state: GameState): string` · `deserialize(json: string): GameState` · `SAVE_VERSION`

---

## Task 1: Project scaffold + test runner

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `vitest.config.ts`, `test/smoke.test.ts`

- [ ] **Step 1: Initialize the Expo app in place**

The repo already exists at `~/Documents/lakewood` with a git history. Scaffold Expo into it:

```bash
cd ~/Documents/lakewood
npx create-expo-app@latest . --template blank-typescript
# If it refuses because the dir isn't empty, scaffold in a temp dir and copy:
#   npx create-expo-app@latest /tmp/lw --template blank-typescript
#   cp -rn /tmp/lw/. ~/Documents/lakewood/   (never overwrite docs/ or .git/)
```

- [ ] **Step 2: Add expo-router, state, storage, and dev deps**

```bash
cd ~/Documents/lakewood
npx expo install expo-router react-native-safe-area-context react-native-screens @react-native-async-storage/async-storage
npm install zustand
npm install -D vitest
```

- [ ] **Step 3: Configure expo-router entry + typed routes**

Edit `package.json` so `"main"` is `"expo-router/entry"`:

```json
{
  "main": "expo-router/entry"
}
```

Add to `app.json` under `"expo"`: `"scheme": "lakewood"` and `"plugins": ["expo-router"]`.

- [ ] **Step 4: Add the test script + vitest config**

Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write a smoke test**

Create `test/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it and verify it passes**

Run: `npm test`
Expected: PASS — `1 passed`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo + expo-router + vitest"
```

---

## Task 2: Engine types + initial state

**Files:**
- Create: `src/engine/types.ts`, `src/engine/state.ts`, `src/engine/index.ts`
- Test: `test/engine/farm.test.ts` (started here, extended later)

- [ ] **Step 1: Write the failing test**

Create `test/engine/farm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';

describe('createInitialState', () => {
  it('starts with three empty plots, three villagers, an empty capped barn, and starter gold', () => {
    const s = createInitialState(1000);
    expect(s.plots).toHaveLength(3);
    expect(s.plots.every((p) => p.crop === null)).toBe(true);
    expect(s.villagers).toHaveLength(3);
    expect(s.villagers.every((v) => v.assignedTo === null)).toBe(true);
    expect(s.storage.barn.amount).toBe(0);
    expect(s.storage.barn.cap).toBeGreaterThan(0);
    expect(s.resources.gold).toBeGreaterThanOrEqual(0);
    expect(s.meta.lastSeen).toBe(1000);
    expect(s.meta.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/farm.test.ts`
Expected: FAIL — cannot find module `../../src/engine`.

- [ ] **Step 3: Define the types**

Create `src/engine/types.ts`:

```ts
export type CropId = string;

export interface Crop {
  id: CropId;
  name: string;
  emoji: string;
  growSec: number; // seconds for one full yield
  gold: number;    // gold produced per yield cycle
}

export interface Plot {
  id: string;
  crop: CropId | null;
}

export interface Villager {
  id: string;
  name: string;
  emoji: string;
  assignedTo: 'farm' | null;
  level: number;
}

export interface Storage {
  barn: { amount: number; cap: number };
}

export interface Resources {
  gold: number;
  wood: number;
  acorns: number;
}

export interface Meta {
  lastSeen: number; // epoch ms
  version: number;
}

export interface GameState {
  resources: Resources;
  plots: Plot[];
  villagers: Villager[];
  storage: Storage;
  meta: Meta;
}
```

- [ ] **Step 4: Implement `createInitialState`**

Create `src/engine/state.ts`:

```ts
import type { GameState } from './types';

const BARN_CAP = 500;

export function createInitialState(now: number): GameState {
  return {
    resources: { gold: 0, wood: 0, acorns: 0 },
    plots: [
      { id: 'plot-1', crop: null },
      { id: 'plot-2', crop: null },
      { id: 'plot-3', crop: null },
    ],
    villagers: [
      { id: 'vil-1', name: 'Pip', emoji: '🧑‍🌾', assignedTo: null, level: 1 },
      { id: 'vil-2', name: 'Nan', emoji: '👵', assignedTo: null, level: 1 },
      { id: 'vil-3', name: 'Rowan', emoji: '🧔', assignedTo: null, level: 1 },
    ],
    storage: { barn: { amount: 0, cap: BARN_CAP } },
    meta: { lastSeen: now, version: 1 },
  };
}
```

- [ ] **Step 5: Create the barrel export**

Create `src/engine/index.ts`:

```ts
export * from './types';
export * from './state';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- test/engine/farm.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): game state types + initial state"
```

---

## Task 3: Crop content + farm production rate

**Files:**
- Create: `src/engine/content.ts`, `src/engine/farm.ts`
- Modify: `src/engine/index.ts`
- Test: `test/engine/farm.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/farm.test.ts`:

```ts
import { farmRatePerSec, plantCrop, assignVillager } from '../../src/engine';

describe('farmRatePerSec', () => {
  it('is zero with no villager assigned to the farm even if crops are planted', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    expect(farmRatePerSec(s)).toBe(0);
  });

  it('equals summed planted-crop yield-per-second when one villager tends the farm', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // 5 gold / 100s = 0.05/s
    s = assignVillager(s, 'vil-1', 'farm');
    expect(farmRatePerSec(s)).toBeCloseTo(0.05, 5);
  });

  it('gives +25% per extra assigned villager', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // base 0.05/s
    s = assignVillager(s, 'vil-1', 'farm');
    s = assignVillager(s, 'vil-2', 'farm'); // x1.25
    expect(farmRatePerSec(s)).toBeCloseTo(0.0625, 5);
  });
});

describe('plantCrop / assignVillager', () => {
  it('plantCrop is immutable and sets the plot crop', () => {
    const s0 = createInitialState(0);
    const s1 = plantCrop(s0, 'plot-2', 'carrot');
    expect(s0.plots.find((p) => p.id === 'plot-2')!.crop).toBeNull();
    expect(s1.plots.find((p) => p.id === 'plot-2')!.crop).toBe('carrot');
  });

  it('assignVillager sets and clears assignment', () => {
    let s = assignVillager(createInitialState(0), 'vil-1', 'farm');
    expect(s.villagers.find((v) => v.id === 'vil-1')!.assignedTo).toBe('farm');
    s = assignVillager(s, 'vil-1', null);
    expect(s.villagers.find((v) => v.id === 'vil-1')!.assignedTo).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/farm.test.ts`
Expected: FAIL — `farmRatePerSec` / `plantCrop` / `assignVillager` not exported.

- [ ] **Step 3: Add the crop content table**

Create `src/engine/content.ts`:

```ts
import type { Crop, CropId } from './types';

export const CROPS: Record<CropId, Crop> = {
  wheat:  { id: 'wheat',  name: 'Wheat',  emoji: '🌾', growSec: 100, gold: 5 },
  carrot: { id: 'carrot', name: 'Carrot', emoji: '🥕', growSec: 240, gold: 14 },
  berry:  { id: 'berry',  name: 'Berry',  emoji: '🍓', growSec: 480, gold: 32 },
};

export const CROP_IDS: CropId[] = Object.keys(CROPS);
```

- [ ] **Step 4: Implement the farm functions**

Create `src/engine/farm.ts`:

```ts
import type { GameState, CropId } from './types';
import { CROPS } from './content';

/** Gold produced per second across all planted plots, gated + boosted by farm villagers. */
export function farmRatePerSec(state: GameState): number {
  const assigned = state.villagers.filter((v) => v.assignedTo === 'farm').length;
  if (assigned === 0) return 0;
  const base = state.plots.reduce((sum, p) => {
    if (!p.crop) return sum;
    const crop = CROPS[p.crop];
    return crop ? sum + crop.gold / crop.growSec : sum;
  }, 0);
  const multiplier = 1 + 0.25 * (assigned - 1);
  return base * multiplier;
}

export function plantCrop(state: GameState, plotId: string, cropId: CropId): GameState {
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

- [ ] **Step 5: Export from the barrel**

Edit `src/engine/index.ts` to add:

```ts
export * from './content';
export * from './farm';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- test/engine/farm.test.ts`
Expected: PASS (all farm-rate + plant/assign tests green).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): crops + farm production rate"
```

---

## Task 4: Barn accrual + collect (capped storage)

**Files:**
- Modify: `src/engine/farm.ts`, `src/engine/index.ts` (already re-exports farm)
- Test: `test/engine/farm.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/engine/farm.test.ts`:

```ts
import { accrueBarn, collectBarn } from '../../src/engine';

describe('accrueBarn', () => {
  it('adds rate * elapsed to the barn', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');   // 0.05/s
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 200);                 // 0.05 * 200 = 10
    expect(s.storage.barn.amount).toBeCloseTo(10, 5);
  });

  it('never exceeds the cap', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    s = accrueBarn(s, 10_000_000);          // would be huge
    expect(s.storage.barn.amount).toBe(s.storage.barn.cap);
  });

  it('does nothing when elapsed is zero or negative', () => {
    let s = createInitialState(0);
    s = plantCrop(s, 'plot-1', 'wheat');
    s = assignVillager(s, 'vil-1', 'farm');
    expect(accrueBarn(s, 0).storage.barn.amount).toBe(0);
    expect(accrueBarn(s, -50).storage.barn.amount).toBe(0);
  });
});

describe('collectBarn', () => {
  it('moves the whole barn into gold and empties the barn', () => {
    let s = createInitialState(0);
    s.storage.barn.amount = 42;
    s = collectBarn(s);
    expect(s.resources.gold).toBe(42);
    expect(s.storage.barn.amount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/farm.test.ts`
Expected: FAIL — `accrueBarn` / `collectBarn` not exported.

- [ ] **Step 3: Implement accrue + collect**

Append to `src/engine/farm.ts`:

```ts
/** Fill the barn by the farm rate over `elapsedSec`, clamped to [0, cap]. */
export function accrueBarn(state: GameState, elapsedSec: number): GameState {
  if (elapsedSec <= 0) return state;
  const rate = farmRatePerSec(state);
  const gained = rate * elapsedSec;
  const cap = state.storage.barn.cap;
  const amount = Math.min(cap, state.storage.barn.amount + gained);
  return { ...state, storage: { ...state.storage, barn: { ...state.storage.barn, amount } } };
}

/** Bank the barn's contents into gold and empty it. */
export function collectBarn(state: GameState): GameState {
  const banked = Math.floor(state.storage.barn.amount);
  return {
    ...state,
    resources: { ...state.resources, gold: state.resources.gold + banked },
    storage: { ...state.storage, barn: { ...state.storage.barn, amount: 0 } },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/engine/farm.test.ts`
Expected: PASS.

Note: the `collectBarn` test sets `amount = 42` and expects gold `42` — `Math.floor(42)` is `42`, so it passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): capped barn accrual + collect"
```

---

## Task 5: `applyElapsed` idle orchestrator + clock guard

**Files:**
- Create: `src/engine/idle.ts`
- Modify: `src/engine/index.ts`
- Test: `test/engine/idle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/engine/idle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop, assignVillager, applyElapsed } from '../../src/engine';

function activeFarm(now: number) {
  let s = createInitialState(now);
  s = plantCrop(s, 'plot-1', 'wheat');   // 0.05 gold/s
  s = assignVillager(s, 'vil-1', 'farm');
  return s;
}

describe('applyElapsed', () => {
  it('fills the barn by the wall-clock gap and advances lastSeen', () => {
    const s0 = activeFarm(1_000); // lastSeen = 1000ms
    const s1 = applyElapsed(s0, 1_000 + 200_000); // +200s
    expect(s1.storage.barn.amount).toBeCloseTo(10, 5); // 0.05 * 200
    expect(s1.meta.lastSeen).toBe(1_000 + 200_000);
  });

  it('clamps negative elapsed (clock rollback) to zero — no reward, lastSeen still updates', () => {
    const s0 = activeFarm(1_000_000);
    const s1 = applyElapsed(s0, 500_000); // "now" earlier than lastSeen
    expect(s1.storage.barn.amount).toBe(0);
    expect(s1.meta.lastSeen).toBe(500_000);
  });

  it('a week away is absorbed by the barn cap, not overflowed', () => {
    const s0 = activeFarm(0);
    const week = 7 * 24 * 3600 * 1000;
    const s1 = applyElapsed(s0, week);
    expect(s1.storage.barn.amount).toBe(s1.storage.barn.cap);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/engine/idle.test.ts`
Expected: FAIL — `applyElapsed` not exported.

- [ ] **Step 3: Implement the orchestrator**

Create `src/engine/idle.ts`:

```ts
import type { GameState } from './types';
import { accrueBarn } from './farm';

/**
 * Apply all offline progress between state.meta.lastSeen and `now` (epoch ms).
 * Pure + clock-safe: negative gaps clamp to zero. Extend here as new job types land.
 */
export function applyElapsed(state: GameState, now: number): GameState {
  const elapsedSec = Math.max(0, (now - state.meta.lastSeen) / 1000);
  let next = accrueBarn(state, elapsedSec);
  next = { ...next, meta: { ...next.meta, lastSeen: now } };
  return next;
}
```

- [ ] **Step 4: Export from the barrel**

Edit `src/engine/index.ts` to add:

```ts
export * from './idle';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/engine/idle.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): applyElapsed offline catch-up with clock guard"
```

---

## Task 6: Persistence (save / load / migrate)

**Files:**
- Create: `src/persistence/save.ts`
- Test: `test/persistence/save.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/persistence/save.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, plantCrop } from '../../src/engine';
import { serialize, deserialize, SAVE_VERSION } from '../../src/persistence/save';

describe('serialize / deserialize', () => {
  it('round-trips a game state', () => {
    const s0 = plantCrop(createInitialState(1234), 'plot-1', 'berry');
    const restored = deserialize(serialize(s0));
    expect(restored).toEqual(s0);
  });

  it('writes the current save version into the envelope', () => {
    const json = serialize(createInitialState(0));
    expect(JSON.parse(json).version).toBe(SAVE_VERSION);
  });

  it('returns a fresh state (not throwing) when the blob is corrupt', () => {
    const restored = deserialize('{ not valid json');
    expect(restored.plots).toHaveLength(3);
    expect(restored.storage.barn.amount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/persistence/save.test.ts`
Expected: FAIL — cannot find module `save`.

- [ ] **Step 3: Implement save/load**

Create `src/persistence/save.ts`:

```ts
import type { GameState } from '../engine/types';
import { createInitialState } from '../engine';

export const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  state: GameState;
}

export function serialize(state: GameState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, state };
  return JSON.stringify(envelope);
}

/** Never throws — a corrupt/absent/old blob yields a fresh state so the app always boots. */
export function deserialize(json: string | null): GameState {
  if (!json) return createInitialState(Date.now());
  try {
    const parsed = JSON.parse(json) as Partial<SaveEnvelope>;
    if (!parsed || typeof parsed.version !== 'number' || !parsed.state) {
      return createInitialState(Date.now());
    }
    return migrate(parsed.version, parsed.state);
  } catch {
    return createInitialState(Date.now());
  }
}

/** Version migrations go here as the schema evolves. v1 is the baseline. */
function migrate(fromVersion: number, state: GameState): GameState {
  // No migrations yet; v1 state is returned as-is.
  return state;
}
```

Note: `deserialize` calls `Date.now()` only on the corrupt/empty path (acceptable — there is no meaningful `lastSeen` to preserve). The happy path is deterministic and fully unit-testable.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/persistence/save.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(persistence): versioned save/load with corrupt-blob fallback"
```

---

## Task 7: Zustand store (actions + persist + foreground tick)

**Files:**
- Create: `src/store/gameStore.ts`
- Test: none (thin RN-bound wrapper; logic lives in the tested engine). Verified via the smoke run in Step 4.

- [ ] **Step 1: Implement the store**

Create `src/store/gameStore.ts`:

```ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, CropId } from '../engine/types';
import {
  createInitialState,
  plantCrop,
  assignVillager,
  collectBarn,
  applyElapsed,
} from '../engine';
import { serialize, deserialize } from '../persistence/save';

const STORAGE_KEY = 'lakewood.save.v1';

interface GameStore {
  state: GameState;
  loaded: boolean;
  load: () => Promise<void>;
  tick: (now: number) => void;
  plant: (plotId: string, cropId: CropId) => void;
  assign: (villagerId: string, to: 'farm' | null) => void;
  collect: () => void;
}

function persist(state: GameState) {
  AsyncStorage.setItem(STORAGE_KEY, serialize(state)).catch(() => {});
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(Date.now()),
  loaded: false,

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const restored = applyElapsed(deserialize(raw), Date.now());
    persist(restored);
    set({ state: restored, loaded: true });
  },

  tick: (now) => {
    const next = applyElapsed(get().state, now);
    persist(next);
    set({ state: next });
  },

  plant: (plotId, cropId) => {
    const next = plantCrop(applyElapsed(get().state, Date.now()), plotId, cropId);
    persist(next);
    set({ state: next });
  },

  assign: (villagerId, to) => {
    const next = assignVillager(applyElapsed(get().state, Date.now()), villagerId, to);
    persist(next);
    set({ state: next });
  },

  collect: () => {
    const next = collectBarn(applyElapsed(get().state, Date.now()));
    persist(next);
    set({ state: next });
  },
}));
```

Note: every mutating action first calls `applyElapsed(..., Date.now())` so the barn is caught up to the exact moment before the change — no lost or double-counted time.

- [ ] **Step 2: Verify the engine still compiles + tests pass**

Run: `npm test`
Expected: PASS (all engine + persistence tests green; the store isn't unit-tested but must typecheck when imported by the UI in Task 8).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(store): zustand game store with persist + foreground catch-up"
```

---

## Task 8: Home / Farm screen UI

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/components/ResourceBar.tsx`, `src/ui/components/BarnCard.tsx`, `src/ui/components/PlotGrid.tsx`, `src/ui/components/VillagerRow.tsx`
- Create: `app/index.tsx`

- [ ] **Step 1: Add the warm theme tokens**

Create `src/ui/theme.ts`:

```ts
export const theme = {
  bg: '#1a271f',
  card: '#1e2a22',
  cardBorder: 'rgba(150,210,160,0.18)',
  text: '#e2ece3',
  textDim: '#9fb6a4',
  accent: '#8ed49a',
  accentInk: '#12321a',
  radius: 14,
  gap: 12,
};
```

- [ ] **Step 2: ResourceBar**

Create `src/ui/components/ResourceBar.tsx`:

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

- [ ] **Step 3: BarnCard (fill meter + Collect)**

Create `src/ui/components/BarnCard.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';

export function BarnCard() {
  const barn = useGameStore((s) => s.state.storage.barn);
  const collect = useGameStore((s) => s.collect);
  const pct = Math.min(100, Math.round((barn.amount / barn.cap) * 100));
  const amount = Math.floor(barn.amount);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🛖 Barn</Text>
        <Pressable
          style={[styles.btn, amount === 0 && styles.btnDisabled]}
          disabled={amount === 0}
          onPress={collect}
        >
          <Text style={styles.btnText}>Collect {amount}</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>{amount} / {barn.cap} gold stored ({pct}%)</Text>
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

- [ ] **Step 4: PlotGrid (tap empty plot to cycle a crop)**

Create `src/ui/components/PlotGrid.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';
import { CROPS, CROP_IDS } from '../../engine';

export function PlotGrid() {
  const plots = useGameStore((s) => s.state.plots);
  const plant = useGameStore((s) => s.plant);

  // Tapping a plot cycles: empty → wheat → carrot → berry → empty
  const nextCrop = (current: string | null): string | null => {
    if (current === null) return CROP_IDS[0];
    const i = CROP_IDS.indexOf(current);
    return i === CROP_IDS.length - 1 ? null : CROP_IDS[i + 1];
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🌱 Plots</Text>
      <Text style={styles.sub}>Tap to plant / change crop</Text>
      <View style={styles.grid}>
        {plots.map((p) => {
          const crop = p.crop ? CROPS[p.crop] : null;
          return (
            <Pressable key={p.id} style={styles.plot} onPress={() => plant(p.id, nextCrop(p.crop) as any)}>
              <Text style={styles.plotEmoji}>{crop ? crop.emoji : '➕'}</Text>
              <Text style={styles.plotLabel}>{crop ? crop.name : 'empty'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
  grid: { flexDirection: 'row', gap: 10 },
  plot: { flex: 1, backgroundColor: '#3c5a3f', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  plotEmoji: { fontSize: 24 },
  plotLabel: { color: theme.text, fontSize: 11, marginTop: 4 },
});
```

Note: `plant(p.id, nextCrop(p.crop))` is used to also *clear* a plot (passing `null`). The store's `plant` action forwards to `plantCrop`, which accepts the value directly; `as any` bridges the `CropId` type since clearing passes `null`. (A dedicated `clearPlot` action is a fine Plan-2 refinement.)

- [ ] **Step 5: VillagerRow (assign to farm)**

Create `src/ui/components/VillagerRow.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useGameStore } from '../../store/gameStore';

export function VillagerRow() {
  const villagers = useGameStore((s) => s.state.villagers);
  const assign = useGameStore((s) => s.assign);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🧑‍🌾 Family</Text>
      <Text style={styles.sub}>Tap to send them to the farm (boosts the barn)</Text>
      <View style={styles.row}>
        {villagers.map((v) => {
          const on = v.assignedTo === 'farm';
          return (
            <Pressable
              key={v.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => assign(v.id, on ? null : 'farm')}
            >
              <Text style={styles.chipEmoji}>{v.emoji}</Text>
              <Text style={[styles.chipName, on && styles.chipNameOn]}>{v.name}</Text>
              <Text style={styles.chipState}>{on ? 'farming' : 'resting'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, marginHorizontal: 16, marginBottom: theme.gap },
  title: { color: theme.text, fontSize: 16, fontWeight: '700' },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 2, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, backgroundColor: '#26332a', borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: theme.accent, backgroundColor: '#2e4535' },
  chipEmoji: { fontSize: 22 },
  chipName: { color: theme.textDim, fontSize: 12, marginTop: 3, fontWeight: '600' },
  chipNameOn: { color: theme.text },
  chipState: { color: theme.textDim, fontSize: 10, marginTop: 1 },
});
```

- [ ] **Step 6: Assemble the Home screen with a live 1s tick + foreground catch-up**

Create `app/index.tsx`:

```tsx
import { useEffect } from 'react';
import { View, Text, StyleSheet, AppState, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { useGameStore } from '../src/store/gameStore';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { BarnCard } from '../src/ui/components/BarnCard';
import { PlotGrid } from '../src/ui/components/PlotGrid';
import { VillagerRow } from '../src/ui/components/VillagerRow';

export default function Home() {
  const loaded = useGameStore((s) => s.loaded);
  const load = useGameStore((s) => s.load);
  const tick = useGameStore((s) => s.tick);

  useEffect(() => { load(); }, [load]);

  // Live barn fill while the app is open (visual), plus a hard catch-up on foreground.
  useEffect(() => {
    const interval = setInterval(() => tick(Date.now()), 1000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') tick(Date.now());
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [tick]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.loading}>🌿 Waking up Lakewood…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <BarnCard />
        <PlotGrid />
        <VillagerRow />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  loading: { color: theme.text, textAlign: 'center', marginTop: 80, fontSize: 16 },
});
```

- [ ] **Step 7: Run the app and verify the loop by hand**

```bash
npx expo start
```

Verify, on device/emulator (Expo Go):
1. Home shows the barn (0), three empty plots, three resting family.
2. Tap a plot → it plants Wheat. Tap a family chip → it reads "farming".
3. Watch the barn tick up ~0.05/s. Tap **Collect** → gold rises, barn resets to 0.
4. Fully close the app for a minute, reopen → the barn jumped forward (catch-up).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): Home/Farm screen — plant, assign, collect, live + offline fill"
```

---

## Task 9: Navigation tabs + placeholder screens

**Files:**
- Create: `app/_layout.tsx`, `app/forest.tsx`, `app/friends.tsx`, `app/town.tsx`

- [ ] **Step 1: Add the tab layout**

Create `app/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#141d18', borderTopColor: theme.cardBorder },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textDim,
        }}
      >
        <Tabs.Screen name="index"   options={{ title: '🏡 Home' }} />
        <Tabs.Screen name="forest"  options={{ title: '🌲 Forest' }} />
        <Tabs.Screen name="friends" options={{ title: '🐿️ Friends' }} />
        <Tabs.Screen name="town"    options={{ title: '🏪 Town' }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Add three placeholder screens**

Create `app/forest.tsx`, `app/friends.tsx`, `app/town.tsx` — each with this body (change the label per file: "Forest — foraging & dungeons (Plan 2)", "Friends — creature journal (Plan 3)", "Town — shop & upgrades (Plan 4)"):

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../src/ui/theme';

export default function Screen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>🌲 Coming soon: Forest — foraging & dungeons (Plan 2)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
});
```

- [ ] **Step 3: Run and verify tabs**

Run: `npx expo start`
Expected: four bottom tabs; Home is fully interactive; the other three show their "coming soon" text.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(nav): bottom tabs + placeholder Forest/Friends/Town"
```

---

## Task 10: Build the APK (EAS)

**Files:**
- Create: `eas.json`

- [ ] **Step 1: Add an APK build profile**

Create `eas.json`:

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "distribution": "internal"
    }
  }
}
```

- [ ] **Step 2: Log in and build**

> **Founder-owed:** needs an Expo account login (`eas login`). This is the one step Claude can't do headless — it requires interactive auth.

```bash
npm install -g eas-cli   # if not installed
eas login                # interactive
eas build:configure      # accepts defaults; sets android package id
eas build -p android --profile preview
```

EAS returns a URL to download the signed **`.apk`**. Install it on the phone (allow "install from unknown sources").

- [ ] **Step 3: Verify on device**

Install the APK, open the app with **no Metro server running**, confirm the full loop works offline: plant, assign, collect, background for a minute, reopen → barn caught up.

- [ ] **Step 4: Commit**

```bash
git add eas.json
git commit -m "chore(build): EAS Android APK preview profile"
```

---

## Definition of Done (Plan 1)

- `npm test` green (engine + persistence).
- On a real phone, from the installed APK: plant → assign family → barn fills live → Collect banks gold → offline catch-up works after fully closing the app → the barn respects its cap.
- Forest / Friends / Town tabs exist as placeholders.

## Self-Review (completed)

- **Spec coverage:** Pillar 1 (dual labor) — farm half via villager assignment ✓ (creature/forest half is Plan 2, explicitly scoped out). Pillar 2 (capped storage) — barn cap + collect ✓ (satchel is Plan 2). Offline model (on-open catch-up, clock guard, cap-absorbs-long-gaps) ✓. Tech (Expo/TS/expo-router/Zustand/AsyncStorage/vitest/EAS APK) ✓. Data model — `resources/plots/villagers/storage.barn/meta` implemented; `creatures/dungeons/discovered/satchel` deferred to later plans as designed. Testing (pure engine, injected clock) ✓.
- **Placeholder scan:** no TBD/TODO; every code step has complete code.
- **Type consistency:** `createInitialState/farmRatePerSec/accrueBarn/collectBarn/plantCrop/assignVillager/applyElapsed/serialize/deserialize/SAVE_VERSION` and the `GameState` shape are used identically across Tasks 2–8. Store action names (`load/tick/plant/assign/collect`) match their UI call sites in Task 8.
