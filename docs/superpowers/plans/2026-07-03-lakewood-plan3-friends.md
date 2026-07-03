# Plan 3: Friends Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Friends tab with a read-only creature journal that shows every species — discovered ones revealed (sprite, name, rarity, affinity), undiscovered ones locked.

**Architecture:** Pure read over `state.discovered`. One new presentational component (`FriendsJournal`) subscribing to the stable `discovered` slice; the screen (`app/friends.tsx`) wraps it in the standard `SafeAreaView` + `ResourceBar` + `ScrollView` chrome. A small shared `RARITY_COLOR` module removes a duplicate. No engine, store, or persistence change.

**Tech Stack:** React Native + Expo (expo-router), zustand v5, TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-03-lakewood-plan3-friends-design.md`

**Testing note:** The render layer has no component-test harness (consistent with Plans 1/2/2b), and this plan touches zero engine/store code, so there are **no vitest tests**. Every task verifies with `npx tsc --noEmit`; the final task is a mandatory live browser QA drive — the handoff's hard-won lesson that only a real mount catches the zustand v5 selector crash.

**Branch:** Work on `feat/plan3-friends` off `main`.

---

### Task 0: Branch

- [ ] **Step 1: Create the feature branch**

```bash
cd /home/deki/Documents/lakewood
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b feat/plan3-friends
```

- [ ] **Step 2: Confirm green baseline**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; vitest 62/62 pass.

---

### Task 1: Extract shared `RARITY_COLOR`

Removes the duplicate that would otherwise exist once `FriendsJournal` also needs rarity colors.

**Files:**
- Create: `src/ui/rarity.ts`
- Modify: `src/ui/components/CreatureRoster.tsx`

- [ ] **Step 1: Create the shared module**

Create `src/ui/rarity.ts`:

```ts
import type { Rarity } from '../engine/types';

/** Single source of rarity → accent color, shared by roster + journal. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb6a4',
  uncommon: '#7fc8ff',
  rare: '#e6b3ff',
};
```

- [ ] **Step 2: Point `CreatureRoster` at it**

In `src/ui/components/CreatureRoster.tsx`:

Remove the local declaration:
```ts
const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb6a4',
  uncommon: '#7fc8ff',
  rare: '#e6b3ff',
};
```

Add an import alongside the existing imports (near the `CreatureIcon` import):
```ts
import { RARITY_COLOR } from '../rarity';
```

Leave everything else in the file unchanged. (`import type { Rarity }` stays — it is still used by the file's other type annotations. If tsc reports `Rarity` as now-unused after the edit, drop it from the import; verify in Step 3.)

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: clean (no errors, no unused-symbol complaint).

- [ ] **Step 4: Commit**

```bash
git add src/ui/rarity.ts src/ui/components/CreatureRoster.tsx
git commit -m "refactor(ui): extract shared RARITY_COLOR to src/ui/rarity.ts

regression check: grep -rn RARITY_COLOR src/ui  (one definition, two importers)"
```

---

### Task 2: `FriendsJournal` component

**Files:**
- Create: `src/ui/components/FriendsJournal.tsx`

- [ ] **Step 1: Write the component**

Create `src/ui/components/FriendsJournal.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { RARITY_COLOR } from '../rarity';
import { useGameStore } from '../../store/gameStore';
import { SPECIES } from '../../engine';
import { CreatureIcon } from './CreatureIcon';

const AFFINITY_EMOJI = { wood: '🪵', acorn: '🌰' } as const;

export function FriendsJournal() {
  // Subscribe to the STABLE slice only. zustand v5 (useSyncExternalStore) crashes
  // on mount ("getSnapshot should be cached") if a selector returns a freshly
  // built array/object — so never .filter/.map inside the selector.
  const discovered = useGameStore((s) => s.state.discovered);
  const species = Object.values(SPECIES);

  return (
    <View>
      <View style={cards.card}>
        <Text style={cards.title}>🐿️ Friends</Text>
        <Text style={cards.sub}>{discovered.length} / {species.length} discovered</Text>
      </View>

      <View style={styles.grid}>
        {species.map((sp) => {
          const known = discovered.includes(sp.id);
          if (!known) {
            return (
              <View key={sp.id} style={[styles.cell, styles.cellLocked]}>
                <Text style={styles.lockGlyph}>❔</Text>
                <Text style={styles.name}>???</Text>
              </View>
            );
          }
          return (
            <View key={sp.id} style={styles.cell}>
              <CreatureIcon speciesId={sp.id} emoji={sp.emoji} size={48} />
              <Text style={styles.name}>{sp.name}</Text>
              <Text style={[styles.rarity, { color: RARITY_COLOR[sp.rarity] }]}>• {sp.rarity}</Text>
              <Text style={styles.affinity}>{AFFINITY_EMOJI[sp.affinity]} {sp.affinity}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  // width:'48%' + space-between → two cells per row with a ~4% center gutter,
  // no px margins to overflow. Rows separated by marginBottom.
  cell: {
    width: '48%',
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: 12,
    marginBottom: theme.gap,
    alignItems: 'center',
    gap: 4,
  },
  cellLocked: {
    opacity: 0.5,
    borderStyle: 'dashed',
  },
  lockGlyph: { fontSize: 48, lineHeight: 56 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600', marginTop: 4 },
  rarity: { fontSize: 12, fontWeight: '600' },
  affinity: { color: theme.textDim, fontSize: 12 },
});
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: clean. (`SPECIES`, `CreatureIcon`, `RARITY_COLOR`, `theme`, `cards` all resolve; `sp.affinity` is `'wood' | 'acorn'`, keys of `AFFINITY_EMOJI`.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/FriendsJournal.tsx
git commit -m "feat(friends): FriendsJournal — read-only species catalog grid

Discovered species reveal sprite/name/rarity/affinity; undiscovered render
locked (❔ + ???). Subscribes to stable state.discovered slice (zustand v5 safe).

regression check: npx tsc --noEmit"
```

---

### Task 3: Wire the Friends screen

**Files:**
- Modify: `app/friends.tsx` (full rewrite — replaces the `ComingSoon` placeholder)

- [ ] **Step 1: Rewrite the screen**

Replace the entire contents of `app/friends.tsx` with:

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
```

No `tick` loop: the journal is read-only; `discovered` mutates only on the Forest screen and zustand re-renders this screen when it changes.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: clean. `ComingSoon` may now be imported by no screen — that is fine (it is a reusable component, not dead code; other placeholders like Town still use it).

- [ ] **Step 3: Commit**

```bash
git add app/friends.tsx
git commit -m "feat(friends): mount FriendsJournal on the Friends tab, drop placeholder

regression check: npx tsc --noEmit; /friends renders journal not ComingSoon"
```

---

### Task 4: Live QA drive (mandatory)

No component tests exist, so this is the real verification. Only a live mount catches the zustand v5 selector crash (two static reviews missed it last session).

**Files:** none (verification only).

- [ ] **Step 1: Full type + engine check**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; vitest 62/62 (engine untouched — must be unchanged).

- [ ] **Step 2: Start the dev server**

Run: `npx expo start --web --port 8087` (pick any free port; do NOT pass `CI=1` — it serves a stale bundle).
Wait for "Web is waiting on http://localhost:8087".

- [ ] **Step 3: Drive `/friends` in the browser**

Use the `browse` skill (or the founder's browser). Navigate to `http://localhost:8087/friends`.

Verify:
- Screen mounts — **no red-box crash, no "getSnapshot should be cached" console error, no other console errors.**
- Header reads `2 / 10 discovered` on a fresh save.
- The 2 starters — **Fernling** and **Pebble Pup** — render revealed: sprite (or emoji fallback), name, `• common`, affinity line.
- The other 8 species render locked: `❔` glyph, `???`, and **no rarity/affinity text**.
- Two-column grid; cards align; nothing overflows horizontally.

Capture a screenshot as evidence.

- [ ] **Step 4: (Optional) Verify a fresh discovery flips a card**

To exercise locked → revealed without waiting: in `src/engine/content.ts` temporarily set one dungeon's `durationSec` low (e.g. `3`) and `baseDiscoveryChance` high (e.g. `1`). On `/forest`, send a creature into that dungeon, wait, Collect until a discovery toast fires. Return to `/friends`: the counter increments and that species' card is now revealed. Then:

```bash
git checkout src/engine/content.ts
```

Confirm `git status` is clean of `content.ts` before finishing.

- [ ] **Step 5: Stop the dev server**

Stop the `expo start` process.

---

### Task 5: Merge + handoff

- [ ] **Step 1: Final green gate**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; 62/62.

- [ ] **Step 2: Merge to main**

```bash
git checkout main
git merge --no-ff feat/plan3-friends -m "Plan 3 — Friends journal (read-only species catalog)"
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Clean up the branch**

```bash
git branch -d feat/plan3-friends
```

- [ ] **Step 5: Update HANDOFF.md**

In `HANDOFF.md`, flip the `plan3-friends` LIVE item to `[x] ... SHIPPED`, add a one-line note (files touched + live-verified), and move any stale prose per convention.
```
