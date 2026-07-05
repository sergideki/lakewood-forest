import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { cards } from '../styles';
import { RARITY_COLOR } from '../rarity';
import { useGameStore } from '../../store/gameStore';
import { SPECIES, PETS, PET_IDS, PET_EFFECTS } from '../../engine';
import type { PetLever } from '../../engine';
import { PET_SPRITES } from '../sprites';
import { CreatureIcon } from './CreatureIcon';
import { SpriteIcon } from './SpriteIcon';

const AFFINITY_EMOJI = { wood: '🪵', acorn: '🌰', fish: '🐟' } as const;
const ALL_SPECIES = Object.values(SPECIES); // static catalog — build once at module load

const LEVER_LABEL: Record<PetLever, string> = {
  barnCap: 'barn',
  satchelCap: 'satchel',
  forageRate: 'forage',
  creelCap: 'creel',
  farmRate: 'farm',
  catchChance: 'catch',
};

export function FriendsJournal() {
  // Subscribe to the STABLE slice only. zustand v5 (useSyncExternalStore) crashes
  // on mount ("getSnapshot should be cached") if a selector returns a freshly
  // built array/object — so never .filter/.map inside the selector.
  const discovered = useGameStore((s) => s.state.discovered);
  const pets = useGameStore((s) => s.state.pets);
  const species = ALL_SPECIES;

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

      <View style={cards.card}>
        <Text style={cards.title}>🐾 Pets</Text>
        <Text style={cards.sub}>{pets.length} / {PET_IDS.length} caught</Text>
      </View>
      <View style={styles.grid}>
        {PET_IDS.map((id) => {
          const pet = PETS[id];
          const caught = pets.includes(id);
          if (!caught) {
            return (
              <View key={id} style={[styles.cell, styles.cellLocked]}>
                <Text style={styles.lockGlyph}>❔</Text>
                <Text style={styles.name}>???</Text>
              </View>
            );
          }
          const effect = PET_EFFECTS[id];
          return (
            <View key={id} style={styles.cell}>
              <SpriteIcon sprite={PET_SPRITES[id]} emoji={pet.emoji} size={48} />
              <Text style={styles.name}>{pet.name}</Text>
              <Text style={[styles.rarity, { color: RARITY_COLOR[pet.rarity] }]}>• {pet.rarity}</Text>
              {effect && (
                <Text style={styles.buff}>+{Math.round(effect.amount * 100)}% {LEVER_LABEL[effect.lever]}</Text>
              )}
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
  buff: { color: theme.textDim, fontSize: 11 },
});
