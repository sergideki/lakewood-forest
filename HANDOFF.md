# Lakewood — Handoff

Personal cozy forest-farm idle game. React Native + Expo. Solo project, own repo at `~/Documents/lakewood` (NOT part of the Dekimu monorepo).

**Read first:** `docs/superpowers/specs/2026-07-02-lakewood-cozy-idle-design.md` (design) · `docs/superpowers/plans/2026-07-02-lakewood-v1-slice.md` (Plan 1).

<!-- LIVE:BEGIN -->
- [x] id:plan1-slice | Plan 1 farm-loop vertical slice — SHIPPED, merged to main, simplified, retuned | branch:merged | owner:claude | gate:done | note: pure idle engine (23 tests) + Zustand store + Home screen + tabs + EAS profile. Verified live on web. Barn now holds 24h of production (BARN_HOURS in src/engine/farm.ts), not fixed 500.
- [ ] id:plan2-forest | Plan 2 — Forest & creatures (foraging + satchel cap + chill dungeons + discover-in-the-wild creatures; wood/acorns return here) | branch: | pr: | owner:claude | gate:not-started | note: NEXT. Write spec-delta + plan via writing-plans, then subagent-driven. Forest tab is currently a placeholder.
- [ ] id:plan3-friends | Plan 3 — Friends journal (creature roster + discovery) | owner:claude | gate:blocked-on-plan2 | note: placeholder tab exists.
- [ ] id:plan4-town | Plan 4 — Town shop & upgrades (raise caps/rates, farm expansion) | owner:claude | gate:blocked-on-plan2 | note: placeholder tab exists. This is where Isekai's "keep 2-3 upgrade tracks" lesson lands.
- [ ] id:lake | The lake 🎣 — fishing + water creatures + attract-creatures-via-habitats | owner:claude | gate:future | note: founder's request; parked in spec §8. Likely first post-v1 expansion after Forest.
- [ ] id:founder-run | Run on real phone: `npx expo start` → Expo Go, scan QR | owner:founder | gate:owed | note: web build verified; on-device not yet.
- [ ] id:founder-apk | Build APK: `eas login` → `eas build:configure` → `eas build -p android --profile preview` | owner:founder | gate:owed | note: needs interactive Expo account — the one headless-blocked step. eas.json profile ready.
- [ ] id:founder-license | Decide LICENSE (template MIT sitting at root) + keep-or-drop `.claude/settings.json` (Expo dev plugin) | owner:founder | gate:owed | note: clean-room build, so licensing is unconstrained.
<!-- LIVE:END -->

## State (as of 2026-07-02)

- **main** is green: `npx tsc --noEmit` clean, `npm test` → 23/23. Latest commit `16796d8` (barn 24h retune).
- Full loop works and was driven live in a browser: plant crops → assign family → barn fills on real wall-clock → Collect banks gold → offline catch-up → placeholder tabs.
- Engine is pure/RN-free in `src/engine/` (tested with vitest). Store in `src/store/gameStore.ts` persists on background + actions (not every tick). UI = dashboard cards (layout B); animated "living farm scene" (layout A) is a deliberate later graft.
- v1 is gold-only; wood/acorns were removed until the Forest gives them a source (Plan 2). Villager levels + a second "version" field also removed as dead weight.

## Gotchas

- Web needs `expo-linking` + `expo-constants` (expo-router peers) — installed; `.npmrc` has `legacy-peer-deps=true` so peers don't auto-install, watch for missing-peer bundle 500s.
- Dev server for localhost: `npx expo start --web --port 8081` (background one dies at session end).
- Commit-msg hook (inherited) wants a `regression check:` line in the body.
