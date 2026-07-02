import type { Crop, CropId } from './types';

export const CROPS: Record<CropId, Crop> = {
  wheat:  { id: 'wheat',  name: 'Wheat',  emoji: '🌾', growSec: 100, gold: 5 },
  carrot: { id: 'carrot', name: 'Carrot', emoji: '🥕', growSec: 240, gold: 14 },
  berry:  { id: 'berry',  name: 'Berry',  emoji: '🍓', growSec: 480, gold: 32 },
};

export const CROP_IDS: CropId[] = Object.keys(CROPS);
