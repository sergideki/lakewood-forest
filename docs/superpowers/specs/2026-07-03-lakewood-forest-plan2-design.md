# Lakewood Forest — Plan 2 Design Spec (Forest & Creatures)

*Cozy forest-farm idle game · React Native + Expo · personal project*
Date: 2026-07-03 · Status: **Approved (brainstorm)** → next: implementation plan
Spec delta over: `docs/superpowers/specs/2026-07-02-lakewood-cozy-idle-design.md` (v1 design)
Builds on: Plan 1 (farm loop) — shipped, `main` green.

---

## 1. What this plan adds

Plan 1 shipped the farm half of the dual-labor loop: villagers tend plots, the barn
fills on wall-clock, you Collect gold. Plan 2 builds the **Forest** — the second labor
type — in one plan:

- **Creatures** as a second worker pool (distinct from villagers).
- **Foraging** → a capped **satchel** of wood 🪵 + acorns 🌰 (mirrors the barn).
- **Chill dungeon runs** → discrete timed runs with a soft power check → loot + discovery.
- **Discovery** → completing activities can spot a new wild creature that auto-joins your roster.
- **Passive creature XP / leveling** (Town accelerators come later, Plan 4).

The public product name becomes **Lakewood Forest** (world = "Lakewood"; "Forest" is one of
four zones). Repo/README/`app.json`/in-game title aligned at publish time (end of Plan 2).

### Explicitly OUT of Plan 2
- **Friends journal UI** (Plan 3) — Plan 2 *populates* `discovered`; Plan 3 renders it read-only.
- **Sinks** for wood/acorn/gold (Plan 4, Town shop) — in Plan 2 resources bank and accumulate,
  exactly as gold does today.
- Breeding/hatching, habitats/lures, the lake — all remain post-v1 per v1 spec §8.

---

## 2. Design decisions (locked in brainstorm 2026-07-03)

1. **Scope:** full Forest in one plan (forage + dungeons + creatures + discovery).
2. **Discovery:** rarity-weighted roll on **activity completion** (dungeon collect + satchel
   collect); a hit **auto-joins** the creature to your roster (no befriend cost, no fail moment).
3. **Forage:** **one shared capped satchel** holding wood + acorn totals; each creature's
   **affinity** (`wood` | `acorn`) picks which material it yields. Collect banks both.
4. **Dungeons:** **no-fail timed runs** with a **soft power check** — team level/rarity vs the
   dungeon's recommended power scales loot quality and discovery odds. Never a net loss.
5. **Creature progression:** **passive XP** from activities, **auto-level** on thresholds (in
   scope now). Paid Town accelerators are Plan 4 (out of scope).

---

## 3. Architecture

**Chosen model: one `assignment` field per creature** (single source of truth). A creature is
in exactly one state: `idle | forage | dungeon`. The proven pure-engine + injected-clock design
from Plan 1 is extended — `applyElapsed` gains satchel accrual + forager XP drip; dungeon runs
complete by timer and are collected as a discrete user action.

**New requirement vs Plan 1: injected randomness.** Discovery and loot rolls need RNG, and the
engine is pure/unit-tested. Thread an injected `rng: () => number` (default `Math.random`, faked
in tests) into every roll function — same discipline as the injected clock. The engine stays
deterministic and fully testable.

### 3.1 Data model delta

Additions to `GameState` (existing fields keep their shape except `Resources` gains two keys):

```ts
resources: { gold: number; wood: number; acorns: number };   // wood/acorns return

type Rarity = 'common' | 'uncommon' | 'rare';
type SpeciesId = string;

interface Creature {
  id: string;
  species: SpeciesId;
  name: string;
  emoji: string;
  rarity: Rarity;
  affinity: 'wood' | 'acorn';        // material it forages
  level: number;
  xp: number;
  assignment: {
    type: 'idle' | 'forage' | 'dungeon';
    dungeonId: string | null;        // set when type==='dungeon'
    startedAt: number;               // epoch ms; 0 when idle
  };
}

interface Storage {
  barn: { amount: number };                     // unchanged
  satchel: { wood: number; acorn: number };     // one store, derived combined cap
}

interface DungeonRun { creatureIds: string[]; startedAt: number }        // epoch ms
interface DungeonState { id: string; activeRun: DungeonRun | null }

interface GameState {
  resources: Resources;
  plots: Plot[];
  villagers: Villager[];
  creatures: Creature[];             // NEW — start owning 2
  storage: Storage;                  // NEW satchel alongside barn
  dungeons: DungeonState[];          // NEW — ~3
  discovered: SpeciesId[];           // NEW — populated here; Friends (Plan 3) reads it
  meta: Meta;
}
```

### 3.2 Content tables (like `CROPS`)

- **`SPECIES: Record<SpeciesId, Species>`** — ~10 discoverable. Each: `name`, `emoji`, `rarity`,
  `affinity` (`wood`|`acorn`), and an XP curve keyed off rarity. 2 are the starter roster; ~8 are
  found in the wild.
- **`DUNGEONS: Dungeon[]`** — ~3 tiers. Each: `id`, `name`, `emoji`, `durationSec`
  (~15min / 1h / 4h), `loot` (`{gold,wood,acorn}` base), `baseDiscoveryChance`, `recommendedPower`.

### 3.3 Save migration

Bump `SAVE_VERSION`. The migration is **additive** — a Plan-1 save loads with `wood/acorns = 0`,
empty `satchel`, empty `creatures` seeded to the 2 starters, empty `dungeons` seeded to the ~3
tiers, empty `discovered`. Old saves never throw (additive only).

---

## 4. Engine functions (pure, `(state, …) → state`, RNG injected where noted)

New files: `src/engine/forest.ts` (forage + dungeons) and `src/engine/creatures.ts` (roster + XP),
re-exported from the barrel. `applyElapsed` (in `idle.ts`) is extended.

**Forage (mirrors the barn):**
- `forageRatePerSec(state, material)` — Σ over creatures foraging `material` of
  `base × rarityMult × levelMult`.
- `satchelCap(state)` — derived: `totalForageRate × SATCHEL_HOURS`, with a sane floor (same
  pattern as `barnCap`).
- `accrueSatchel(state, elapsedSec)` — fills `wood`/`acorn` by their rates, clamped so
  `wood + acorn ≤ satchelCap`. No-op on `elapsedSec ≤ 0`.
- `collectSatchel(state, rng)` — banks wood + acorn into resources, empties satchel, then
  **rolls discovery** (a foraging session was collected).

**Dungeons:**
- `startRun(state, dungeonId, creatureIds)` — sets those creatures to `assignment.type='dungeon'`
  (dungeonId + startedAt), sets `dungeons[i].activeRun`. Guard: rejects busy creatures / an
  already-running dungeon (no-op).
- `isRunReady(state, dungeonId, now)` — `now ≥ activeRun.startedAt + durationSec`.
- `teamPower(state, creatureIds)` — `Σ (rarityWeight × level)`.
- `collectRun(state, dungeonId, rng, now)` — only when ready. `mult = clamp(teamPower /
  recommendedPower, 0.5, 1.5)`; grants `loot × mult` into resources; **discovery roll** at
  `baseDiscoveryChance × mult`; grants each creature a dungeon-XP lump (auto-levels); frees them
  to `idle`; clears `activeRun`. Never a net loss (floor 0.5×).

**Creatures / XP:**
- `grantXp(creature, amount)` + `levelUp` on threshold (rarity sets the curve). Level lifts forage
  rate and dungeon power. Foragers drip XP inside `accrueSatchel`; dungeon XP is a lump in
  `collectRun`.

**Discovery:**
- `rollDiscovery(state, chance, rng)` — if it fires, pick an **undiscovered** species
  (rarity-weighted), spawn an idle `Creature` instance, append its species to `discovered`. If all
  species are already discovered, no-op.

**`applyElapsed` extension:** after the existing barn step, also `accrueSatchel(elapsedSec)` and
drip forager XP. Dungeon runs need **no** accrual — they become *ready* when the timer elapses and
are collected on demand (works identically whether the app was open or the run finished while
away). The existing `elapsed ≥ 0` clamp covers rollback.

**Tuning constants** (final numbers set in the plan, tuned for a "daily peek" rhythm):
`SATCHEL_HOURS`, per-tier dungeon `durationSec` (~15min/1h/4h), `baseDiscoveryChance` per tier,
rarity weights, level XP thresholds, forage `base`/`rarityMult`/`levelMult`.

---

## 5. UI — Forest tab

Replace the `ComingSoon` in `app/forest.tsx` with a warm dashboard reusing `theme.ts` and the
existing card idiom (`BarnCard`/`PlotGrid`/`VillagerRow` patterns):

- **SatchelCard** — wood 🪵 + acorn 🌰 against the combined-cap meter, one **Collect** button
  (banks both; may trigger a discovery). Same shape as `BarnCard`.
- **CreatureRoster** — owned creatures (emoji, name, rarity dot, level). Tap → assignment picker:
  **Rest / Forage / send to a Dungeon**. Shows state ("foraging wood", "delving Mossy Hollow",
  "resting"). Creatures busy in a dungeon are locked until that run is collected.
- **DungeonCards** (~3) — tier, recommended power, assigned team, progress bar / countdown.
  States: *empty* (assign → Start), *running* (timer), *ready* (**Collect** — the discrete payoff).
  Collect surfaces loot + any discovery.
- **Discovery moment** — when a roll fires, a lightweight modal/toast:
  "✨ You discovered a Fernling!" (emoji + name + rarity). The hook; must feel good even though the
  full journal is Plan 3.

**Store wiring** (`gameStore.ts`): new actions `assignCreature`, `startRun`, `collectRun`,
`collectSatchel` — each runs `applyElapsed(Date.now())` first, then the engine fn, then persists —
identical discipline to the existing farm actions. The 1s foreground tick already calls
`applyElapsed`, so satchel fill + run-readiness update live.

**Friends tab (Plan 3)** stays a placeholder; `discovered` is now populated, so Plan 3 is
pure read-only UI later.

---

## 6. Testing (pure engine, injected clock + RNG)

- **Forage:** rate scales with rarity/level; `accrueSatchel` respects the combined cap; zero/
  negative elapsed is a no-op.
- **Dungeon:** `collectRun` pays only when ready; loot multiplier clamps to `[0.5, 1.5]`; never a
  net loss; creatures freed + XP granted; `startRun` guards reject busy creatures / running dungeon.
- **XP/level:** threshold crossing auto-levels; level raises forage rate + team power.
- **Discovery (deterministic under test):** force a hit (`rng → 0`) → a new species spawns +
  `discovered` grows; force a miss (`rng → 0.99`) → none; "all discovered → no-op".
- **Migration:** a Plan-1 save loads with wood/acorns=0, empty satchel/dungeons/discovered, the 2
  starter creatures seeded.

---

## 7. Error handling

- **Clock rollback** → existing `elapsed ≥ 0` clamp covers satchel accrual + run-readiness.
- **Corrupt save** → existing fresh-state fallback; migration is additive so old saves never throw.
- **Long absence** → satchel cap absorbs it (like the barn); a ready run just sits until collected.
- **Guards** → can't start a run with busy creatures; can't collect an unready/empty run
  (no-ops, never crashes).

---

## 8. Publish (end of Plan 2 — closes founder-owed handoff items)

After Forest ships and `main` is green:
- Create a **public** repo under the personal `sergideki` account (game is personal, non-Dekimu,
  so personal attribution is correct — the ecosystem "Dekimu-brand-only OSS" rule does not apply).
- **Name:** repo `lakewood-forest`, title **Lakewood Forest**, tagline
  *"Lakewood Forest — a cozy, warm, offline idle game."* Align `app.json` name + in-game title.
- **License:** keep MIT (already at root; clean-room build, no GPL obligations inherited). Closes
  the `founder-license` handoff item.
- Gitignore `.claude/settings.json` (local Expo dev config). Closes the other half of that item.
- Add a short README (what it is, how to run: `npx expo start`; screenshot later).

---

## 8b. Deferred: Plan 2b — sprite art (decided 2026-07-03)

Plan 2 ships on **emoji placeholders** (creature art comes from a single `SPECIES.emoji` field, so
the swap is localized). A follow-on **Plan 2b** replaces them with an **original set of ~10
Gen-4-style (Diamond & Pearl-esque) 64×64 pixel critters**.

**Hard constraint — original art only.** No ripped Pokémon sprites or any Game Freak / TPC assets:
the repo is public under a personal name with an MIT license, and TPC actively DMCAs fan projects.
The *style* (soft chibi pixel front-sprites) is not protected; the specific creatures and ripped
assets are. Plan 2b commissions/generates original critters in that style, matching the 10 species
already named here (Fernling, Pebble Pup, Moss Mouse, Bark Bug, Hedgehush, Cedar Cat, Lumi Fox,
Owlin, Stagheart, Ember Kit).

**Integration (Plan 2b scope):** add a `sprite` field to `Species`, bundle the PNGs under
`assets/creatures/`, and swap `<Text>{emoji}</Text>` → `<Image>` in three spots (CreatureRoster,
DungeonCard team chips, DiscoveryToast). Emoji stay as the fallback. The discovery toast is the
highest-value place for the real reveal.

## 9. Open questions for implementation planning

- Exact starter roster (2 creatures) + the ~8 wild species: names, emoji, rarity/affinity spread.
- The ~3 dungeon definitions: durations, loot bases, recommended power, discovery chances.
- Tuning curve numbers (satchel hours, forage base/mults, XP thresholds, rarity weights) — set for
  a daily-peek rhythm, mirroring the barn's feel.
- Discovery-moment UI: modal vs toast (either is fine; pick in the plan).
