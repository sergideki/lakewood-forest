import type { LandmarkId } from '../../engine/types';
import { LANDMARK_SPRITES } from '../sprites';
import { SpriteIcon } from './SpriteIcon';

type Props = {
  landmarkId: LandmarkId;
  emoji: string;
  size: number;
};

/** Single render path for a landmark's building sprite; falls back to its emoji when unregistered. */
export function LandmarkIcon({ landmarkId, emoji, size }: Props) {
  return <SpriteIcon sprite={LANDMARK_SPRITES[landmarkId]} emoji={emoji} size={size} />;
}
