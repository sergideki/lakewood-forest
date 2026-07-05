import { describe, it, expect } from 'vitest';
import { createInitialState, SPECIES, PET_IDS, UPGRADE_IDS, UPGRADES } from '../../src/engine';
import { ACHIEVEMENTS, isComplete, completedCount } from '../../src/engine/achievements';

const byId = (id: string) => {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`no achievement ${id}`);
  return a;
};

describe('achievements', () => {
  it('exposes exactly the 10 planned milestones', () => {
    expect(ACHIEVEMENTS.map((a) => a.id).sort()).toEqual(
      ['angler','aquarist','first-friends','forest-complete','lumberjack','pet-parent','seasoned','townsfolk','veteran','wealthy'].sort(),
    );
  });

  it('fresh state: two starters discovered, nothing else complete', () => {
    const s = createInitialState(0);
    expect(byId('first-friends').progress(s)).toEqual({ current: 2, target: 3 });
    expect(isComplete(s, byId('first-friends'))).toBe(false);
    expect(completedCount(s)).toBe(0);
  });

  it('forest-complete targets all land species; aquarist targets all water species', () => {
    const land = Object.values(SPECIES).filter((sp) => sp.affinity !== 'fish').map((sp) => sp.id);
    const water = Object.values(SPECIES).filter((sp) => sp.affinity === 'fish').map((sp) => sp.id);
    const s = { ...createInitialState(0), discovered: [...land, ...water] };
    expect(byId('forest-complete').progress(s)).toEqual({ current: land.length, target: land.length });
    expect(byId('aquarist').progress(s)).toEqual({ current: water.length, target: water.length });
    expect(isComplete(s, byId('forest-complete'))).toBe(true);
  });

  it('lifetime + level + pets + upgrades milestones read the right fields, current clamps to target', () => {
    const maxed: Record<string, number> = {};
    for (const id of UPGRADE_IDS) maxed[id] = UPGRADES[id].maxLevel;
    const s = {
      ...createInitialState(0),
      lifetime: { gold: 99999, wood: 5000, acorns: 0, fish: 2500 },
      pets: [...PET_IDS],
      upgrades: maxed,
      creatures: [{ ...createInitialState(0).creatures[0], level: 25 }],
    };
    expect(byId('angler').progress(s)).toEqual({ current: 1000, target: 1000 });   // clamped
    expect(byId('wealthy').progress(s)).toEqual({ current: 10000, target: 10000 });
    expect(byId('lumberjack').progress(s)).toEqual({ current: 1000, target: 1000 });
    expect(byId('pet-parent').progress(s)).toEqual({ current: PET_IDS.length, target: PET_IDS.length });
    expect(byId('seasoned').progress(s)).toEqual({ current: 10, target: 10 });
    expect(byId('veteran').progress(s)).toEqual({ current: 20, target: 20 });
    expect(byId('townsfolk').progress(s)).toEqual({ current: UPGRADE_IDS.length, target: UPGRADE_IDS.length });
  });
});
