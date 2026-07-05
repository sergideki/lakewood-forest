# Lakewood — Plan 10: Village Green (endgame resource sink)

**Date:** 2026-07-05
**Status:** approved (brainstorm), pending skeptic + plan
**Problem:** Late game, everything is maxed — all upgrades at `maxLevel`, all crops/habitats unlocked, villagers at `MAX_VILLAGERS`, all creatures/pets discovered. Resources (gold/wood/acorns/fish) pile up with the *only* remaining sink being `buyTreat` (25🌰 → 100 XP), tapped one creature at a time. Tedious and unrewarding.

**Goal:** A cozy, perpetual, never-"done" resource sink that gives a real reason to keep spending, without breaking the maxed balance. Direction chosen: **landmarks (concrete, visible) + infinite festival tail (true no-cap sink)**, each grant a **small flavor-fit perpetual buff**.

---

## 1. Overview

A new **Village Green** section on the Town screen with two parts:

1. **Landmarks** — ~8 one-time named builds. Each has a chunky multi-resource cost, renders a 16-bit pixel sprite when funded, and grants one modest perpetual buff wired into an *existing* multiplier seam.
2. **Lantern Festival** — unlocks once all 8 landmarks are built. A repeatable track: each level costs escalating gold+wood+acorns+fish and grants a small **Prosperity ×** that gently scales all production. No cap.

Plus a small QoL: a **"Feed all friends"** button that spends acorns to treat every creature in one tap.

**Design principle:** landmarks reuse the pet-lever pattern (`landmarks.ts` mirrors `pets.ts`). No rework of farm/forest/lake logic — each buff multiplies into a seam that already exists.

---

## 2. Content (`src/engine/content.ts`)

### Landmark levers

```ts
export type LandmarkLever =
  | 'treatXp'      // Bakery      — XP per treat
  | 'catchChance'  // Fountain    — additive pet catch chance
  | 'forageRate'   // Lanterns    — forage items/sec
  | 'villagerXp'   // Bridge      — villager XP drip
  | 'barnCap'      // Gazebo      — barn capacity
  | 'tradeYield'   // Market Stall— wood→fish trade output
  | 'creelCap'     // Koi Pond    — creel capacity
  | 'farmRate';    // Windmill    — farm output

export interface Landmark {
  id: LandmarkId;
  name: string;
  emoji: string;                 // fallback when sprite absent
  blurb: string;                 // one cozy line shown on the card
  cost: Partial<Resources>;      // one-time; absent component = 0
  lever: LandmarkLever;
  amount: number;                // additive to the lever (mult = 1 + Σamount; catchChance is additive bonus)
}
```

### The 8 landmarks (order = build order shown; costs are starting-point tuning, refined in QA)

| id | emoji | name | lever | amount | cost (gold/wood/acorns/fish) |
|---|---|---|---|---|---|
| `bakery`   | 🍞 | Bakery       | treatXp     | 0.25 | 1200 / 400 / 300 / 0 |
| `fountain` | ⛲ | Fountain     | catchChance | 0.05 | 1600 / 300 / 0 / 200 |
| `lanterns` | 🏮 | Lantern Row  | forageRate  | 0.10 | 1000 / 800 / 200 / 0 |
| `bridge`   | 🌉 | Stone Bridge | villagerXp  | 0.20 | 2000 / 1200 / 0 / 0 |
| `gazebo`   | 🏛️ | Gazebo       | barnCap     | 0.15 | 2500 / 900 / 600 / 0 |
| `market`   | 🪧 | Market Stall | tradeYield  | 0.50 | 1800 / 600 / 400 / 300 |
| `koipond`  | 🎏 | Koi Pond     | creelCap    | 0.15 | 2200 / 500 / 0 / 800 |
| `windmill` | 🌬️ | Windmill     | farmRate    | 0.10 | 3000 / 1500 / 800 / 0 |

All buffs modest (5–25%). Gentle power creep at max is the intended reward.

### Festival (infinite tail)

```ts
export const FESTIVAL_PROSPERITY_PER_LEVEL = 0.02; // +2% production per festival level
export const FESTIVAL_BASE_COST: Resources = { gold: 4000, wood: 2000, acorns: 2000, fish: 1000 };
export const FESTIVAL_COST_GROWTH = 1.15;          // per-level multiplier on every component
```

Festival level `N` (0-indexed next-level cost) = `ceil(FESTIVAL_BASE_COST[r] * FESTIVAL_COST_GROWTH^N)` per resource `r`. Prosperity multiplier = `1 + FESTIVAL_PROSPERITY_PER_LEVEL * festivalLevel`.

### Treat / feed-all

Existing `TREAT_COST_ACORNS = 25`, `TREAT_XP = 100` stay. Effective treat XP = `TREAT_XP * landmarkLeverMult(state,'treatXp')`.

---

## 3. State & save (`types.ts`, `save.ts`)

Add two fields to `GameState`. `LandmarkId` type lives in `types.ts` next to `PetId` (skeptic L5); `content.ts` imports it.

```ts
landmarks: LandmarkId[];   // built landmark ids (mirrors `pets: PetId[]`)
festivalLevel: number;     // count of funded festival levels; 0 until first
```

- `createInitialState` seeds `landmarks: []`, `festivalLevel: 0`.
- `SAVE_VERSION 7 → 8`. Add a migrate step: any pre-v8 state backfills `landmarks: []`, `festivalLevel: 0`. Old saves load untouched (additive migration, same pattern as the v6 `lifetime` backfill).
- `isValidBaseState` is pre-migration and must NOT assert the new fields.

---

## 4. Engine module (`src/engine/landmarks.ts`) — mirrors `pets.ts`

```ts
// Multiplier (≥1) for a lever from built landmarks: 1 + Σamount.
export function landmarkLeverMult(state, lever: Exclude<LandmarkLever,'catchChance'>): number
// Additive catch bonus (≥0) from built landmarks.
export function landmarkCatchBonus(state): number
// Global prosperity multiplier (≥1) from festival level.
export function prosperityMult(state): number

// Actions (immutable, no-op same-ref when invalid — matches buildHabitat/purchaseUpgrade):
export function canBuildLandmark(state, id): boolean   // exists, not built, affordable
export function buildLandmark(state, id): GameState    // pay cost, append id
export function festivalCost(level: number): Resources // next-level cost
export function canFundFestival(state): boolean        // all 8 built AND affordable
export function fundFestival(state): GameState         // pay cost, festivalLevel += 1
```

`allLandmarksBuilt(state)` helper = `state.landmarks.length === LANDMARK_IDS.length`. Festival is gated on it.

---

## 5. Wiring buffs into existing seams (one edit each — no logic rewrite)

| Buff | Seam | Change |
|---|---|---|
| Windmill `farmRate` | `farm.ts` `farmRatesPerSec` | multiply `multiplier` by `landmarkLeverMult(state,'farmRate')` |
| Gazebo `barnCap` | `town.ts` `barnCapMult` | `* landmarkLeverMult(state,'barnCap')` |
| Lanterns `forageRate` | `town.ts` `forageMult` | `* landmarkLeverMult(state,'forageRate')` |
| Koi Pond `creelCap` | `lake.ts` `creelCap` | `* landmarkLeverMult(state,'creelCap')` |
| Fountain `catchChance` | `lake.ts` `creelCatchChance` | add `landmarkCatchBonus(state)` alongside `petCatchBonus`, still `Math.min(1, …)` |
| Bakery `treatXp` | `town.ts` `buyTreat` (+ feed-all) | XP = `round(TREAT_XP * landmarkLeverMult(state,'treatXp'))` |
| Bridge `villagerXp` | `villagers.ts` `dripVillagerXp` | `gain * landmarkLeverMult(state,'villagerXp')` |
| Market `tradeYield` | `town.ts` `tradeWoodForFish` | fish out = `round(TRADE_FISH_YIELD * landmarkLeverMult(state,'tradeYield'))` |

### Prosperity (festival) — 3 leaf-rate seams, no double-count

> ⚠️ The fish seam is a **surgical expression rewrite, not a one-liner** (skeptic M2). Prosperity must apply to the rod base **only** — `forageRatePerSec(state,'fish')` already carries prosperity from the forest seam. The naive `(...) * villagerBoost * prosperityMult` double-counts every fish forager (2.25× instead of 1.5×). Note also Lanterns/`forageRate` and prosperity both reach fish via the shared `forageRatePerSec` seam — that is correct and matches existing `forage-tools`/dragonfly behavior (skeptic L2). Prosperity does NOT touch dungeon loot or the wood→fish trade (skeptic L1) — "all production" means the three continuous rate seams only.

| Seam | Change |
|---|---|
| `farm.ts` `farmRatesPerSec` | `multiplier *= prosperityMult(state)` |
| `forest.ts` `forageRatePerSec` | `base * forageMult(state) * prosperityMult(state)` — covers forest satchel AND the fish-affinity foragers feeding the lake |
| `lake.ts` `fishRatePerSec` | apply prosperity only to the rod base: `(BASE_ROD_RATE * prosperityMult(state) + forageRatePerSec(state,'fish')) * villagerBoost(state,'lake')` — foragers already carry prosperity from the line above, so this avoids double-application |

Caps (barn/satchel/creel) derive from rates, so they scale with prosperity automatically. Existing tests that assert exact rates must be updated to account for a `festivalLevel: 0` (prosperity = 1.0, a no-op) — **verify the default is a strict identity so no current test changes numerically.**

### Feed-all treats (`town.ts`)

```ts
export function feedAllTreats(state): GameState
```
Give one treat's XP to each creature in roster order, spending `TREAT_COST_ACORNS` per creature, stopping when acorns run out. No-op (same ref) if no creatures or `< TREAT_COST_ACORNS`. Uses the Bakery-boosted XP.

---

## 6. Store (`src/store/gameStore.ts`)

Add actions mirroring existing ones (each wraps `applyElapsed(get().state, Date.now())` then `commit`):
`buildLandmark(id)`, `fundFestival()`, `feedAll()`.

---

## 7. UI (`app/town.tsx` + components)

- **`VillageGreenCard`** (new) below the upgrade shop:
  - Header "🌳 Village Green" + current Prosperity × (once festival unlocked).
  - Landmark grid: one row/card per landmark — sprite (or emoji fallback), name, blurb, buff summary, cost, **Build** button (disabled + greyed when unaffordable; shows ✓ built with the buff active when owned). Follows `HabitatCard`/`UpgradeShop` visual pattern.
  - Once `allLandmarksBuilt`: a **Lantern Festival** card — next-level cost, current Prosperity ×, **Hold Festival** button.
- **`TreatsCard`**: add a **"Feed all (N🌰)"** button above/below the per-creature list, disabled when unaffordable.

No new tab — lives on the existing Town screen.

---

## 8. Sprites (`scripts/gen-sprites.py` + `src/ui/sprites.ts`)

- New group in `SPRITES`: `'landmarks': {'dir': 'landmarks', 'draw': { bakery, fountain, lanterns, bridge, gazebo, market, koipond, windmill }}`.
- One `draw_<id>()` per landmark using the existing primitives (`canvas`, `band`, `outline`, `crunch`, `body`, rectangles/ellipses). Buildings drop `eyes`/`smile`/`blush` — inanimate cel-banded structures (the crops `draw_wheat`/`draw_sapling` are the precedent). Same 512→44→64 crunch, ≤20 colors, dark outline `(16,16,32)`.
- `assets/landmarks/*.png` land at 64×64 RGBA.
- Add `LANDMARK_SPRITES: Partial<Record<LandmarkId, ImageSourcePropType>>` to `sprites.ts`; `SpriteIcon` renders sprite with emoji fallback (same as every other entity).
- Extend the contact-sheet glob to include `landmarks/*.png` for QA.

---

## 9. Testing

New `test/landmarks.test.ts`:
- `buildLandmark`: affordable → pays exact cost + appends; unaffordable/duplicate/unknown → same ref.
- `landmarkLeverMult`/`landmarkCatchBonus`: sum only built, ignore unbuilt, identity when none.
- Each buff seam: build the landmark → assert the target function changed by the right factor (e.g. Windmill → `farmRatesPerSec` ×1.10).
- `festivalCost` scaling; `canFundFestival` gated on all-8-built; `fundFestival` pays + increments; `prosperityMult` linear.
- `feedAllTreats`: feeds min(roster, affordable) creatures, spends exact acorns, no-op when broke.
- **Save round-trip**: a v7 blob deserializes to a v8 state with `landmarks: []`, `festivalLevel: 0`; v8 serialize/deserialize is stable.
- **Regression guard**: with no landmarks + `festivalLevel: 0`, every existing rate/cap function returns its pre-change value (prosperity/lever mults are strict identities — `x * 1.0 === x` bit-for-bit, so no `Math.round/ceil/floor` downstream shifts).
- **Non-identity prosperity test** (skeptic M2): build a state with `festivalLevel: 25` + one fish forager and assert `fishRatePerSec` scales the rod term and the forager term **each exactly once** (no double-count). The ×1.0 regression guard cannot catch this class of bug.
- **Breaking-test set — re-derived from a grep of `test/`, NOT from reasoning** (skeptic M1): `test/persistence/save.test.ts` hard-codes `expect(SAVE_VERSION).toBe(7)` → change to `.toBe(8)`. Before building, `grep -rn "toBe(7)\|VERSION" test/` to catch any other version-pinned assertion. All exact rate/cap assertions (`farm.test.ts` barnCap, `town.test.ts` mults/caps/treat/trade, `lake.test.ts` creel, `villagers.test.ts` drip) stay numerically identical at landmarks=[]/festivalLevel=0 — no edits needed there.

Gates: `npx tsc --noEmit` clean, `npx vitest run` green (full suite, including the version-bumped save test).

---

## 10. Out of scope (YAGNI)

- No prestige/reset (rejected — wipes the cozy town).
- No landmark upgrade levels (one-time builds; the festival is the infinite axis).
- No new tab, no cosmetic-only decorations beyond the 8 functional landmarks.
- No animation beyond the shared idle-bob every sprite already gets.

---

## 11. Release

After QA green: `scripts/release.sh --yes` — bumps patch (→ v1.0.7, versionCode 8), prebuild, gradle `assembleRelease`, sign with the real keystore (`~/Documents/lakewood-signing/`), verify, tag, `gh release create`, publish to `github.com/sergideki/lakewood-forest`. Founder pre-authorized the publish for this build.
