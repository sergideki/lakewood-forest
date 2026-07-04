# Lakewood — Sprites for everything (id:sprites-all) — Design

**Date:** 2026-07-04 · **Status:** approved (autonomous session, auto-recommend per standing brainstorm rules)
**Predecessor:** Plan 2b (docs/superpowers/specs/2026-07-03-lakewood-plan2b-sprites-design.md) — forest 10 shipped.

## 1. Goal

Replace every remaining *entity* emoji with a 64×64 pixel sprite matching the forest 10's
16-bit style. 17 sprites total:

| Group | Count | Ids | Current render |
|---|---|---|---|
| Water creatures | 4 | ripplefrog 🐸 puddleduck 🦆 koisprite 🎏 mistleotter 🦦 | emoji via `CreatureIcon` fallback |
| Pets | 6 | pondsnail 🐌 waterbeetle 🪲 dragonfly 🦋 pebbleturtle 🐢 crawdad 🦞 pondnewt 🦎 | raw `<Text>` emoji |
| Crops | 4 | wheat 🌾 carrot 🥕 sapling 🌲 marigold 🌼 | raw `<Text>` emoji |
| Villagers | 3 | vil-1 Pip 🧑‍🌾 · vil-2 Nan 👵 · vil-3 Rowan 🧔 | raw `<Text>` emoji |

## 2. Non-goals

- The forest 10 PNGs are **not** regenerated or touched (style-drift risk; they're shipped).
- UI glyphs stay emoji/text: resources (🪙🪵🌰🐟), habitat/dungeon/upgrade card icons,
  tab icons, ➕ empty plot, ✕ clear, 🔒 locked, ❔ undiscovered, 🎣 toast headers.
- No engine change. `src/engine/` stays pure and untouched; `emoji` fields remain in
  content.ts as fallbacks.
- No animation, no size variants — single 64×64 PNG per entity, `resizeMode="contain"`.

## 3. Art pipeline (procedural, reproducible)

The forest 10 were procedurally authored then crunched (commits b0baa9f → 4312896 →
8986806), but the generator was never committed and is lost. This time the generator
**ships in the repo**: `scripts/gen-sprites.py` (PIL, same dependency as gen-icon.py).

Style parameters (sampled from the shipped forest 10):

- Canvas 64×64 RGBA transparent; drawn supersampled (×8), then **crunched: downsample to
  ~44 px native → nearest-neighbor upscale to 64 → posterize 4 bits/channel**.
- **Hard-banded cel shading**: highlight + base + 2 shadow steps per material, checker
  dither on band transitions. No gradients.
- **Outline** `(16,16,32)` (sampled: darkest color of every shipped sprite), 1 native px.
- ≤ ~17 opaque colors per sprite (shipped range: 12–17).
- Creatures/pets keep the established chibi language: round body ~centered, two big
  glossy eyes (dark iris + white specular dot), tiny mouth, small feet/nubs, one
  signature accessory per species. Crops are object sprites (no face). Villagers are
  chibi busts (round head + shoulders), same banding — **riskiest group; if the QA
  contact sheet reads badly they are dropped from the registry (emoji fallback keeps
  working) without blocking the rest.**

Descriptor set (silhouette + palette anchors):

| Id | Design |
|---|---|
| ripplefrog | round mint-green frog, big lily eyes on top, blue ripple ring at feet |
| puddleduck | round pale-yellow duckling, orange bill, small puddle at feet |
| koisprite | white koi body, orange patches, flowing tail fin, pale glow dots |
| mistleotter | brown round otter, cream belly, grey mist wisps around |
| pondsnail | cream body, brown spiral shell, stub antennae |
| waterbeetle | glossy blue-black dome, banded shell shine, tiny legs |
| dragonfly | teal slim body, four pale translucent-look wings (dither), big eyes |
| pebbleturtle | grey-green turtle, shell of rounded pebble facets |
| crawdad | brick-red crayfish, two front claws, segmented tail |
| pondnewt | dark olive newt, bright orange belly, curled tail |
| wheat | golden sheaf, 3 stalks, tied band |
| carrot | orange taper, green frilly top |
| sapling | small pine, two green tiers, brown pot-of-earth base |
| marigold | orange-yellow layered bloom, green stem + leaf |
| pip | young farmer, straw hat, freckles, green shirt |
| nan | granny, grey bun, round glasses, shawl |
| rowan | brown beard, tousled hair, mustard tunic |

File layout: `assets/creatures/<speciesId>.png` (water 4 — same folder/convention as
forest 10), `assets/pets/<petId>.png`, `assets/crops/<cropId>.png`,
`assets/villagers/<pip|nan|rowan>.png`.

## 4. Code changes (UI layer only)

1. **`src/ui/components/SpriteIcon.tsx` (new, generic):**
   `SpriteIcon({ sprite?: ImageSourcePropType, emoji: string, size: number })` —
   `<Image>` when `sprite` given, else emoji `<Text>`. Exactly CreatureIcon's logic with
   the lookup hoisted to the caller. `CreatureIcon` **stays untouched** (shipped path).
2. **`src/ui/sprites.ts`:** add 4 water lines to `CREATURE_SPRITES`; add
   `PET_SPRITES: Partial<Record<PetId, ...>>`,
   `CROP_SPRITES: Partial<Record<CropId, ...>>`,
   `VILLAGER_SPRITES: Partial<Record<string, ...>>` (keyed by villager id `vil-1|2|3`).
   Same hard rule as today: **a registry line must point at an existing file** (Metro
   resolves `require()` at bundle time).
3. **Call-site swaps** (size = the fontSize it replaces):

| File | Site | Now | Becomes |
|---|---|---|---|
| FriendsJournal.tsx | caught-pet cell | `<Text>{pet.emoji}` | `SpriteIcon sprite={PET_SPRITES[id]} size={48}` (parity with creature cells) |
| CatchToast.tsx | pet reveal | `<Text style={icon}>` | `SpriteIcon` at the icon's current fontSize |
| PlotGrid.tsx | plot cell | `{crop.emoji}` 24px | `SpriteIcon` 24 (➕ empty stays Text) |
| PlotGrid.tsx | picker unlocked row | `{c.emoji}` 22px | `SpriteIcon` 22 |
| PlotGrid.tsx | picker locked row | `{c.emoji} {c.name}` inline | `SpriteIcon` 18 + `<Text>{c.name}` (🔒 stays) |
| VillagerRow.tsx | family chip | `{v.emoji}` 22px | `SpriteIcon sprite={VILLAGER_SPRITES[v.id]}` 22 |

Undiscovered/locked journal cells keep ❔ (no info leak — unchanged behavior).

## 5. Testing & QA

- **New vitest (node, fs-only): `test/sprite-assets.test.ts`** — for every SpeciesId,
  PetId, CropId and villager id, assert the expected PNG exists on disk and is 64×64
  (PNG header width/height bytes — no image lib needed). Guards the Metro
  missing-require trap without importing RN code. Does NOT import `src/ui/sprites.ts`.
- `npx tsc --noEmit` clean; existing 137 tests hold (engine untouched).
- **Live browser QA** (mandatory — component tests don't exist; zustand-v5 mount trap):
  drive /lake (habitat → water-creature reveal toast + roster), /friends (pets grid +
  creature grid), /home (plots + picker + villager chips), CatchToast, hard reload per
  tab. Zero console errors.
- **Style-parity contact sheet:** generator emits `scratch` contact sheet of all 27
  (10 shipped + 17 new) for a side-by-side eyeball check before merge.

## 6. Risks

- **Style drift vs the forest 10** — mitigated by sampled parameters + contact sheet.
- **Villager faces at 44px native** — explicit drop-without-blocking path (§3).
- **Metro require of missing file** — asset test + "registry line only after PNG lands".
- **Parallel-session APK work** — rebase before merge (same as Plan 5).
