import type { GameState } from './types';
import { SPECIES, PET_IDS, UPGRADE_IDS, UPGRADES, MAX_VILLAGERS } from './content';

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** `current` is clamped to `target` so a progress bar never overfills. */
  progress(state: GameState): { current: number; target: number };
}

/** Clamp raw progress so the UI never shows current > target. isComplete still fires at ==target. */
const clamp = (current: number, target: number) => ({ current: Math.min(current, target), target });

const LAND_SPECIES = Object.values(SPECIES).filter((s) => s.affinity !== 'fish').map((s) => s.id);
const WATER_SPECIES = Object.values(SPECIES).filter((s) => s.affinity === 'fish').map((s) => s.id);

const maxLevel = (s: GameState): number =>
  s.creatures.reduce((m, c) => Math.max(m, c.level), 0);
const discoveredIn = (s: GameState, ids: string[]): number =>
  ids.filter((id) => s.discovered.includes(id)).length;
const maxedUpgrades = (s: GameState): number =>
  UPGRADE_IDS.filter((id) => (s.upgrades[id] ?? 0) >= UPGRADES[id].maxLevel).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-friends', name: 'First Friends', emoji: '🌱', description: 'Discover 3 creatures',
    progress: (s) => clamp(s.discovered.length, 3) },
  { id: 'forest-complete', name: 'Forest Complete', emoji: '🌲', description: 'Discover every forest creature',
    progress: (s) => clamp(discoveredIn(s, LAND_SPECIES), LAND_SPECIES.length) },
  { id: 'aquarist', name: 'Aquarist', emoji: '🌊', description: 'Discover every water creature',
    progress: (s) => clamp(discoveredIn(s, WATER_SPECIES), WATER_SPECIES.length) },
  { id: 'pet-parent', name: 'Pet Parent', emoji: '🐾', description: 'Catch all pets',
    progress: (s) => clamp(s.pets.length, PET_IDS.length) },
  { id: 'seasoned', name: 'Seasoned', emoji: '⭐', description: 'Raise a creature to level 10',
    progress: (s) => clamp(maxLevel(s), 10) },
  { id: 'veteran', name: 'Veteran', emoji: '🎖️', description: 'Raise a creature to level 20',
    progress: (s) => clamp(maxLevel(s), 20) },
  { id: 'angler', name: 'Angler', emoji: '🐟', description: 'Catch 1,000 fish',
    progress: (s) => clamp(s.lifetime.fish, 1000) },
  { id: 'wealthy', name: 'Wealthy', emoji: '🪙', description: 'Earn 10,000 gold',
    progress: (s) => clamp(s.lifetime.gold, 10000) },
  { id: 'lumberjack', name: 'Lumberjack', emoji: '🪵', description: 'Gather 1,000 wood',
    progress: (s) => clamp(s.lifetime.wood, 1000) },
  { id: 'townsfolk', name: 'Townsfolk', emoji: '🏘️', description: 'Max every town upgrade',
    progress: (s) => clamp(maxedUpgrades(s), UPGRADE_IDS.length) },
  { id: 'full-house', name: 'Full House', emoji: '👪', description: 'Recruit a full village (8)',
    progress: (s) => clamp(s.villagers.length, MAX_VILLAGERS) },
];

export function isComplete(state: GameState, a: Achievement): boolean {
  const { current, target } = a.progress(state);
  return current >= target;
}

export function completedCount(state: GameState): number {
  return ACHIEVEMENTS.filter((a) => isComplete(state, a)).length;
}
