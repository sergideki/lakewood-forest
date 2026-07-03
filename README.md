# Lakewood Forest

A cozy, warm, offline idle game. Tend a forest farm, send your family to the fields
and your discovered creatures to forage and delve gentle dungeons — then close the app
and come back to loot. No ads, no gacha, no leaderboards. Actually slow.

Built with React Native + Expo. Fully offline, single-player, local save.

**📲 Play it:** grab the Android APK from [Releases](https://github.com/sergideki/lakewood-forest/releases/latest) (sideload — allow "unknown sources" when prompted).

## What you do

- **Farm** — plant crops, assign your family; the barn fills on real wall-clock time, tap Collect.
- **Forest** — send creatures foraging (wood 🪵 / acorns 🌰 into a capped satchel) or into
  no-fail timed **dungeon** runs. Stronger teams pull better loot.
- **Discover** — finishing a forage or a dungeon run can turn up a brand-new creature in the
  wild. It joins your roster on the spot. Creatures gain XP and level up as they work.

Everything runs on-open catch-up: assign your workers, close the app, come back to progress.

## Run it

```bash
npm install
npx expo start        # then open in Expo Go, or press w for web
```

## Build an Android APK

```bash
eas build -p android --profile preview
```

## License

MIT — see [LICENSE](LICENSE). Clean-room build; no code or assets derived from any other game.
