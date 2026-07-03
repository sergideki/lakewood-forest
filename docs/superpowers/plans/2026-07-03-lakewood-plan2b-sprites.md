# Plan 2b — Creature Sprites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace emoji creature placeholders with a fallback-safe sprite system, so original 64×64 PNGs render as they land while the app stays green with zero art present.

**Architecture:** A UI-layer registry (`src/ui/sprites.ts`) maps `SpeciesId → require('<png>')`, starting empty. A single `CreatureIcon` component renders `<Image>` when a sprite exists and falls back to the creature's emoji otherwise. Three existing emoji render sites swap to `CreatureIcon`. The pure engine (`src/engine/`) is untouched, so its 62 vitest tests hold and the node test env never sees a Metro asset.

**Tech Stack:** React Native + Expo, TypeScript, zustand v5 store, vitest (engine only). Design spec: `docs/superpowers/specs/2026-07-03-lakewood-plan2b-sprites-design.md`.

**Testing reality (read before starting):** There is **no component-test harness** in this repo — only pure-engine vitest tests. Per the spec, the guards for this plan are (1) `npx tsc --noEmit` clean and (2) a **mandatory live browser mount** of all three screens. This session's own history: two static reviews missed a zustand mount crash that only a real mount caught. Do not skip the mount step.

**Branch:** `feat/plan2b-sprites` off `origin/main`. Merge to `main` when green; push to the public repo.

---

## Pre-flight

- [ ] **Step 1: Branch off up-to-date main**

```bash
cd ~/Documents/lakewood
git fetch origin
git switch -c feat/plan2b-sprites origin/main
```

- [ ] **Step 2: Confirm the baseline is green**

Run: `npx tsc --noEmit && npm test`
Expected: tsc silent (exit 0); vitest `Tests 62 passed (62)`.

---

## Task 1: Sprite registry

**Files:**
- Create: `src/ui/sprites.ts`

- [ ] **Step 1: Create the empty registry**

Create `src/ui/sprites.ts` exactly:

```ts
import type { ImageSourcePropType } from 'react-native';
import type { SpeciesId } from '../engine/types';

/**
 * Creature sprite registry. One line per landed PNG; a species absent here
 * renders its emoji fallback (see CreatureIcon).
 *
 * IMPORTANT: every entry must point at a file that EXISTS. Metro resolves
 * require() at bundle time, so a require() of a missing asset breaks the build.
 * Keep pending species commented out until their PNG is in assets/creatures/.
 *
 * Filename convention: assets/creatures/<speciesId>.png (e.g. fernling.png).
 */
export const CREATURE_SPRITES: Partial<Record<SpeciesId, ImageSourcePropType>> = {
  // fernling: require('../../assets/creatures/fernling.png'),
  // pebblepup: require('../../assets/creatures/pebblepup.png'),
  // mossmouse: require('../../assets/creatures/mossmouse.png'),
  // barkbug: require('../../assets/creatures/barkbug.png'),
  // hedgehush: require('../../assets/creatures/hedgehush.png'),
  // cedarcat: require('../../assets/creatures/cedarcat.png'),
  // lumifox: require('../../assets/creatures/lumifox.png'),
  // owlin: require('../../assets/creatures/owlin.png'),
  // stagheart: require('../../assets/creatures/stagheart.png'),
  // emberkit: require('../../assets/creatures/emberkit.png'),
};
```

The commented lines double as a checklist for the founder: uncomment the one whose PNG has landed. `Partial<Record<SpeciesId, …>>` makes a typo key (e.g. `fernlng`) a tsc error.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no output. (Registry is empty, so no `require` of a missing file yet.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/sprites.ts
git commit -m "feat(sprites): add empty creature sprite registry (UI layer, emoji fallback)

regression check: grep -rn require\(.*assets/creatures src/ui/sprites.ts  # all commented until PNGs land"
```

---

## Task 2: CreatureIcon component

**Files:**
- Create: `src/ui/components/CreatureIcon.tsx`

- [ ] **Step 1: Create the component**

Create `src/ui/components/CreatureIcon.tsx` exactly:

```tsx
import { Image, Text } from 'react-native';
import type { SpeciesId } from '../../engine/types';
import { CREATURE_SPRITES } from '../sprites';

type Props = {
  speciesId: SpeciesId;
  emoji: string;
  size: number;
};

/**
 * Single render path for a creature's face. Renders the sprite PNG when one is
 * registered for this species; otherwise falls back to the emoji at the same size.
 */
export function CreatureIcon({ speciesId, emoji, size }: Props) {
  const sprite = CREATURE_SPRITES[speciesId];
  if (sprite) {
    return <Image source={sprite} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/CreatureIcon.tsx
git commit -m "feat(sprites): CreatureIcon — Image when registered, emoji fallback

regression check: npx tsc --noEmit"
```

---

## Task 3: Swap CreatureRoster

**Files:**
- Modify: `src/ui/components/CreatureRoster.tsx` (the `<Text style={styles.emoji}>{c.emoji}</Text>` row, ~line 34; and remove the now-unused `emoji` style at ~line 53)

- [ ] **Step 1: Import CreatureIcon**

At the top of `src/ui/components/CreatureRoster.tsx`, add to the existing imports:

```tsx
import { CreatureIcon } from './CreatureIcon';
```

- [ ] **Step 2: Replace the emoji Text with CreatureIcon**

Find:

```tsx
            <Text style={styles.emoji}>{c.emoji}</Text>
```

Replace with:

```tsx
            <CreatureIcon speciesId={c.species} emoji={c.emoji} size={24} />
```

`c` is a `Creature`, which has both `species: SpeciesId` and `emoji: string`.

- [ ] **Step 3: Remove the now-dead `emoji` style**

In the `StyleSheet.create({ ... })` block, delete the line:

```tsx
  emoji: { fontSize: 24 },
```

(It has no other referents in this file. Leaving it triggers no error but is dead code.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (If it flags `styles.emoji` unused elsewhere, confirm no other reference remains — there is none.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/CreatureRoster.tsx
git commit -m "feat(sprites): CreatureRoster uses CreatureIcon

regression check: npx tsc --noEmit"
```

---

## Task 4: Swap DiscoveryToast

**Files:**
- Modify: `src/ui/components/DiscoveryToast.tsx` (the `<Text style={styles.emoji}>{sp.emoji}</Text>`, ~line 16; and the `emoji: { fontSize: 56, ... }` style ~line 31)

- [ ] **Step 1: Import CreatureIcon**

At the top of `src/ui/components/DiscoveryToast.tsx`, add:

```tsx
import { CreatureIcon } from './CreatureIcon';
```

- [ ] **Step 2: Replace the emoji Text**

Find:

```tsx
        <Text style={styles.emoji}>{sp.emoji}</Text>
```

Replace with:

```tsx
        <CreatureIcon speciesId={sp.id} emoji={sp.emoji} size={56} />
```

`sp` is a `Species`, which has `id: SpeciesId` and `emoji: string`. This is the hero reveal — 56px matches the old emoji size.

- [ ] **Step 3: Handle the dead style**

The old `emoji` style carried layout (`marginVertical: 8`) as well as `fontSize`. To preserve spacing, wrap the icon so it keeps the margin. Change the replacement from Step 2 to:

```tsx
        <View style={styles.iconWrap}>
          <CreatureIcon speciesId={sp.id} emoji={sp.emoji} size={56} />
        </View>
```

Then in the StyleSheet, replace:

```tsx
  emoji: { fontSize: 56, marginVertical: 8 },
```

with:

```tsx
  iconWrap: { marginVertical: 8 },
```

Confirm `View` is imported from `react-native` at the top of the file (it is used elsewhere in this component; if not, add it to the import).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/DiscoveryToast.tsx
git commit -m "feat(sprites): DiscoveryToast hero reveal uses CreatureIcon

regression check: npx tsc --noEmit"
```

---

## Task 5: Swap DungeonCard team chip

**Files:**
- Modify: `src/ui/components/DungeonCard.tsx` (the team-chip `<Text style={styles.chipText}>{c.emoji} {c.name}</Text>`, ~line 58)

- [ ] **Step 1: Import CreatureIcon**

At the top of `src/ui/components/DungeonCard.tsx`, add:

```tsx
import { CreatureIcon } from './CreatureIcon';
```

- [ ] **Step 2: Replace the inline emoji in the chip**

Find:

```tsx
                  <Text style={styles.chipText}>{c.emoji} {c.name}</Text>
```

Replace with:

```tsx
                  <CreatureIcon speciesId={c.species} emoji={c.emoji} size={16} />
                  <Text style={styles.chipText}>{c.name}</Text>
```

The parent is `<Pressable style={[styles.chip, on && styles.chipOn]}>` — now it has two children (icon + text) instead of one, so `styles.chip` needs row layout.

- [ ] **Step 3: Give the chip row layout**

Find `styles.chip` (currently):

```tsx
  chip: { backgroundColor: '#26332a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'transparent' },
```

Replace with:

```tsx
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#26332a', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'transparent' },
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/DungeonCard.tsx
git commit -m "feat(sprites): DungeonCard team chips use CreatureIcon

regression check: npx tsc --noEmit"
```

---

## Task 6: Verify — engine tests + live mount

**Files:** none (verification only)

- [ ] **Step 1: Engine tests still green**

Run: `npm test`
Expected: `Tests 62 passed (62)` — unchanged, because no engine file was touched.

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Live mount with EMPTY registry (emoji fallback path)**

Start the web dev server on a free port (do NOT set `CI=1` — it disables reload and serves a stale bundle):

```bash
npx expo start --web --port 8083
```

Then drive it (via the `browse` skill or a real browser):
- App mounts with no "getSnapshot should be cached" crash.
- **Creatures card** — each creature row shows its emoji (fallback path working).
- **Dungeon card** — assign a creature to a team; the chip shows emoji + name in a row.
- **Discovery toast** — trigger a discovery (QA tip below) and confirm the 56px emoji reveal renders with its margin intact.

QA tip to force a discovery without waiting 15 min: temporarily drop a dungeon's `durationSec` and bump `baseDiscoveryChance` in `src/engine/content.ts`, run it, then `git checkout src/engine/content.ts` to revert.

- [ ] **Step 4: Live mount with ONE real sprite (Image path)**

Create a throwaway placeholder PNG and wire it, to prove the `<Image>` branch renders at the right size:

```bash
# any small PNG works as a smoke placeholder; e.g. copy an existing asset
mkdir -p assets/creatures
cp assets/icon.png assets/creatures/fernling.png   # or any PNG on hand
```

Uncomment the `fernling` line in `src/ui/sprites.ts`, reload the browser, and confirm the Fernling row (and its discovery toast, if you can trigger it) shows the image instead of the 🌱 emoji, at the correct size.

Then **revert the smoke wiring** (do not ship a placeholder as a real sprite):

```bash
git checkout src/ui/sprites.ts
rm assets/creatures/fernling.png
```

Expected end state: `src/ui/sprites.ts` back to all-commented, no PNG in `assets/creatures/`.

- [ ] **Step 5: Confirm clean tree**

Run: `git status`
Expected: no stray `assets/creatures/*.png`, `sprites.ts` unmodified from its committed (empty) state, `content.ts` unmodified.

---

## Task 7: Merge + close out

**Files:**
- Modify: `HANDOFF.md` (check `id:plan2b-sprites`, note art half is founder-owed)

- [ ] **Step 1: Merge to main**

```bash
git switch main
git merge --no-ff feat/plan2b-sprites -m "Merge Plan 2b: creature sprite system (emoji fallback, prompt kit ready)"
```

- [ ] **Step 2: Push to the public repo**

```bash
git push origin main
```

- [ ] **Step 3: Update HANDOFF.md**

In the LIVE block, change the `id:plan2b-sprites` line from `- [ ]`/`gate:not-started` to reflect: **code shipped, art half founder-owed**. Add a founder-owed LIVE item:

```
- [ ] id:plan2b-art | Plan 2b — generate + drop 10 creature PNGs | owner:founder | gate:owed | note: prompt kit in spec §6. Gen at 64×64, transparent bg, name each <speciesId>.png, drop in assets/creatures/, uncomment its line in src/ui/sprites.ts. Renders on reload.
```

- [ ] **Step 4: Commit the handoff update**

```bash
git add HANDOFF.md
git commit -m "docs(handoff): Plan 2b sprite code shipped; art generation founder-owed

regression check: n/a (docs only)"
git push origin main
```

- [ ] **Step 5: Clean up the branch**

```bash
git branch -d feat/plan2b-sprites
```

---

## Done when

- `src/ui/sprites.ts` (empty) + `src/ui/components/CreatureIcon.tsx` exist on `main`.
- All three sites (`CreatureRoster`, `DiscoveryToast`, `DungeonCard`) render via `CreatureIcon`.
- `npx tsc --noEmit` clean; `npm test` → 62/62.
- Live mount verified both branches: emoji fallback (empty registry) AND image (one smoke PNG, then reverted).
- `HANDOFF.md` marks code done, art founder-owed with the prompt kit pointer.
- No placeholder PNG or uncommented registry line shipped.
