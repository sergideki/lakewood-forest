# Lakewood — Plan 3: Friends Journal — Design

**Date:** 2026-07-03
**Status:** Approved (design + subagent-driven execution)
**Depends on:** Plan 2 (Forest) — `state.discovered` is now populated. Plan 2b (sprites) — `CreatureIcon` + registry live.

## Goal

Fill the placeholder Friends tab with a read-only creature journal (a "Pokédex"): show every SPECIES in the catalog. Discovered species are revealed (sprite, name, rarity, affinity); undiscovered ones show as locked/silhouette. **Pure read over `state.discovered` — no engine change, no new engine tests.**

## Non-goals (YAGNI)

- No per-creature data (owned count, levels, XP) — this is a species catalog, not the party roster. That already lives in `CreatureRoster` on the Forest screen.
- No filtering/sorting controls.
- No engine, store, or persistence changes.
- No leaking undiscovered species' rarity/affinity — preserves the discovery surprise.

## Data model (existing, unchanged)

- `SPECIES: Record<SpeciesId, Species>` in `src/engine/content.ts` — 10 species, defined in common→uncommon→rare order.
- `Species = { id, name, emoji, rarity, affinity }` (`affinity: 'wood' | 'acorn'`).
- `state.discovered: SpeciesId[]` — populated by `rollDiscovery` during dungeon runs; seeded with `STARTER_SPECIES` (`fernling`, `pebblepup`).

## Architecture

### 1. Shared rarity color — `src/ui/rarity.ts` (new)

Extract the `RARITY_COLOR` map currently local to `CreatureRoster` into a shared module so the journal and the roster share one source (avoids drift now that there are two consumers).

```ts
import type { Rarity } from '../engine/types';

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb6a4',
  uncommon: '#7fc8ff',
  rare: '#e6b3ff',
};
```

`CreatureRoster.tsx` updated to import it and drop its local copy.

### 2. `src/ui/components/FriendsJournal.tsx` (new)

Renders the whole journal.

- Subscribe to the **stable** slice: `const discovered = useGameStore((s) => s.state.discovered);`
  - **zustand v5 trap:** never return a freshly-built array/object from the selector. `discovered` is a stable reference; membership is computed in the render body via `discovered.includes(sp.id)`.
- `const species = Object.values(SPECIES);` in the render body.
- Header card (reuse `cards.card` / `cards.title` / `cards.sub`): `🐿️ Friends` title + sub `` `${discovered.length} / ${species.length} discovered` ``.
- Grid: `flexDirection: 'row'`, `flexWrap: 'wrap'`, two columns. Each card ~48% width with a small gap.

**Discovered card:**
- `CreatureIcon` (`speciesId`, `emoji`, `size={48}`) — sprite when registered, emoji fallback.
- Name (`theme.text`, weight 600).
- `• {rarity}` colored via `RARITY_COLOR[rarity]`.
- Affinity line: `🪵 wood` or `🌰 acorn` (matches `CreatureRoster` convention: wood → 🪵, acorn → 🌰).

**Undiscovered card:**
- Dimmed (`opacity: 0.5`), distinct muted background/border.
- `❔` glyph at ~48px in place of the sprite (no `CreatureIcon` — we must not reveal the sprite).
- Name `???`.
- **No rarity, no affinity.**

### 3. `app/friends.tsx` (rewrite)

Replace the `ComingSoon` placeholder:

```tsx
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/ui/theme';
import { ResourceBar } from '../src/ui/components/ResourceBar';
import { FriendsJournal } from '../src/ui/components/FriendsJournal';

export default function Friends() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ResourceBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <FriendsJournal />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: theme.bg } });
```

- Includes `ResourceBar` for visual consistency with the Forest/Home screens (top bar is the app's standard chrome).
- **No `tick` loop** — the journal is read-only; `discovered` mutates only on the Forest screen, and zustand re-renders this screen when it changes.

## Data flow

`state.discovered` (store) → `FriendsJournal` selector (stable slice) → render body maps `Object.values(SPECIES)`, splitting on `discovered.includes(id)` → discovered/locked card variants.

One-directional, read-only. No writes, no actions dispatched.

## Error handling

- Empty/partial `discovered` is the normal early-game state (2 starters) — the locked variant IS the handling; nothing to guard.
- `CreatureIcon` already handles missing sprite (emoji fallback), so a species with no registered PNG still renders.

## Testing / verification

- **No new vitest tests** — zero engine/store/persistence change; the render layer has no component-test harness (consistent with Plans 1/2/2b).
- `npx tsc --noEmit` must be clean.
- **Live browser QA drive is mandatory** (the handoff's hard-won lesson — two static reviews missed the zustand v5 selector crash last session; only a real mount caught it):
  1. `npx expo start --web --port <free>` (no `CI=1`).
  2. Open `/friends`: screen mounts, no "getSnapshot should be cached" crash, no console errors.
  3. Counter shows `2 / 10 discovered` on a fresh save; the 2 starters (Fernling, Pebble Pup) render revealed with sprites; the other 8 render locked (`❔` + `???`, no rarity/affinity).
  4. (Optional) Discover a species on `/forest` (temporarily bump a dungeon's `baseDiscoveryChance` + drop `durationSec` in `content.ts`, then `git checkout`), return to `/friends`, confirm the counter increments and the newly-discovered card flips from locked → revealed.

## Files touched

- `app/friends.tsx` — rewrite (placeholder → real screen).
- `src/ui/components/FriendsJournal.tsx` — new.
- `src/ui/rarity.ts` — new (extracted shared `RARITY_COLOR`).
- `src/ui/components/CreatureRoster.tsx` — import shared `RARITY_COLOR`, drop local copy.
