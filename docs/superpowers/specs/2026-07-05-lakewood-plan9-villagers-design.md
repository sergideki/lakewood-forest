# Plan 9 — Villager Depth (Family)

**Date:** 2026-07-05
**Status:** design (approved for planning)
**Runs after:** Plan 8 (SHIPPED, save v6, v1.0.5 published)

Turn the 3 identical farm-only villagers into a workforce you **assign across all three
production loops, recruit more of, specialize, and level up.** Four interlocking pillars, one plan.

Today (grounding): `Villager = { id, name, emoji, assignedTo: 'farm' | null }`. Farm produces nothing
with 0 assigned villagers (`farm.ts:22` gate); each extra assigned adds +25% (`farmRatesPerSec`).
Forest is creature-driven, Lake is rod-driven — villagers touch neither. No traits, levels, or recruiting.

---

## Pillar 1 — Assign to all three stations

`Villager.assignedTo` widens: `'farm' | 'forest' | 'lake' | null`. A single helper turns the villagers
on a station into a production multiplier:

```ts
export const VILLAGER_PER = 0.15;   // base contribution per villager-level (TUNABLE)
export const VILLAGER_SPEC = 2;     // specialty match doubles contribution (TUNABLE)

/** Multiplier a station's assigned villagers apply to its output.
 *  Farm is GATED (no villagers → 0, matching today's "needs labor" rule); Forest & Lake are
 *  ungated (they run on their own — villagers only add on top). */
export function villagerBoost(state: GameState, station: Station): number {
  const bonus = state.villagers
    .filter((v) => v.assignedTo === station)
    .reduce((s, v) => s + VILLAGER_PER * v.level * (v.specialty === station ? VILLAGER_SPEC : 1), 0);
  if (station === 'farm' && bonus === 0) return 0; // farm gate
  return 1 + bonus;
}
```

Wiring — apply the boost at each station's rate site, NOT inside the shared `forageRatePerSec`:

- **Farm** (`farm.ts` `farmRatesPerSec`): replace the current `(1 + 0.25*(assigned-1))` term with
  `villagerBoost(state, 'farm')`. Gate preserved (0 farm villagers → 0). `petLeverMult(state,'farmRate')`
  stays.
- **Forest** (`forest.ts`): introduce `satchelRatePerSec(state, material) = forageRatePerSec(state,
  material) * villagerBoost(state, 'forest')` and use it in BOTH `satchelCap` and `accrueSatchel`
  (currently both call `forageRatePerSec` directly for wood + acorn).
- **Lake** (`lake.ts` `fishRatePerSec`): multiply the whole return by `villagerBoost(state, 'lake')`.

> **TRAP (must respect):** `fishRatePerSec` = `BASE_ROD_RATE + forageRatePerSec(state, 'fish')`.
> Do NOT bake the forest boost inside `forageRatePerSec` — it would leak into the fish term and
> double-count. Keep `forageRatePerSec` PURE (creature output only); apply each station's villager
> boost at that station's own rate function (`satchelRatePerSec` / `fishRatePerSec` / `farmRatesPerSec`).

`Station = 'farm' | 'forest' | 'lake'` — a new exported type.

**Balance note (intentional):** the farm formula shifts slightly. Old: 1 villager = ×1.0, 2 = ×1.25.
New: a level-1 farm-specialist = ×1.30, a level-1 generalist = ×1.15. A mild early buff that rewards
specialty + leveling. `VILLAGER_PER`/`VILLAGER_SPEC` are tunable; a playtest pass can retune (like the
anti-dominance verdict did for crops).

---

## Pillar 2 — Per-villager traits (specialty)

`Villager` gains `specialty: Station`. Assigned to their specialty → double contribution (`VILLAGER_SPEC`).
Starting three, thematically:

- **Pip (vil-1) → farm**, **Nan (vil-2) → forest**, **Rowan (vil-3) → lake**.

Recruited villagers roll a specialty (Pillar 4). Specialty is fixed once set. This makes assignment a
puzzle: put each villager where they shine, or spread them to cover a lagging loop.

The Family UI shows each villager's specialty so the choice is legible (e.g. "🌲 forest specialist").

---

## Pillar 3 — Leveling

Villagers gain XP while assigned to any station (mirrors `dripForagerXp` for creatures), and level up
for a bigger `villagerBoost`.

```ts
export const VILLAGER_XP_PER_SEC = 0.05;                 // TUNABLE
export function villagerXpForLevel(level: number): number {
  return Math.round(60 * Math.pow(1.35, level - 1));     // 60, 81, 109, ... (TUNABLE)
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

`dripVillagerXp` is added to `applyElapsed` (`idle.ts`) alongside the existing accrue/drip steps.
No level cap (like creatures). `villagerXpForLevel` is a plain curve — villagers have no rarity, so
it does not reuse the creature `xpForLevel(level, rarity)`.

---

## Pillar 4 — Recruit more villagers

A **Town** card "Welcome a Villager" — a repeatable purchase (mirrors `purchaseUpgrade`), capped.

```ts
export const MAX_VILLAGERS = 8;                          // TUNABLE cap
export const VILLAGER_NAMES = ['Bram','Wren','Tansy','Milo','Fen','Ada','Rue','Sage','Bo','Ivy'];

/** Escalating cost by how many villagers you already have. null when at cap. */
export function recruitCost(count: number): Resources | null {
  if (count >= MAX_VILLAGERS) return null;
  const over = count - 3;                                // first recruit (count 3) = tier 0
  const mult = Math.pow(1.8, Math.max(0, over));
  return { gold: Math.ceil(120 * mult), wood: 0, acorns: Math.ceil(40 * mult), fish: 0 };
}

/** Recruit if affordable and under cap. New villager: level 1, unassigned, rolled specialty.
 *  rng picks the specialty AND the name index (deterministic under test). */
export function recruitVillager(state: GameState, rng: Rng): GameState { /* ... */ }
```

- Cost = **gold + acorns**, escalating 1.8× per villager past the starting 3. At cap → the card shows
  "Full house" and is disabled.
- New villager: `id = 'vil-' + (state.villagers.length + 1)`, name from `VILLAGER_NAMES` (rng-indexed,
  fall back to `Villager N` if the pool is exhausted), a generic villager `emoji` (e.g. `🧑‍🌾`),
  `specialty` rng-rolled over the 3 stations, `level: 1`, `xp: 0`, `assignedTo: null`.
- Recruited villagers have **no sprite PNG** (registry only has vil-1/2/3) → `SpriteIcon` emoji
  fallback. Fine; a later art pass can add sprites.
- New achievement **"Full House"** — `villagers.length >= MAX_VILLAGERS`. Added to `ACHIEVEMENTS`
  (now 11). (Optional stretch, not required: "Foreman" — a villager reaches level 10.)

---

## Data model + save migration v6 → v7 (additive)

`Villager` becomes:

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

`createInitialState`: the 3 starters gain `specialty` (farm/forest/lake by id), `level: 1`, `xp: 0`.

Migration `addVillagerDepth(old)` (chained after `addLifetimeCounters`, `SAVE_VERSION = 7`):
- Per-villager, per-field backfill (same discipline as the lifetime migration — never a whole-object
  presence check): `specialty ?? SPECIALTY_BY_ID[v.id] ?? 'farm'`, `level ?? 1`, `xp ?? 0`.
  `SPECIALTY_BY_ID = { 'vil-1':'farm', 'vil-2':'forest', 'vil-3':'lake' }`.
- `assignedTo` stays as-is: a legacy `'farm'` or `null` is already valid under the widened type.
- `isValidBaseState` stays pre-migration-safe — it already only checks `Array.isArray(s.villagers)`;
  do NOT add per-field villager assertions (would wipe a real v6 save).

---

## UI — the Family section (on Home)

There is no separate Family tab today; villagers live in the `VillagerRow` card on the Home screen.
Expand that card into a vertical **assignment list** (a horizontal 3-chip row won't hold 8 villagers
with pickers):

- One row per villager: sprite (bobs, already global) + name + specialty badge (`🌱/🌲/🌊 specialist`)
  + `Lv N` + a thin XP bar + a compact **4-way station selector** (Farm / Forest / Lake / Rest) that
  calls the store `assign(id, station|null)`.
- A **recruit row** at the bottom: shows the next `recruitCost` (or "Full house 8/8"), disabled when
  unaffordable/at cap; on press calls a new store `recruit()` action.
- Subscribe only STABLE store slices (`s.state.villagers`, plus `s.state.resources` for affordability)
  — never build a fresh array inside the selector (zustand v5 mount-crash rule, see `FriendsJournal.tsx:25`).
- Keep it on Home under a ScrollView (Home already scrolls). A dedicated tab is deferred — avoids a
  7th navbar item.

The store `assign` action widens its `to` param to `Station | null`. New `recruit()` action wraps
`recruitVillager(state, Math.random)` + persists (mirrors `tradeWood`/`buyTreat`).

---

## Testing

- `villagers.test.ts` (new): `villagerBoost` for each station (gate on farm, ungated forest/lake,
  specialty double, level scaling, empty cases); `grantVillagerXp` level-up + carry; `dripVillagerXp`
  only touches assigned villagers; `recruitCost` escalation + null at cap; `recruitVillager` (affordable
  → appends correct villager; at cap → no-op; unaffordable → no-op; deterministic under a stub rng).
- Extend `farm.test.ts` / `forest.test.ts` / `lake.test.ts`: assigning a villager to that station raises
  its rate by the expected multiplier; **a forest villager does NOT change `fishRatePerSec`** (the
  contamination guard); farm gate still holds (0 farm villagers → 0 rate).
- `save.test.ts`: `SAVE_VERSION` pin → 7; a v6 blob (villagers without specialty/level/xp) migrates,
  backfills starters' specialty by id, is not wiped; full v1→v7 chain lands valid.
- `achievements.test.ts`: "Full House" completes at `MAX_VILLAGERS`; `ACHIEVEMENTS` length now 11.
- All existing tests stay green (some farm-rate assertions may need updating for the new formula —
  update, don't delete).

---

## Sequencing

1. Data model + `Station` type + `villagerBoost` + migration v6→v7 (TDD).
2. Leveling (`grantVillagerXp`/`villagerXpForLevel`/`dripVillagerXp` + `applyElapsed`).
3. Wire boost into farm/forest/lake rate sites (the contamination-safe way).
4. Recruit (`recruitCost`/`recruitVillager` + store `recruit()`) + "Full House" achievement.
5. UI: expand `VillagerRow` into the assignment list + recruit row; store `assign` widened.
6. Live QA (assign across stations, level-up, recruit to cap, save no-wipe over v7) → merge → release.

Engine (1-4) lands before UI (5). Pillars interlock but each task is independently testable.
