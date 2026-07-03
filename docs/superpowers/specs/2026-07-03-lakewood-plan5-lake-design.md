# Lakewood Plan 5 — The Lake 🎣 Design Spec (Fishing · Water Creatures · Pets)

**Date:** 2026-07-03
**Spec delta over:** the v1 design (`docs/superpowers/specs/2026-07-02-lakewood-cozy-idle-design.md` §8 —
"The Lake" future idea) and Plan 4 (Town, shipped `a78da54`).
**Status:** approved (founder), pre-plan.

---

## 1. What we're building

The lake is the game's fourth activity surface, after Farm, Forest, and Town. It delivers the
founder's parked "attract creatures via choices" request as its central, novel mechanic and adds a
second creature-acquisition flavour.

Three things land together:

1. **Fishing 🎣** — a passive rod that accrues a new **fish** resource into a capped **creel**;
   tap to collect (mirrors the forest satchel). Works from turn one with zero creatures.
2. **Water creatures (directed discovery)** — you **build a habitat** to attract **one specific**
   working water creature. Deterministic: no dice. This is the deliberate counterpoint to the
   forest, where creatures are found at random.
3. **Pets (chance discovery)** — collecting the creel has a chance to **catch a little pet** — a
   cozy, purely-collectible critter from a pool separate from the working water creatures. This is
   the "found and acquired, not only fish" path.

### The loop

```
cast rod → fish 🐟 accrue in creel → collect (chance to catch a pet 🐌)
        → spend fish to BUILD a habitat → habitat attracts its target water creature over a timer
        → collect habitat → that water creature is discovered
        → assign water creatures to fish → higher fish rate → repeat
```

### Design contrast (why the lake is not just "another forest")

| | Forest | Lake |
|---|---|---|
| Working-creature discovery | **random**, rarity-weighted rolls on collect | **directed**, you choose via which habitat you build |
| Chance discovery | (that random roll) | **pets**, caught by chance on creel-collect |
| Resource | wood 🪵 / acorn 🌰 (satchel) | fish 🐟 (creel) |

Random discovery stays a forest thing (land creatures only). Directed discovery is the lake's
signature. Pets add a small chance-based collectible so fishing has its own payoff.

---

## 2. Scope

### In scope (Plan 5)

- New resource `fish` and material `'fish'`; water species carry `affinity: 'fish'`.
- New capped store `storage.creel` + passive fish accrual with a flat base rod rate.
- 4 water species, each attracted by exactly one of 4 habitats (directed discovery).
- 6 pets caught by chance on creel-collect (cozy collectibles, no stats).
- Save envelope → **v4**, additive migration (backfills fish, creel, habitats, pets).
- New **Lake tab 🎣**: creel card, habitat cards, water-creature roster, catch toast.
- ResourceBar gains 🐟. Forest roster filtered to land creatures. Friends journal gains a Pets
  section and a `fish` affinity glyph.
- `rollDiscovery` (forest) filtered to land-only so water creatures never leak into random rolls.

### Out of scope (deferred — YAGNI for v1)

- Lake-specific upgrades (rod tier, bigger creel) — fishing runs on a fixed base rate + creature
  boost; a rod/creel upgrade track is a natural Plan 4-style follow-up after a balance pass.
- Pet bonuses / assignment — pets are pure collectibles this version (founder's choice).
- Breeding, lake dungeons, weather, seasonal fish.

---

## 3. Data model

### 3.1 Types (`src/engine/types.ts`)

```ts
// Material gains 'fish'
export type Material = 'wood' | 'acorn' | 'fish';

// Resources gains fish
export interface Resources {
  gold: number;
  wood: number;
  acorns: number;
  fish: number;
}

// Storage gains the creel (single-material, mirrors the satchel shape)
export interface Storage {
  barn: { amount: number };
  satchel: { wood: number; acorn: number };
  creel: { fish: number };
}

// Habitats — one build-once entry per definition. Status is DERIVED (see §4.3), so the
// only persisted field is when it was built (null = not built yet).
export interface HabitatState {
  id: string;
  builtAt: number | null; // epoch ms; null = unbuilt
}

export interface Habitat {
  id: string;
  name: string;
  emoji: string;
  attracts: SpeciesId;          // the ONE water creature this habitat attracts
  cost: Partial<Resources>;     // absent component = 0
  attractSec: number;           // time from build → ready
}

// Pets — cozy collectibles, no stats. Discovered ids only.
export type PetId = string;

export interface Pet {
  id: PetId;
  name: string;
  emoji: string;
  rarity: Rarity;
}

// GameState gains habitats + pets
export interface GameState {
  // …existing…
  habitats: HabitatState[];
  pets: PetId[]; // discovered pet ids; absent/[] = none caught
}
```

> **tsc is the safety net for the `fish` ripple.** Making `Resources.fish` required means every
> Resources *object literal* that isn't a spread must add `fish`, or compilation fails. Known sites
> to update: `createInitialState`, `town.upgradeCost` return, `town.purchaseUpgrade` resources
> literal (it rebuilds gold/wood/acorns by hand and would otherwise DROP fish), and the test
> `rich()` helper. Spread-based updates (`{ ...state.resources, … }`) preserve fish automatically.

### 3.2 Content (`src/engine/content.ts`)

**Water species** (added to the existing `SPECIES` record so `makeCreature`, the Friends journal,
and sprites all keep working uniformly; `affinity: 'fish'` is what routes them to the creel and
excludes them from forest random rolls):

| id | name | emoji | rarity | affinity |
|---|---|---|---|---|
| `ripplefrog` | Ripple Frog | 🐸 | common | fish |
| `puddleduck` | Puddle Duck | 🦆 | common | fish |
| `koisprite` | Koi Sprite | 🎏 | uncommon | fish |
| `mistleotter` | Mistle Otter | 🦦 | rare | fish |

**Habitats** (`HABITATS: Habitat[]`) — escalating cost + timer, mirroring the dungeon curve:

| id | name | emoji | attracts | cost | attractSec |
|---|---|---|---|---|---|
| `lilypads` | Lily Pads | 🪷 | `ripplefrog` | 20 🐟 | 15 min |
| `reedbed` | Reed Bed | 🎋 | `puddleduck` | 40 🐟 · 20 🪵 | 1 h |
| `koistones` | Koi Stones | 🪨 | `koisprite` | 80 🐟 · 50 🪙 | 2 h |
| `otterholt` | Otter Holt | 🕳️ | `mistleotter` | 150 🐟 · 60 🪵 | 4 h |

**Pets** (`PETS: Record<PetId, Pet>`) — 2 common / 2 uncommon / 2 rare:

| id | name | emoji | rarity |
|---|---|---|---|
| `pondsnail` | Pond Snail | 🐌 | common |
| `waterbeetle` | Water Beetle | 🪲 | common |
| `dragonfly` | Dragonfly | 🦋 | uncommon |
| `pebbleturtle` | Pebble Turtle | 🐢 | uncommon |
| `crawdad` | Crawdad | 🦞 | rare |
| `pondnewt` | Pond Newt | 🦎 | rare |

**Constants:**

```ts
export const BASE_ROD_RATE = 0.05;   // fish/sec with zero water creatures (bootstraps the loop)
export const CREEL_HOURS = 24;       // creel holds ~a day of the current fish rate
export const CREEL_FLOOR = 200;      // minimum creel capacity (mirrors SATCHEL_FLOOR)
export const CATCH_CHANCE = 0.25;    // chance to catch a pet per NON-EMPTY creel collect
export const HABITAT_IDS: string[] = HABITATS.map((h) => h.id);
export const PET_IDS: PetId[] = Object.keys(PETS);
```

Pet catch reuses the existing rarity weighting `DISCOVERY_WEIGHT` (common 6 / uncommon 3 / rare 1).

### 3.3 Initial state (`src/engine/state.ts`)

```ts
resources: { gold: 0, wood: 0, acorns: 0, fish: 0 },
storage: { barn: { amount: 0 }, satchel: { wood: 0, acorn: 0 }, creel: { fish: 0 } },
habitats: HABITATS.map((h) => ({ id: h.id, builtAt: null })),
pets: [],
```

Starter roster stays the two LAND creatures (`fernling`, `pebblepup`) — you begin with **no** water
creatures and **no** pets. The rod's base rate bootstraps everything.

---

## 4. Engine (`src/engine/lake.ts`, pure/RN-free)

Depends on `./content`, `./creatures` (`makeCreature`, weighting), and `./forest`
(`forageRatePerSec` — already material-generic). Nothing imports `lake` except `index` and the
store, so there is no cycle.

### 4.1 Fishing rate + creel capacity

```ts
/** Fish/sec = flat rod base + all fish-affinity foragers (creature part is forageMult-boosted). */
export function fishRatePerSec(state: GameState): number {
  return BASE_ROD_RATE + forageRatePerSec(state, 'fish');
}

/** Creel capacity = a day of the current fish rate, floored. (No upgrade mult in v1.) */
export function creelCap(state: GameState): number {
  return Math.max(CREEL_FLOOR, Math.round(fishRatePerSec(state) * CREEL_HOURS * 3600));
}
```

The rod base is intentionally NOT multiplied by the `forage-tools` upgrade (that tool is for the
forest satchel); only the creature contribution inherits `forageMult` via `forageRatePerSec`.

### 4.2 Accrue + collect (mirror satchel, but NO discovery on collect)

```ts
/** Fill creel by the fish rate over elapsedSec, clamped to cap. */
export function accrueCreel(state: GameState, elapsedSec: number): GameState { … }

/**
 * Bank whole fish into resources, carry the fractional remainder. If any fish were banked,
 * roll a pet catch. Collecting an EMPTY creel banks nothing and never rolls (no free pets).
 */
export function collectCreel(state: GameState, rng: Rng): GameState {
  const bankFish = Math.floor(state.storage.creel.fish);
  if (bankFish <= 0) return state; // empty → no bank, no catch
  const banked = { …fish += bankFish, creel.fish -= bankFish… };
  return rollCatch(banked, CATCH_CHANCE, rng);
}
```

`applyElapsed` (`src/engine/idle.ts`) gains one line: `next = accrueCreel(next, elapsedSec);` after
`accrueSatchel`.

### 4.3 Habitats — directed, deterministic discovery

Status is **derived** from `builtAt` + `discovered`; there is no separate "collected" flag (a water
species can only ever be discovered via its habitat, so `discovered` IS the completion record):

```ts
export type HabitatStatus = 'unbuilt' | 'attracting' | 'ready' | 'done';

export function habitatStatus(state, id, now): HabitatStatus {
  const def = HABITATS.find(h => h.id === id); const h = state.habitats.find(x => x.id === id);
  if (!def || !h) return 'unbuilt';
  if (state.discovered.includes(def.attracts)) return 'done';
  if (h.builtAt === null) return 'unbuilt';
  return now >= h.builtAt + def.attractSec * 1000 ? 'ready' : 'attracting';
}

export function canBuildHabitat(state, id): boolean; // unbuilt && all cost components affordable

/** Pay cost, stamp builtAt. No-op (same ref) unless status is 'unbuilt' and affordable. */
export function buildHabitat(state, id, now): GameState;

/** DETERMINISTIC: on 'ready', discover the target species (spawn makeCreature + push to
    discovered). No rng. No-op unless status is 'ready'. */
export function collectHabitat(state, id, now): GameState;
```

Cost handling spans all four resources (`gold`/`wood`/`acorns`/`fish`), absent = 0, `Math.ceil` not
needed (costs are integers). Deduct via a fresh resources object built from the existing one.

### 4.4 Pet catch (chance discovery, separate pool)

Mirrors `rollDiscovery` exactly but over `PETS` and writing to `state.pets`. Two rng draws (hit,
then weighted pick):

```ts
export function rollCatch(state: GameState, chance: number, rng: Rng): GameState {
  if (rng() >= chance) return state;
  const pool = PET_IDS.filter(id => !state.pets.includes(id)).map(id => PETS[id]);
  if (pool.length === 0) return state;
  // rarity-weighted pick via DISCOVERY_WEIGHT → push picked.id to state.pets
}
```

### 4.5 Forest random-roll exclusion (`src/engine/creatures.ts`)

`rollDiscovery`'s pool filter gains one clause so water creatures are never randomly discovered:

```ts
const pool = Object.values(SPECIES)
  .filter(sp => !state.discovered.includes(sp.id) && sp.affinity !== 'fish');
```

---

## 5. Store (`src/store/gameStore.ts`)

New actions, all `applyElapsed`-first and `commit`-gated (persistence stays gated on `loaded` — do
not regress the Plan 4 hydration fix):

| Action | Engine call | Discovery surfacing |
|---|---|---|
| `collectFish()` | `collectCreel(caught, Math.random)` | new **pet** → `lastCatch` (catch toast) |
| `buildHabitat(id)` | `buildHabitat(caught, id, now)` | none |
| `collectHabitat(id)` | `collectHabitat(caught, id, now)` | new **species** → existing `lastDiscovery` toast |
| `assignCreatureTo` | (existing) — already handles fish-affinity foragers, no change | — |

- `lastCatch: PetId | null` + `dismissCatch()` added, mirroring `lastDiscovery`/`dismissDiscovery`.
  A tiny `newlyCaught(prev, next)` helper (pets diff) mirrors `newlyDiscovered`.
- `collectHabitat` reuses `commitWithDiscovery` (it pushes to `discovered`, so the existing species
  toast fires — a nice reveal for the attracted creature).

---

## 6. UI

### 6.1 New Lake tab (`app/lake.tsx`)

Registered as the 5th tab in `app/_layout.tsx` (`🎣 Lake`, after Town). Same shell as Forest: a 1 s
tick loop + AppState foreground catch-up (drives live creel fill + habitat countdowns), ResourceBar,
ScrollView of cards, and the catch toast. Order: `CreelCard` → water-creature roster → habitat cards.

### 6.2 Components

- **`CreelCard`** (mirror `SatchelCard`): fish amount, `creelCap`, % meter, Collect button (disabled
  when empty). Uses `collectFish`.
- **`HabitatCard`** (mirror `DungeonCard`), one per habitat, switching on `habitatStatus`:
  - `unbuilt` → cost line + **Build** button (disabled unless `canBuildHabitat`), "attracts ???"
    (do **not** name the target creature before it's discovered — preserves the reveal; show the
    habitat name + a teaser like "a shy pond-dweller").
  - `attracting` → "Attracting… ⏳ {countdown}".
  - `ready` → **Collect** button ("✨ A friend arrived!").
  - `done` → dimmed, shows the now-known creature's icon + name ("{name} lives here").
- **Water-creature roster**: reuse `CreatureRoster`'s row style but filtered to `affinity === 'fish'`
  with a fish/rest toggle (status glyph 🐟). Simplest clean path: add an optional
  `filter?: (c) => boolean` (or a `material` prop) to `CreatureRoster` and pass land vs fish from the
  two screens — see §6.3. Empty state: "Build a habitat to attract your first water friend."
- **`CatchToast`** (mirror `DiscoveryToast`): "🎣 You caught a {pet.name}!", reads `lastCatch`,
  auto-dismiss + tap-dismiss via `dismissCatch`.

### 6.3 Edits to existing components

- **`ResourceBar`**: append `🐟 {r.fish}`.
- **`CreatureRoster`**: today it renders ALL creatures and hardcodes the forage glyph as
  `wood ? 🪵 : 🌰` — which would mislabel a fish forager. Add a `filter` prop (default: land only,
  `c.affinity !== 'fish'`) so Forest shows land creatures and Lake shows water creatures, and map the
  status glyph via `{ wood:'🪵', acorn:'🌰', fish:'🐟' }[affinity]`. Forest passes the default; Lake
  passes `c.affinity === 'fish'`.
- **`FriendsJournal`**: `AFFINITY_EMOJI` gains `fish: '🐟'` (else a discovered water creature crashes
  the affinity render). Add a **Pets** section below the creatures grid: "🐾 Pets — {pets.length}/6",
  same 2-col locked/unlocked grid over `PET_IDS`, keyed on `state.pets` (pets have no affinity line).

**zustand v5 rule binds every new selector**: subscribe to stable slices (`s.state`,
`s.state.creatures`, `s.state.pets`, `s.state.storage.creel`) or primitives — NEVER return a
freshly-built array/object from a selector (`.filter`/`.map`/`.find` go in the render body). This
crashed a screen on mount in Plan 3; it is the single most important gotcha here.

---

## 7. Save migration → v4 (`src/persistence/save.ts`)

`SAVE_VERSION = 4`. Add one additive, idempotent branch after the v3 branch; **keep all earlier
branches** (chaining v1→v2→v3→v4 must still work):

```ts
if (fromVersion < 4) s = addLakeFields(s);

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

`isValidBaseState` is unchanged (it validates only fields common to every version; lake fields are
backfilled by migrate, exactly as forest/town fields are).

---

## 8. Testing

Engine is the tested layer (vitest, node env); UI is covered by the live browser QA drive (no
component tests exist — the zustand mount crash class is only catchable live).

**New `test/engine/lake.test.ts`:**
- `fishRatePerSec`: base rate with zero creatures; rises when a fish-affinity creature forages;
  `forageMult` lifts only the creature part, not the rod base.
- `creelCap`: floor at zero production; scales with rate; integer.
- `accrueCreel`: fills at rate; clamps at cap; zero/negative elapsed is a no-op.
- `collectCreel`: banks whole fish, carries remainder; **empty creel is a no-op (no catch roll)**;
  with a stubbed `rng` below `CATCH_CHANCE`, a pet is caught (deterministic pick); with `rng` above,
  none; catching from an exhausted pool is a no-op.
- `habitatStatus`: unbuilt → attracting → ready → done transitions across `now` and `discovered`.
- `buildHabitat`: pays exact cost across all resources; no-op when unaffordable / already built /
  unknown id; sets `builtAt`.
- `collectHabitat`: no-op unless ready; on ready, discovers exactly the target species + spawns one
  creature; idempotent (second collect is a no-op because status is now `done`).
- `rollDiscovery` (add to `creatures.test.ts` or lake): never returns a fish-affinity species even
  when only water species remain undiscovered.

**`test/persistence/save.test.ts`:** bump the sanctioned `SAVE_VERSION` assertion to 4; add a v3→v4
backfill test and a v1→v4 full-chain test (satchel AND upgrades AND creel/habitats/pets all present);
confirm a current save round-trips fish/creel/habitats/pets.

Green bar target: existing **80** + the new lake suite, `tsc --noEmit` clean.

---

## 9. Risks & mitigations

- **Dropped `fish` on a hand-built Resources literal** → tsc fails (required field). The one
  non-obvious site is `purchaseUpgrade` (rebuilds resources without a spread) — call it out in the
  plan. Mitigation: tsc + a save round-trip test asserting fish survives a purchase.
- **Water creatures leaking into forest random rolls** → the §4.5 filter; a dedicated test asserts
  it.
- **Empty-creel pet farming** → `collectCreel` gates the catch roll on `bankFish > 0`.
- **zustand v5 selector crash on the new screen** → §6.3 rule + a real mount in QA (hard-reload
  every tab, including a direct deep-link to `/lake`, per the Plan 4 hydration gotcha).
- **Chicken-and-egg (no fish source without a water creature)** → the flat `BASE_ROD_RATE` bootstraps
  fishing from turn one.

---

## 10. Open questions (resolved at design time)

- New tab vs Forest section → **new tab** (matches one-tab-per-act).
- Do water creatures do anything → **yes, they boost the fish rate** (loop closure) via the shared
  forage machinery.
- Pet mechanical role → **cozy collectibles, no stats** (founder's choice).
- Lake upgrades → **deferred** to a post-balance follow-up.
```
