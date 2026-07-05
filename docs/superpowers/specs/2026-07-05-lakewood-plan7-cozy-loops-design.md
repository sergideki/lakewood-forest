# Lakewood — Plan 7: Cozy Loops (design)

Date: 2026-07-05 · Status: approved, pre-plan
Predecessor context: Plan 5 (lake/pets), Plan 6 (crop rework), `docs/superpowers/specs/2026-07-04-anti-dominance-playtest-verdict.md`.

Three interlocking features, one plan. **No save-version bump** (stays v5): every feature
derives from already-persisted state or touches only `resources`. Full pipeline
(brainstorm → spec → doubt-skeptic → plan → subagent-driven → live QA).

Baseline: `main` green, 155/155 vitest, tsc clean.

---

## Feature 1 — "While You Were Away" summary (pure UI, zero engine change)

### Intent
On app open after time away, show a cozy dismissible card summarizing what the idle engine
accrued. Pure UI over the deltas `applyElapsed` already produces — **no engine change**.

### Where the deltas come from
`gameStore.load()` currently runs `applyElapsed(deserialize(raw), Date.now())`. We capture the
state **before** and **after** that single call and diff them. This is computed **exactly once
per load** and stored — never recomputed on ticks or actions (per-action micro-gaps must never
leak into the summary).

### Pure helper (unit-tested)
New `src/lib/awayReport.ts`:

```ts
export interface AwayReport {
  elapsedSec: number;
  barn:    { gold: number; wood: number; acorns: number }; // storage.barn gains (≥0)
  satchel: { wood: number; acorn: number };                // storage.satchel gains (≥0)
  creel:   { fish: number };                               // storage.creel gain (≥0)
  marigoldFishDrained: number;                             // resources.fish DECREASE (≥0), framed as a cozy "sip"
  readyDungeons: string[];                                 // dungeon ids that flipped not-ready → ready
  readyHabitats: string[];                                 // habitat ids that flipped attracting → ready
}

export function computeAwayReport(before: GameState, after: GameState, now: number): AwayReport | null;
```

- **`elapsedSec = Math.max(0, (now − before.meta.lastSeen) / 1000)`** — pinned. MUST use
  `before.meta.lastSeen`, NOT `after.meta.lastSeen` (applyElapsed sets the latter to
  `max(now, lastSeen)` = `now`, which would make the gap always 0). Clock rollback (`now <
  before.lastSeen`) → 0 → suppressed by the guard.
- Returns `null` when `elapsedSec < AWAY_MIN_SEC` (60) **or** every field is empty/zero (no
  gains, no newly-ready). A null report means "don't show the card."
- Storage gains are `max(0, after − before)` per bucket (fractional storage is fine; the card
  floors for display — reuse the existing floor-on-display convention, do NOT show 16 decimals,
  cf. the v1.0.4 fish-decimals fix).
- `marigoldFishDrained = max(0, before.resources.fish − after.resources.fish)`.
- Ready-detection uses existing derived predicates against `before`@`before.meta.lastSeen`-era
  vs `after`@`now`: a dungeon/habitat counts as newly-ready when it was **not** ready in `before`
  (evaluated at `before`'s own lastSeen) and **is** ready in `after` at `now`. Use
  `isRunReady(state, id, now)` (forest) and `habitatStatus(state, id, now) === 'ready'` (lake).
  - `before` readiness is evaluated at `before.meta.lastSeen` (its "now"); `after` at `now`.

### Store wiring
`gameStore`: add `awayReport: AwayReport | null` (init `null`) and `dismissAwayReport()`.
In `load()`:
```ts
const restored = deserialize(raw);
const now = Date.now();
const advanced = applyElapsed(restored, now);
const report = computeAwayReport(restored, advanced, now);
persist(advanced);
set({ state: advanced, loaded: true, awayReport: report });
```
On the storage-read-failure path (catch), leave `awayReport` null (fresh boot, nothing to report).

### UI
New `src/ui/components/AwaySummary.tsx` — modal overlay (reuse the crop-picker separate-backdrop
pattern so an inner tap doesn't dismiss). Rendered from `app/index.tsx` (Home) when
`awayReport != null`; a "Welcome back!" header + humanized duration + one line per nonzero
delta (emoji + floored amount) + "🍄 Mossy Hollow is ready" / "🪷 Lily Pads is ready" lines for
newly-ready runs. Single "Nice!" dismiss button → `dismissAwayReport()`. Shown once per load.

- Duration format: reuse/extend any existing humanizer; else inline `Xh Ym` / `Ym` / `<1m`.
- Empty deltas are omitted (only nonzero lines render).
- `marigoldFishDrained` is framed gently ("🌼 marigolds sipped X🐟"), never as a red/loss line —
  it's expected upkeep. A long absence can drain a stocked pond to 0, so this number can be large
  and true; the cozy framing (and its placement below the gains) keeps it from reading as a loss.

### YAGNI
No "collect all" button (collection stays per-screen), no history, no settings toggle.

---

## Feature 2 — Pet passive bonuses (engine change, save-safe)

### Intent
Each caught pet grants a small permanent global buff. Resolves the "pets-valued ambiguity" from
the anti-dominance verdict: pets currently have no stats, so a resource-only optimizer values them
at zero. Giving each a distinct passive makes catching them a real optimization target, and each
buff touches a **different** subsystem so completing the 6-set rewards every loop.

**Save-safe:** bonuses are DERIVED from `state.pets` (persisted since v4). No new state fields, no
migration, save stays v5.

### Mapping (content.ts — the tunable knobs)
```
PET_EFFECTS: Record<PetId, PetEffect>
  pondsnail    (common)   → barnCap    +0.05
  waterbeetle  (common)   → satchelCap +0.05
  dragonfly    (uncommon) → forageRate +0.08
  pebbleturtle (uncommon) → creelCap   +0.08
  crawdad      (rare)     → farmRate   +0.10
  pondnewt     (rare)     → catchChance +0.03  (flat additive to base catch chance)
```
A pet's effect applies only while its id is in `state.pets`. Effects are additive; each pet is
unique (caught at most once) so no stacking within a lever from one pet.

### New pure module `src/engine/pets.ts`
```ts
export type PetLever = 'barnCap' | 'satchelCap' | 'creelCap' | 'forageRate' | 'farmRate' | 'catchChance';
export interface PetEffect { lever: PetLever; amount: number; }

/** Summed pet effect per lever from the caught set. Multiplicative levers return a MULTIPLIER
 *  (1 + Σamount); catchChance returns an additive BONUS (Σamount, 0 when none). */
export function petLeverMult(state: GameState, lever: Exclude<PetLever,'catchChance'>): number; // ≥1
export function petCatchBonus(state: GameState): number; // ≥0, additive
```
`PET_EFFECTS` lives in content.ts (data); `pets.ts` holds the pure summing logic. `pets.ts` imports
`PET_EFFECTS` from content.

### Wiring (each existing lever gains a pet factor)
- `barnCapMult(state)` → `(1 + 0.5*L) * petLeverMult(state,'barnCap')` (town.ts)
- `satchelCapMult(state)` → `(1 + 0.5*L) * petLeverMult(state,'satchelCap')` (town.ts)
- `forageMult(state)` → `(1 + 0.15*L) * petLeverMult(state,'forageRate')` (town.ts) — `forageMult`
  multiplies the *creature* forage output for ALL materials (wood/acorn/fish). **Dragonfly always
  boosts land foraging** (the player starts with 2 land foragers), and additionally lifts the fish
  rate + creel cap *when a fish-affinity creature is assigned* (the flat `BASE_ROD_RATE` component
  of `fishRatePerSec` is NOT multiplied — lake.ts:19). UI copy: "+8% forage" (accurate for the
  always-on land effect); don't claim it as a fishing buff unconditionally.
- `creelCap(state)` (lake.ts) → multiply the final rounded cap by `petLeverMult(state,'creelCap')`.
  Applied AFTER the existing `Math.round(... )`; re-round. Pebble Turtle's creel buff is
  independent of Dragonfly's (creel cap already scales with rate via forageMult; this adds a
  second, cap-only factor).
- `farmRatesPerSec(state)` (farm.ts) → multiply every per-resource rate by
  `petLeverMult(state,'farmRate')`. This lifts both production AND barn cap (barnCap derives from
  rate) — acceptable and thematic for Crawdad.
- `creelCatchChance(state)` (lake.ts) → **apply `petCatchBonus` AFTER the marigold clamp, not
  before.** `MARIGOLD_CATCH_CAP = 0.50` binds at 5 marigolds (0.25 + 5×0.05), so folding the pet
  bonus into the pre-clamp base makes it inert exactly when it's caught (Pond Newt is rare = late,
  by which point marigolds are usually maxed — skeptic F1). Correct form:
  ```ts
  const marigoldChance = n === 0 || fish <= 0
    ? CATCH_CHANCE
    : Math.min(CATCH_CHANCE + MARIGOLD_CATCH_BONUS * n, MARIGOLD_CATCH_CAP);
  return Math.min(1, marigoldChance + petCatchBonus(state));
  ```
  Pet bonus is a separate source and is allowed to push the total above the marigold-only cap of
  0.50 (final clamp is 1.0). **Pond Newt therefore always adds its +3% to the odds of catching the
  remaining pets — intended cozy "collection momentum," and it works even at max marigolds.**
  The PRE-bank measurement in `collectCreel` (lake.ts:94) reads `state.pets`, identical pre/post
  bank, so the bonus is stable across the collect.

### Precedence / ordering note (skeptic bait — call it out)
Pet mults compose multiplicatively with upgrade mults. Order within a function does not matter for
multiplication, but the `creelCap` and `barnCap` **re-round** after applying the pet factor — the
pet factor is applied to the already-rounded upgrade cap, then re-rounded. Documented so a reviewer
doesn't "fix" it into a single round.

### UI
Friends 🐾 Pets section (`FriendsJournal.tsx`): under each caught pet, a one-line buff label
(e.g. "+5% barn"). Uncaught pets stay hidden/`???` (no bonus leak, mirrors the existing
locked-card no-rarity-leak rule). Optionally a small "Pet bonuses" summary at the section head —
keep minimal.

### Tests
`test/engine/pets.test.ts`: empty set → all mults 1, catchBonus 0; single pet → its lever only;
full set → each lever’s summed factor; unknown/duplicate ids ignored. Plus assertions that each
wired lever function reflects the pet factor (e.g. `barnCapMult` with pondsnail caught).

---

## Feature 3 — Recurring wood→fish Town trade (revives sapling)

### Intent
Wood has only finite sinks (upgrades cap at L5, habitats one-time) so sapling is near-dominated
(anti-dominance verdict §"one real blemish"). A repeatable wood→fish trade is the **infinite wood
sink** that gives sapling ongoing value and links wood into the fish → marigold/pet-catch/habitat
loop.

### Mechanics (pure `tradeWoodForFish` in town.ts)
```
TRADE_WOOD_COST = 20   // 🪵 spent per trade
TRADE_FISH_YIELD = 4   // 🐟 gained per trade  (5:1 wood:fish)
```
```ts
export function canTradeWoodForFish(state: GameState): boolean; // wood >= TRADE_WOOD_COST
export function tradeWoodForFish(state: GameState): GameState;   // no-op (same ref) if unaffordable
```
Repeatable, no cooldown, no cap. Touches only `resources.wood`/`resources.fish` → **save-safe.**

### Balance check (documented, not enforced — realistic-investment math)
Sapling yields `6/180 = 0.0333🪵/s` per plot × farm-villager multiplier `(1 + 0.25*(v−1))`.
At **5:1** (20🪵→4🐟):
- 1 sapling plot, 1 villager: ~120🪵/hr → ~24🐟/hr.
- **2 sapling plots, 3 villagers** (heavy-investment case the game supports — 8 plots max, 3
  villagers): `0.0333×2×1.5 = 0.1🪵/s` = 360🪵/hr → ~72🐟/hr ≈ **one marigold's ~72🐟/hr drain**.
So even at heavy sapling investment the trade only breaks even with a single marigold rather than
out-feeding it (the 4:1 ratio in the first draft over-fed at scale — skeptic F2). The wood→fish
sink stays a genuine supplement without turning marigold into a free perpetual catch boost —
and note marigold's catch value is self-limiting anyway (once all 6 pets are caught the pool is
empty and marigold becomes a pure fish sink you'd un-plant). 5:1 is the tunable ratio.

### UI
New card on `app/town.tsx` below `TreatsCard`: label + cost/yield + a "Trade" button (disabled when
`!canTradeWoodForFish`). Wire a store action `tradeWood()` →
`commit(tradeWoodForFish(applyElapsed(get().state, Date.now())))` — spell out the `Date.now()`
timestamp (every other store action passes it; don't drop it — skeptic F6).

### Tests
`test/engine/town.test.ts` (extend): affordable trade deducts 20🪵 / adds 4🐟; unaffordable is a
no-op same-ref; repeatable (two trades = −40🪵/+8🐟).

---

## Cross-cutting

- **Save version unchanged (v5).** No migration. Existing v5 saves gain pet bonuses the instant
  they load (derived), the trade card, and the away summary — all backward-compatible.
- **Determinism:** no new rng; pet catch still rolls in `collectCreel` (only its base chance
  shifts). Away report is a pure diff.
- **tsc + full suite must stay green;** new tests added for the three pure surfaces
  (`awayReport`, `pets`, trade). Target ≥ 155 + new.
- **Display flooring:** the away card and any pet-buffed counter must floor fractional resources on
  display (cf. v1.0.4 ResourceBar fix) — never surface accumulator decimals.

## Out of scope (Plan 8)
Idle sprite animation, achievements/lifetime counters, weak-sprite art pass.
