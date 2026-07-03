# Lakewood — Handoff

Personal cozy forest-farm idle game. React Native + Expo. Solo project, own repo at `~/Documents/lakewood` (NOT part of the Dekimu monorepo).

**Read first:** `docs/superpowers/specs/2026-07-03-lakewood-forest-plan2-design.md` (Forest design) · `docs/superpowers/plans/2026-07-03-lakewood-forest-plan2.md` (Plan 2). Earlier: Plan 1 spec/plan dated 2026-07-02.

**PUBLIC repo:** https://github.com/sergideki/lakewood-forest (MIT, published 2026-07-03).

<!-- LIVE:BEGIN -->
- [x] id:plan1-slice | Plan 1 farm-loop vertical slice — SHIPPED | branch:merged | owner:claude | gate:done | note: pure idle engine + Zustand + Home screen + tabs. Barn holds 24h (BARN_HOURS in src/engine/farm.ts).
- [x] id:plan2-forest | Plan 2 — Forest & creatures — SHIPPED + PUBLISHED | branch:merged | owner:claude | gate:done | note: forage→capped satchel (wood/acorns), no-fail timed dungeons w/ soft power check, rarity-weighted discovery (auto-join), passive XP auto-level. 62 vitest tests, tsc clean. Verified LIVE end-to-end in browser (mount, forage/rest, dungeon run, collect, discovery toast). Merged to main 48e819d; renamed to "Lakewood Forest" + README + MIT.
- [x] id:plan2b-sprites | Plan 2b — creature sprite CODE — SHIPPED | branch:merged | owner:claude | gate:done | note: sprite-swap machinery merged (b9c6177). UI-layer registry `src/ui/sprites.ts` (empty, all-commented) + `CreatureIcon` (Image when registered, emoji fallback) → 3 sites swapped (CreatureRoster 24px / DiscoveryToast 56px / DungeonCard chips 16px). Engine untouched (62/62 hold, tsc clean). Verified LIVE both paths: empty-registry emoji fallback AND a smoke PNG rendering `<Image>`, no console errors. NOTE: deviated from spec §8b — sprites live in UI layer, NOT `Species.sprite` (a require('.png') in the pure engine breaks node tests). Plan: docs/superpowers/plans/2026-07-03-lakewood-plan2b-sprites.md.
- [x] id:plan2b-art | Plan 2b — 10 creature PNGs — SHIPPED | branch:merged | owner:founder | gate:done | note: landed via b0baa9f (parallel `ops@` session) — 10 procedural 64×64 transparent sprites, all registry lines active. Verified LIVE on /forest: sprites render as `<Image>` at 24px + 16px, no console errors. NOTE: these are basic procedural blobs, not the chibi critters from the prompt kit — the §6 prompt kit in docs/superpowers/specs/2026-07-03-lakewood-plan2b-sprites-design.md is still the path if you want richer art (regenerate + overwrite same `<speciesId>.png` names).
- [x] id:plots-crop-picker | Plots — tap-to-open crop picker modal — SHIPPED | branch:merged | owner:claude | gate:done | note: replaced tap-to-cycle (empty→wheat→carrot→berry) with a modal listing every crop (emoji, grow time, gold) + Clear plot, scrollable for 20+ crops. Merged e828bf7. Store already had `plant(plotId, cropId)`; no engine change. Verified LIVE: direct pick, Clear plot, backdrop-dismiss, no console errors. Separate-backdrop pattern avoids react-native-web click-bubble closing the sheet on inner taps.
- [x] id:plan3-friends | Plan 3 — Friends journal — SHIPPED + PUBLISHED | branch:merged | owner:claude | gate:done | note: Pokédex-style read-only grid over state.discovered. New src/ui/components/FriendsJournal.tsx (2-col grid; discovered → CreatureIcon sprite + name + rarity + affinity, undiscovered → dashed/dimmed ❔ + ??? with NO rarity/affinity leak) + shared src/ui/rarity.ts (extracted RARITY_COLOR, CreatureRoster now imports it); app/friends.tsx rewritten (SafeAreaView+ResourceBar+ScrollView, no tick loop — read-only). Engine untouched (62/62 hold, tsc clean). Subscribes to STABLE s.state.discovered slice (avoids the zustand v5 mount crash). Verified LIVE on /friends: 2/10 discovered, both starters revealed with sprite PNGs, 8 locked cards, no console errors, no crash. Merged 6f570ca. Spec/plan: docs/superpowers/{specs,plans}/2026-07-03-lakewood-plan3-friends*.md.
- [ ] id:plan4-town | Plan 4 — Town shop & upgrades (raise caps/rates, farm expansion; also creature-level accelerators) | owner:claude | gate:ready | note: UNBLOCKED. This is where wood/acorn/gold get SINKS (they only bank today) + Isekai's "2-3 upgrade tracks" lesson. Placeholder tab exists.
- [ ] id:lake | The lake 🎣 — fishing + water creatures + attract-via-habitats | owner:claude | gate:future | note: founder's request; parked in spec §8. Likely first expansion after Town.
- [ ] id:founder-run | Run on real phone: `npx expo start` → Expo Go, scan QR | owner:founder | gate:owed | note: web verified end-to-end; on-device not yet.
- [ ] id:founder-apk | Build APK: `eas login` → `eas build:configure` → `eas build -p android --profile preview` | owner:founder | gate:owed | note: needs interactive Expo account — the one headless-blocked step. eas.json profile ready.
<!-- LIVE:END -->

> DONE this session: id:founder-license — MIT chosen + shipped, `.claude/settings.json` untracked + gitignored (closed by the rename commit 4ed887c).

## State (as of 2026-07-03)

- **main** is green: `npx tsc --noEmit` clean, `npm test` → 62/62. Plan 2 merged (48e819d), pushed to the public repo.
- Farm + Forest loops both work, driven live in a browser end-to-end.
- Engine is pure/RN-free in `src/engine/` (`farm`, `creatures`, `forest`, `idle`), tested with vitest. Discovery/loot rolls take an injected `rng` (default Math.random, faked in tests) so the engine stays deterministic. Store `src/store/gameStore.ts` wraps it; `applyElapsed` runs before every mutating action + on a 1s foreground tick.
- SAVE_VERSION is 2; a v1 (farm-only) save migrates additively (`src/persistence/save.ts`).
- Resources: gold/wood/acorns all BANK but have no SINK yet — sinks land in Plan 4 (Town). Creatures level via passive XP now; paid accelerators are Plan 4.
- UI = dashboard cards. Creature art is EMOJI placeholders (Plan 2b swaps in real sprites via the single `Species.emoji`/future `sprite` field).

## Gotchas

- **zustand v5 selector trap (cost us a crash this session):** NEVER return a freshly-built array/object from a `useGameStore(s => ...)` selector (e.g. `s => s.state.creatures.filter(...)`). zustand v5 uses `useSyncExternalStore`; a new reference every render reads as a changed snapshot → infinite loop → "getSnapshot should be cached" → component crashes ON MOUNT. Subscribe to the stable slice (`s => s.state` or `s => s.state.creatures`) and do `.filter`/`.find`/`.map` in the render body. **Two static code reviews missed this; only the live browser mount caught it — always do a real mount/QA drive on new RN screens (no component-test coverage exists).**
- Web needs `expo-linking` + `expo-constants` (expo-router peers) — installed; `.npmrc` has `legacy-peer-deps=true`, watch for missing-peer bundle 500s.
- Dev server: `npx expo start --web --port <free port>` (watch mode). Do NOT pass `CI=1` when you need it to rebuild on file edits — CI mode disables reloads and serves a stale bundle.
- Commit-msg hook (inherited) wants a `regression check:` line in the body.
- QA tip: to exercise the ready→Collect→discovery path without waiting 15 min, temporarily drop a dungeon's `durationSec` (and bump `baseDiscoveryChance`) in `src/engine/content.ts`, then `git checkout` it after — clock can't be fast-forwarded in the browser.
