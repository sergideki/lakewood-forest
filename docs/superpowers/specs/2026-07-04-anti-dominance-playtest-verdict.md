# Anti-dominance playtest — verdict (id:anti-dominance-playtest)

**Date:** 2026-07-04 · **Method:** simulated min-max analysis against the real engine
(rates probed via `farmRatesPerSec`/`forageRatePerSec`/`upgradeCost` in a temp vitest,
then adversarially reviewed by a skeptic pass that corrected two claims).

## Verdict: PASS — no retune. Wheat does not dominate; crop choice rotates by stage and mixes within stages.

## Engine-verified numbers

- Per plot @3 villagers (×1.5): **wheat 270 gold/h · carrot 180 acorns/h · sapling 180 wood/h**.
- One uncommon L5 foraging creature @tools L3: **548 wood-or-acorns/h** (≈3× a plot).
- One-time sinks: **13,344 gold** (upgrades 13,044 + unlocks 250 + koi stones 50),
  **4,577 wood**, 448 acorns. Recurring sinks: **treats only** (25🌰→100 XP, infinite)
  + marigold's fish drain. Gold and wood have **no recurring sink**.

## Stage-by-stage optimum (for a player who values the pet collection — the game's point)

| Stage | Optimal planting | Gate ("one crop right for all 8 plots"?) |
|---|---|---|
| Early | all wheat | forced by design — only crop unlocked; exempt |
| Mid (upgrade race) | wheat majority + **1–5 marigolds** (pets <6/6, fish >0) | mixed — passes |
| Late (sinks exhausting) | carrot majority + marigolds until pets 6/6 | mixed — passes |
| Post-completion | all carrot | mono, but unavoidable: treats are the single infinite sink; no numeric retune can change a one-infinite-sink endgame |

Key mechanics behind this (skeptic-corrected):

1. **Marigold's cap is a real, shipped nonlinearity** — `MARIGOLD_CATCH_BONUS 0.05`,
   `MARIGOLD_CATCH_CAP 0.50` (binds at 5). It's what produces within-stage mixes, and
   it's tunable by one line in content.ts if the founder ever wants a different split.
2. **Gold is the only crop-suppliable resource forage can't make** → wheat owns the
   mid-game producer slots. **Acorns are the only resource with an infinite sink**
   (treats) → carrot owns the late game. That's the Plan-6 rotation, working as claimed.
3. A strict resource-only min-maxer (values pets at zero) would mono-crop every stage —
   but that reading also says never build habitats and never fish; it's not how the
   game is meant to be scored. Analysis uses the consistent pets-valued reading everywhere.

## Why the two remedies named in the LIVE item would NOT help

- **Lower wheat's rate:** gold remains the unique crop-bottleneck at any positive rate —
  same argmax, slower game (pure grind add).
- **Gold soft-cap:** the barn already caps each bucket at 24h×rate; a harder cap
  throttles progress without changing any argmax.

## One real blemish: sapling is near-dead (accepted, founder may revisit)

Sapling is rarely optimal at any stage — not because forage out-produces it (that's
equally true of carrot) but because **wood has only finite sinks** (upgrades cap at
L5, habitats one-time) while acorns have treats. Options if it ever bothers play:
(a) accept — 50🪙 unlock, thematic, harmless; (b) a future feature adds a recurring
wood sink (e.g. habitat upkeep, wood→fish trade) — that's a design change, not tuning.

## Follow-through

- No change to `src/engine/content.ts` — deliberate (see above; a nerf would be a regression).
- Probe test was temporary and deleted; not part of the suite.
