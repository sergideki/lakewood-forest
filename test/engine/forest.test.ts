import { describe, it, expect } from 'vitest';
import { SPECIES, DUNGEONS } from '../../src/engine';

describe('content tables', () => {
  it('has ~10 species, each with rarity + wood|acorn affinity', () => {
    const ids = Object.keys(SPECIES);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const s = SPECIES[id];
      expect(s.id).toBe(id);
      expect(['common', 'uncommon', 'rare']).toContain(s.rarity);
      expect(['wood', 'acorn']).toContain(s.affinity);
      expect(s.emoji.length).toBeGreaterThan(0);
    }
  });

  it('includes the two starters fernling + pebblepup', () => {
    expect(SPECIES.fernling).toBeTruthy();
    expect(SPECIES.pebblepup).toBeTruthy();
  });

  it('has 3 dungeons with ascending duration + recommended power', () => {
    expect(DUNGEONS).toHaveLength(3);
    for (let i = 1; i < DUNGEONS.length; i++) {
      expect(DUNGEONS[i].durationSec).toBeGreaterThan(DUNGEONS[i - 1].durationSec);
      expect(DUNGEONS[i].recommendedPower).toBeGreaterThan(DUNGEONS[i - 1].recommendedPower);
    }
    for (const d of DUNGEONS) {
      expect(d.loot.gold).toBeGreaterThan(0);
      expect(d.baseDiscoveryChance).toBeGreaterThan(0);
      expect(d.xpReward).toBeGreaterThan(0);
    }
  });
});
