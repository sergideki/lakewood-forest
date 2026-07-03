import type { Rarity } from '../engine/types';

/** Single source of rarity → accent color, shared by roster + journal. */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb6a4',
  uncommon: '#7fc8ff',
  rare: '#e6b3ff',
};
