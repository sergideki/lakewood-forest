# Lakewood — v1 Design Spec

*Cozy forest-farm idle game · React Native + Expo · personal project*
Date: 2026-07-02 · Status: **Approved (brainstorm)** → next: implementation plan

---

## 1. One-liner

A chill **offline idle game** where your **family tends a forest farm** and your
**discovered creatures forage & delve gentle dungeons**. Set everyone to work,
close the app, come back to loot. No ads, no gacha, no leaderboards — *actually* slow.

Inspired by **IdleFantasy** (offline idle skilling RPG) and **Isekai: Slow Life**
(cozy idle village-builder), but deliberately trimmed and calm. This is a **fresh,
clean-room build** in React Native — no code is derived from either, so no license
obligations are inherited (IdleFantasy is GPL-3.0; we copy none of it).

## 2. Design pillars

1. **Dual labor.** Two worker types with distinct roles:
   - **Villagers / family** → tend the **farm** (plots, crops, animals — home-base labor).
   - **Creatures / pets** → go to the **forest** to **forage** and delve **chill dungeons**
     (expedition labor: brings back materials, rare seeds, and *new creatures to discover*).
2. **Capped storage.** A **barn** (farm yield) and a **forage satchel** (expeditions) fill to a
   cap while you're away — never lose progress, never trivial. Dungeons are discrete timed runs.
3. **Discovery.** Creatures are *found* in the wild (expeditions + farm milestones), each with a
   task-affinity and a rarity tier. The "ooh, a new one!" pull. A little **Friends** journal.
4. **Genuinely calm.** The anti-*Isekai*: no spend pressure, no FOMO, no P2W. The one lesson we
   keep from it — **2–3 gentle upgrade tracks** so the loop never flattens after day one.

## 3. Core loop

```
plant crops + assign villagers to the farm
      → assign creatures to forage / dungeon runs
            → close app  (barn + satchel fill; dungeon timers run)
                  → return, collect barn + satchel + dungeon results
                        → sell / spend → expand farm, discover creatures, upgrade
                              ↺ repeat
```

## 4. Systems (v1 scope)

| System | v1 definition |
|---|---|
| **Resources** | 3 only: 🪙 Gold · 🪵 Wood · 🌰 Acorns (materials) |
| **Farm** | Grid of plots · ~6 crops on real-time growth · villagers auto-harvest into the **barn** |
| **Villagers** | ~4 family members · assign to farm jobs · light levels (harvest speed / yield) |
| **Creatures** | ~10 discoverable · light traits: **affinity** (forage vs dungeon) + **rarity** · light levels |
| **Forest** | **Forage** = steady capped materials → satchel · **~3 Dungeons** = timed run → loot + chance of a new creature / rare seed |
| **Upgrades** | 3 gentle tracks: **farm expansion** · **creature roster/levels** · **town shop** (raises caps & rates) |
| **UI** | Dashboard cards (warm theme) · bottom tabs: 🏡 Home · 🌲 Forest · 🐿️ Friends · 🏪 Town |

### Explicitly OUT of v1 (see §8 for the roadmap)
Living farm scene (animated), creature breeding/hatching, quests, guilds, prayer/church,
multiple biomes, rich animation, **the lake**, and **monetization (never)**.

## 5. Tech / architecture

- **Expo (managed) + TypeScript.** EAS Build → signed **APK**
  (`eas build -p android --profile preview`).
- **State:** a single serializable `GameState` in **Zustand + persist** → AsyncStorage.
  Autosave on change and on app-background.
- **Idle engine = pure functions.** On foreground (`AppState` listener), compute
  `elapsed = now − meta.lastSeen`, apply per active job, **clamp to caps**. No background
  execution needed — the entire game is **on-open catch-up**.
  - Guard clock rollback: `elapsed = max(0, elapsed)`.
  - Huge gaps (days/weeks) are absorbed naturally by the storage caps.
- **Fully offline, single-player, local save.** Bonus: JSON **export/import** for backup.
- **Navigation:** `expo-router` bottom tabs.

### Data model (sketch)

```ts
type GameState = {
  resources: { gold: number; wood: number; acorns: number };
  plots: { id: string; crop: CropId | null; plantedAt: number; stage: number }[];
  villagers: { id: string; name: string; assignedTo: string | null; level: number }[];
  creatures: {
    id: string; species: SpeciesId; rarity: Rarity; affinity: 'forage' | 'dungeon';
    level: number;
    assignment: { type: 'forage' | 'dungeon' | 'idle'; target: string | null; startedAt: number };
  }[];
  storage: { barn: { amount: number; cap: number }; satchel: { amount: number; cap: number } };
  dungeons: { id: string; activeRun: { creatureIds: string[]; startedAt: number; duration: number } | null }[];
  discovered: SpeciesId[];          // Set persisted as array
  meta: { lastSeen: number; version: number };
};
```

### Idle math (the risky, must-test part)

- **Forage assignment:** `accrued = clamp(((now − lastSeen) / hour) * ratePerHour, 0, cap − current)`.
- **Farm plot:** advance growth by elapsed; assigned villager fills the barn on the same
  capped model.
- **Dungeon run:** discrete. Completes at `startedAt + duration`. On open, if
  `elapsed ≥ duration`, roll rewards (loot + weighted chance of a new creature / rare seed).

### Error handling

- Clock rollback → clamp `elapsed ≥ 0`.
- Corrupt save → keep last-good backup; migrate by `meta.version`.
- Over-long absence → caps handle it; nothing overflows.

## 6. Testing

The idle engine is **pure** (`(state, elapsed) → newState`) with an **injected clock** —
unit-tested with fake time. Highest-value tests, exactly at the risky spot (offline accrual
+ caps). State reducers unit-tested. UI stays light. TDD-friendly core.

## 7. How v1 delivers the four goals

| Goal | How |
|---|---|
| **Better UX / polish** | Warm cohesive theme · clear "collect" moments · zero ads/gacha/FOMO |
| **Simpler, tighter loop** | 3 resources · one farm · focused dual-labor loop |
| **Personal theme** | Cozy forest-farm-family-creatures world |
| **Deeper / novel mechanics** | **Villager-vs-creature dual-labor split** · discovery-driven creatures · capped cozy storage · no P2W |

## 8. Future ideas (post-v1, not scoped)

- **🌊 The Lake.** Founder's request. Adds **fishing** 🎣, **water creatures**, and lakeside/pond
  **habitats that attract specific creatures** — which is the natural home for the parked
  **"attract creatures via farm choices"** mechanic. Likely the first post-v1 expansion.
- **Living farm scene** (animated layout "A") grafted over the dashboard once systems are proven.
- **Creature breeding / hatching** — deep long-tail collection meta.
- Quests / seasonal cozy events (no leaderboards, no FOMO), multiple biomes, weather.

## 9. Open questions for implementation planning

- Exact crop set (~6) and their grow-times / yields.
- Villager & creature starting rosters and unlock triggers.
- Upgrade curve numbers (caps, rates) — tune for a "daily peek" rhythm.
- Visual theme specifics (palette, fonts) — a design pass before UI build.
