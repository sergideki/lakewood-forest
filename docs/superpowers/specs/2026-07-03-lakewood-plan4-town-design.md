# Lakewood Plan 4 — Town shop & upgrades (design)

Date: 2026-07-03 · Status: approved for implementation (autonomous session; decisions per standing brainstorm-auto-recommend feedback, justified inline)

## Goal

Give gold / wood / acorns their first **sinks**. Today all three resources only bank. The Town tab
(currently a `ComingSoon` placeholder) becomes a shop with:

1. **Upgrade tracks** that raise caps/rates — barn cap, satchel cap, forage rate, farm expansion.
2. **Creature treats** — a repeatable acorn sink that accelerates creature leveling.

This applies the Isekai lesson from the handoff ("2–3 upgrade tracks" — kept to 4 tight tracks +
one repeatable item, all named explicitly in the handoff item).

## Approaches considered

- **A (chosen): data-driven leveled tracks.** `UPGRADES` content table (like `CROPS`/`DUNGEONS`) +
  `state.upgrades: Record<UpgradeId, number>` (id → owned level). Engine multiplier helpers read the
  level. Matches every existing content pattern, additive save migration, easy to add tracks later.
- **B: one-shot boolean upgrades.** Simpler state but no progression depth — an idle game's sinks
  must escalate or the economy re-saturates immediately. Rejected.
- **C: generic modifier/effects system.** A list of `{target, op, value}` modifiers per upgrade.
  Over-engineered for 4 tracks with 3 effect kinds; YAGNI. Rejected.

Farm expansion representation: **append real plots to `state.plots` at purchase time** (chosen) vs
deriving plot count from level at render. Appending keeps `PlotGrid`, `farmRatePerSec`, and saves
untouched — plots persist like the existing three. Derivation would thread upgrade state through
every plot consumer. (Consequence: plots are state, so the migration never needs to reconcile them.)

## Engine design

### Types (`src/engine/types.ts`)

```ts
export type UpgradeId = string;

export interface TownUpgrade {
  id: UpgradeId;
  name: string;
  emoji: string;
  description: string;      // one line, shown in the shop
  maxLevel: number;
  baseCost: Partial<Resources>; // gold/wood/acorns at level 0→1
  costGrowth: number;           // per-level multiplier on every cost component
  // effect is interpreted by engine helpers keyed on the upgrade's id — no generic effect DSL
}

// GameState gains:
upgrades: Record<UpgradeId, number>; // id → owned level; absent key = 0
```

### Content (`src/engine/content.ts`)

```ts
export const UPGRADES: Record<UpgradeId, TownUpgrade> = {
  'barn-silo':   { name: 'Barn Silo',      emoji: '🏚️', maxLevel: 5, baseCost: { gold: 40, wood: 25 },  costGrowth: 1.8,
                   description: '+50% barn capacity per level' },
  'satchel-stitch': { name: 'Satchel Stitching', emoji: '🧵', maxLevel: 5, baseCost: { gold: 40, acorns: 20 }, costGrowth: 1.8,
                   description: '+50% satchel capacity per level' },
  'forage-tools':  { name: 'Forage Tools', emoji: '🪓', maxLevel: 5, baseCost: { gold: 60, wood: 30 },  costGrowth: 1.9,
                   description: '+15% forage rate per level' },
  'farm-plot':   { name: 'Farm Expansion', emoji: '🚜', maxLevel: 3, baseCost: { gold: 150, wood: 50 }, costGrowth: 2.5,
                   description: 'Clear land for a new crop plot' },
};

export const TREAT_COST_ACORNS = 25;
export const TREAT_XP = 100;
```

Cost of level `L→L+1` (0-indexed owned level `L`): `ceil(base × costGrowth^L)` per resource
component. All numbers are first-pass tuning — sized against current faucets (forage ≈ 180
items/h/creature at L1 common; Deepwood pays 300g/150w/90a per 4h) — and are expected to be
retuned from play.

### New module `src/engine/town.ts`

Pure functions, same style as `farm.ts`/`forest.ts`:

- `upgradeLevel(state, id): number` — `state.upgrades?.[id] ?? 0` (optional-chained so a pre-v3
  state object in a hand-built test never crashes).
- `upgradeCost(id, ownedLevel): Resources | null` — null when unknown id or at/above maxLevel.
- `canAfford(state, id): boolean`.
- `purchaseUpgrade(state, id): GameState` — no-op (returns `state` unchanged) when: unknown id,
  at max level, or can't afford. Otherwise deducts the cost, increments the level, and — for
  `farm-plot` only — appends `{ id: 'plot-4'|'plot-5'|'plot-6', crop: null }` (id derived from new
  plot count, always unique because plots are only ever appended). Deduction must iterate the
  cost's own entries (`(cost.gold ?? 0)` etc.) — `baseCost` is `Partial<Resources>`, so direct
  subtraction of an absent component would produce `NaN`.
- `buyTreat(state, creatureId): GameState` — no-op when acorns < `TREAT_COST_ACORNS` or unknown
  creature; otherwise deducts acorns and `grantXp(c, TREAT_XP)` (existing auto-level handles
  thresholds). Works on any creature regardless of assignment — a treat is instant, not a job.
- Multiplier helpers consumed by existing modules:
  - `barnCapMult(state)` = `1 + 0.5 × level('barn-silo')`
  - `satchelCapMult(state)` = `1 + 0.5 × level('satchel-stitch')`
  - `forageMult(state)` = `1 + 0.15 × level('forage-tools')`

### Touches to existing engine modules (minimal)

- `farm.ts` `barnCap`: `Math.round(Math.max(500, Math.round(perDay)) × barnCapMult(state))`. The
  multiplier applies **after** the floor so the upgrade is visible even at zero production, and the
  **final** value is rounded — floor×mult and rate×mult both produce fractional caps otherwise
  (e.g. odd cap × 1.5), and `BarnCard` renders the cap as an integer.
- `forest.ts` `satchelCap`: same shape with `satchelCapMult` — `Math.round(...)` as the outermost
  operation.
- `forest.ts` `forageRatePerSec`: multiply the summed rate by `forageMult(state)`. Note the cap is
  derived from the rate, so Forage Tools also organically raises the satchel cap — intended
  (cap = "24h worth of the current rate" stays true).
- Import direction: `farm.ts`/`forest.ts` → `town.ts` → `content.ts`/`creatures.ts`. No cycle
  (`creatures.ts` does not import `town.ts`).
- `state.ts` `createInitialState`: add `upgrades: {}`.
- `engine/index.ts`: `export * from './town'`.

### Save migration (`src/persistence/save.ts`)

`SAVE_VERSION = 3`. The new step **composes with** the existing v2 step — the full migrate body is:

```ts
function migrate(fromVersion: number, state: GameState): GameState {
  let s = state;
  if (fromVersion < 2) s = addForestFields(s);           // existing — keep
  if (fromVersion < 3) s = { ...s, upgrades: s.upgrades ?? {} }; // new
  return s;
}
```

Additive and idempotent like v2. `isValidBaseState` unchanged (upgrades is backfilled, not
validated). v1 saves chain v1→v2→v3 through both branches.

**Existing-test edit required:** `test/persistence/save.test.ts` hardcodes
`expect(SAVE_VERSION).toBe(2)` — that assertion moves to `3` in the same commit as the bump.
This is the only existing test the plan may touch; every other one of the 62 must pass unchanged.

## Store (`src/store/gameStore.ts`)

Two actions, both `applyElapsed`-first + `commit` (plain — treats/purchases roll no discovery):

```ts
purchase: (upgradeId: string) => commit(purchaseUpgrade(applyElapsed(get().state, Date.now()), upgradeId)),
feedTreat: (creatureId: string) => commit(buyTreat(applyElapsed(get().state, Date.now()), creatureId)),
```

## UI

`app/town.tsx` replaces the placeholder: `SafeAreaView` + `ResourceBar` + `ScrollView`, same as
Friends. **No tick loop** — resources only change through explicit actions (they never accrue
passively into `resources`), and every purchase runs `applyElapsed` first anyway.

New components (existing card idiom — `cards.card`, accent `Pressable` buttons like `SatchelCard`):

- **`UpgradeShop.tsx`** — one card per `UPGRADES` entry: emoji + name, description, `Lv 2/5`
  pips, cost line (`120 🪙 · 45 🪵`), Buy button. Button disabled (0.4 opacity) when
  unaffordable; the card shows `MAX` instead of a cost at max level. Purchases give instant
  feedback via state (level + resources change).
- **`TreatsCard.tsx`** — header explains the deal (`25 🌰 → +100 XP`); one row per creature
  (`CreatureIcon` + name + `Lv N` + xp-to-next) with a Feed button, disabled when
  acorns < 25. Creatures in dungeons still feedable (instant item).

zustand v5 discipline (the Plan 2 mount-crash trap): a selector must never return a freshly-built
array/object. Two safe idioms, both already in the codebase: subscribe to a stable slice
(`s.state.resources`, `s.state.upgrades`, `s.state.creatures`) and derive in the render body, OR
return a computed **primitive** from the full state inside the selector, like `SatchelCard`'s
`useGameStore((s) => satchelCap(s.state))` — that's also how the full-`GameState` helpers
(`canAfford`, `upgradeCost`) get called from components.

**`PlotGrid` touch (required):** its row container has no `flexWrap` — six `flex:1` plots would
squeeze into one row. Add `flexWrap: 'wrap'` and give plots a fixed flex-basis (e.g. `flexBasis:
'30%'` + `flexGrow: 1`) so 4–6 plots wrap into rows of three. This is the one existing component
Plan 4 edits.

## Testing

New `test/engine/town.test.ts` (vitest, node env, same style as farm/forest tests):

- cost curve: `upgradeCost` values + null at max/unknown.
- `purchaseUpgrade`: deducts exactly, increments level; no-ops (broke / max / unknown id) return
  the same state; `farm-plot` appends plot-4/5/6 with unique ids and null crop.
- Multipliers: `barnCap`/`satchelCap`/`forageRatePerSec` scale correctly at level 0 (×1 — existing
  62 tests already pin this implicitly) and at levels > 0; floor × mult interaction.
- `buyTreat`: deducts 25 acorns, grants 100 XP, auto-levels across a threshold; no-op when broke
  or unknown creature; works while assigned to a dungeon.
- Save: v2→v3 backfills `upgrades: {}`; v1→v3 chain; corrupt still yields fresh state.

Gates: `npx tsc --noEmit` clean, full `npm test` green (62 existing hold, except the one
sanctioned `SAVE_VERSION` assertion edit), then **live browser QA on /town** — mount, buy an
upgrade, watch cap change on Home/Forest, feed a treat, see level-up, AND buy Farm Expansion then
check the Home plot grid wraps to two rows with the new plot plantable — static review alone
missed the zustand trap last time.

## Out of scope

- The lake / fishing (LIVE id:lake — first expansion after Town).
- Selling resources for gold, prestige, decorations, villager hiring.
- Per-creature treat cooldowns or scaling treat costs — revisit if treats trivialize leveling.

## Decisions log (auto-recommend)

- Data-driven leveled tracks over booleans/modifier-DSL — matches content patterns, escalating sinks. 
- Farm expansion appends real plots at purchase — zero churn in plot consumers and saves.
- Multiplier applied after the cap floor — upgrades visibly work at zero production.
- Forage Tools also lifts satchel cap via the derived-cap rule — kept, it's the existing invariant.
- Treats: flat 25🌰 → 100 XP — rarity XP curves already make treats naturally weaker on rares.
- Treats work on dungeoned creatures, and `collectRun` reads power at collect time — so feeding
  mid-run raises the loot multiplier. **Accepted:** the same acorns fed before the run buy the same
  power (no value is created from nothing), and the power check is soft by design (mult clamped
  0.5–1.5). Revisit only if it distorts play; snapshotting power at `startRun` is the fix then.
- No tick loop on Town — resources never accrue passively; matches Friends screen.
