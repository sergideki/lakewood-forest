# Lakewood — Plan 7 Cozy Loops · Live QA

Date: 2026-07-05 · Surface: web (`expo start --web`, localhost:8082) · Build: main @ `cd83a39`
Result: **PASS — all 3 features verified end-to-end, zero console errors.**

Automated gate first: `npx tsc --noEmit` clean · `npx vitest run` → **177/177** (155 baseline + 22 new).
Code review (opus `code-review-agent`): **PASS**, one LOW fixed in-session (empty-card gate).

## How state was injected
AsyncStorage's web backend doesn't read plain `window.localStorage` on load (direct writes are
ignored / the running tick flushes its cache back). The reliable path is the app's own
**Settings → Restore** (`importState`), which persists through the store. Used it to seed
wood 500, fish 30, pets `[pondsnail, pebbleturtle]`, wheat plot, farm villager.

## Feature 1 — While You Were Away  ✅
- Seeded state, left the Home tab idle 70s (storage `lastSeen` aged 33s → 103s, confirming the
  tick loop does NOT persist `lastSeen` — the away gap is real), then reloaded.
- Card rendered: **"🌿 Welcome back! · You were away 1m · 🪙 +5 · 🐟 +5 · [Nice!]"** — gains floored
  (no decimal leak), gold from the wheat plot + fish from the passive rod rate over the gap.
- "Nice!" dismiss cleared the card (does not reappear on that load). Backdrop-dim modal matches the
  game palette. No console errors.
- Corroboration: Barn cap on Home read **4536** (= 4320 × 1.05), i.e. the pondsnail +5% barn bonus
  is applied to the live cap, not just the label.

## Feature 2 — Pet passive bonuses  ✅
- Friends 🐾 Pets section: **2 / 6**, Pond Snail → **"+5% barn"**, Pebble Turtle → **"+8% creel"**.
- Uncaught pets render `??? ❔` with NO bonus/rarity leak (matches the locked-card rule).
- Barn-cap corroboration above confirms the bonus wires through the engine, not just UI copy.

## Feature 3 — Wood→fish Town trade  ✅
- Trading Post card: **"Trading Post · Swap surplus lumber for fresh fish · 20🪵 → 4🐟 · [Trade]"**.
- One trade: resources went **wood 500 → 480 (−20), fish 30 → 34 (+4)** exactly. Resource bar
  showed **🐟 34** (floored, no decimals). Repeatable. No console errors.
- Disabled-when-broke path is covered by unit test `canTradeWoodForFish(wood<20) === false`.

## Regression checks
- `grep SAVE_VERSION src/persistence/save.ts` → `5` (unchanged, no migration — save-safe).
- `npx vitest run test/lib/awayReport.test.ts -t 'sub-1'` (empty-card gate).

## Not covered live (unit-test-backed)
- Trade disabled state (unit test).
- Pond Newt +3% catch bonus surviving the marigold cap (`creelCatchChance` unit test — the F1 fix).
- On-device (Android APK) — founder verify after the next release.
