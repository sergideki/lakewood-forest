import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { UPGRADES, TREAT_COST_ACORNS, TREAT_XP } from '../../src/engine/content';
import {
  upgradeLevel,
  upgradeCost,
  canAfford,
  purchaseUpgrade,
  buyTreat,
  barnCapMult,
  satchelCapMult,
  forageMult,
} from '../../src/engine/town';
import { barnCap, plantCrop, assignVillager } from '../../src/engine/farm';
import { satchelCap, forageRatePerSec, assignCreature } from '../../src/engine/forest';
import type { GameState } from '../../src/engine/types';

function rich(gold = 10_000, wood = 10_000, acorns = 10_000): GameState {
  const s = createInitialState(0);
  return { ...s, resources: { gold, wood, acorns, fish: 0 } };
}

describe('upgrade content', () => {
  it('every upgrade has a positive cost, growth > 1, and maxLevel >= 1', () => {
    for (const def of Object.values(UPGRADES)) {
      expect(def.id.length).toBeGreaterThan(0);
      expect(def.maxLevel).toBeGreaterThanOrEqual(1);
      expect(def.costGrowth).toBeGreaterThan(1);
      const total = (def.baseCost.gold ?? 0) + (def.baseCost.wood ?? 0) + (def.baseCost.acorns ?? 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe('upgradeLevel / upgradeCost', () => {
  it('reports 0 for unowned upgrades', () => {
    expect(upgradeLevel(createInitialState(0), 'barn-silo')).toBe(0);
  });

  it('cost grows by costGrowth per owned level, ceil per component', () => {
    const c0 = upgradeCost('barn-silo', 0)!;
    const c1 = upgradeCost('barn-silo', 1)!;
    expect(c0).toEqual({ gold: 40, wood: 25, acorns: 0, fish: 0 });
    expect(c1).toEqual({ gold: Math.ceil(40 * 1.8), wood: Math.ceil(25 * 1.8), acorns: 0, fish: 0 });
  });

  it('returns null at max level and for unknown ids', () => {
    expect(upgradeCost('barn-silo', UPGRADES['barn-silo'].maxLevel)).toBeNull();
    expect(upgradeCost('nope', 0)).toBeNull();
  });
});

describe('purchaseUpgrade', () => {
  it('deducts the exact cost and increments the level', () => {
    const s0 = rich();
    const s1 = purchaseUpgrade(s0, 'barn-silo');
    expect(upgradeLevel(s1, 'barn-silo')).toBe(1);
    expect(s1.resources).toEqual({ gold: 10_000 - 40, wood: 10_000 - 25, acorns: 10_000, fish: 0 });
  });

  it('is a no-op when unaffordable, at max level, or unknown id', () => {
    const broke = createInitialState(0); // 0 resources
    expect(purchaseUpgrade(broke, 'barn-silo')).toBe(broke);

    let s = rich(10 ** 9, 10 ** 9, 10 ** 9);
    for (let i = 0; i < UPGRADES['barn-silo'].maxLevel; i++) s = purchaseUpgrade(s, 'barn-silo');
    expect(upgradeLevel(s, 'barn-silo')).toBe(UPGRADES['barn-silo'].maxLevel);
    expect(purchaseUpgrade(s, 'barn-silo')).toBe(s);

    expect(purchaseUpgrade(rich(), 'nope')).toEqual(rich());
  });

  it('canAfford matches purchase behaviour', () => {
    expect(canAfford(rich(), 'barn-silo')).toBe(true);
    expect(canAfford(createInitialState(0), 'barn-silo')).toBe(false);
    expect(canAfford(rich(), 'nope')).toBe(false);
  });

  it('farm-plot appends plots 4-8 with null crop and unique ids, capped at maxLevel 5', () => {
    let s = rich(10 ** 9, 10 ** 9, 10 ** 9);
    for (let i = 0; i < 5; i++) s = purchaseUpgrade(s, 'farm-plot');
    expect(s.plots.map((p) => p.id)).toEqual(['plot-1', 'plot-2', 'plot-3', 'plot-4', 'plot-5', 'plot-6', 'plot-7', 'plot-8']);
    expect(s.plots.slice(3).every((p) => p.crop === null)).toBe(true);
    expect(purchaseUpgrade(s, 'farm-plot')).toBe(s); // maxLevel 5 -> no 9th plot
  });
});

describe('multipliers', () => {
  it('are 1 at level 0 and scale with owned levels', () => {
    const s0 = createInitialState(0);
    expect(barnCapMult(s0)).toBe(1);
    expect(satchelCapMult(s0)).toBe(1);
    expect(forageMult(s0)).toBe(1);

    const s = { ...s0, upgrades: { 'barn-silo': 2, 'satchel-stitch': 1, 'forage-tools': 3 } };
    expect(barnCapMult(s)).toBe(2);          // 1 + 0.5*2
    expect(satchelCapMult(s)).toBe(1.5);     // 1 + 0.5*1
    expect(forageMult(s)).toBeCloseTo(1.45); // 1 + 0.15*3
  });
});

describe('buyTreat', () => {
  it('deducts acorns and grants XP (auto-levels across a threshold)', () => {
    const s0 = rich();
    const target = s0.creatures[0]; // level 1, xp 0, common -> needs 100 xp for level 2
    const s1 = buyTreat(s0, target.id);
    expect(s1.resources.acorns).toBe(10_000 - TREAT_COST_ACORNS);
    const fed = s1.creatures.find((c) => c.id === target.id)!;
    expect(fed.level).toBe(2); // TREAT_XP (100) === xpForLevel(1, common)
    expect(fed.xp).toBe(0);
    expect(TREAT_XP).toBe(100);
  });

  it('is a no-op when acorns are short or the creature is unknown', () => {
    const broke = { ...rich(), resources: { gold: 0, wood: 0, acorns: TREAT_COST_ACORNS - 1, fish: 0 } };
    expect(buyTreat(broke, broke.creatures[0].id)).toBe(broke);
    const s = rich();
    expect(buyTreat(s, 'cr-ghost')).toBe(s);
  });

  it('feeds a creature even while it is assigned to a dungeon', () => {
    const s0 = rich();
    const c = s0.creatures[0];
    const inRun: GameState = {
      ...s0,
      creatures: s0.creatures.map((x) =>
        x.id === c.id ? { ...x, assignment: { type: 'dungeon' as const, dungeonId: 'hollow', startedAt: 1 } } : x,
      ),
    };
    const s1 = buyTreat(inRun, c.id);
    expect(s1.creatures.find((x) => x.id === c.id)!.level).toBe(2);
  });
});

describe('multipliers wired into caps and rates', () => {
  it('barn-silo scales the barnCap of a produced resource and stays an integer', () => {
    const s0 = createInitialState(0);
    expect(barnCap(s0)).toEqual({ gold: 0, wood: 0, acorns: 0 }); // no production -> no cap
    let s = plantCrop(s0, 'plot-1', 'wheat'); // 0.05 gold/s -> 4320/day (above the 500 floor)
    s = assignVillager(s, 'vil-1', 'farm');
    const base = barnCap(s).gold;
    expect(base).toBe(4320);
    const s1 = { ...s, upgrades: { 'barn-silo': 1 } };
    expect(barnCap(s1).gold).toBe(Math.round(base * 1.5)); // 6480
    expect(Number.isInteger(barnCap(s1).gold)).toBe(true);
  });

  it('satchel-stitch scales satchelCap (after the 200 floor) and stays an integer', () => {
    const s0 = createInitialState(0); // nobody foraging -> floor cap 200
    expect(satchelCap(s0)).toBe(200);
    const s1 = { ...s0, upgrades: { 'satchel-stitch': 3 } };
    expect(satchelCap(s1)).toBe(500); // 200 * 2.5
    expect(Number.isInteger(satchelCap(s1))).toBe(true);
  });

  it('forage-tools scales forageRatePerSec, which also lifts the derived satchel cap', () => {
    const s0 = createInitialState(0);
    const foraging = assignCreature(s0, s0.creatures[0].id, 'forage'); // starter #1 = fernling (acorn affinity)
    const mat = foraging.creatures[0].affinity;
    const base = forageRatePerSec(foraging, mat);
    expect(base).toBeGreaterThan(0);
    const boosted = { ...foraging, upgrades: { 'forage-tools': 2 } };
    expect(forageRatePerSec(boosted, mat)).toBeCloseTo(base * 1.3);
    expect(satchelCap(boosted)).toBeGreaterThan(satchelCap(foraging));
    expect(Number.isInteger(satchelCap(boosted))).toBe(true);
  });
});

describe('pet bonuses feed town mults', () => {
  it('pondsnail lifts barnCapMult by 5%', () => {
    const base = createInitialState(0);
    expect(barnCapMult({ ...base, pets: ['pondsnail'] })).toBeCloseTo(1.05, 10);
    expect(barnCapMult(base)).toBe(1); // no-pet unchanged
  });
  it('waterbeetle lifts satchelCapMult, dragonfly lifts forageMult', () => {
    const base = createInitialState(0);
    expect(satchelCapMult({ ...base, pets: ['waterbeetle'] })).toBeCloseTo(1.05, 10);
    expect(forageMult({ ...base, pets: ['dragonfly'] })).toBeCloseTo(1.08, 10);
  });
  it('pet mult composes multiplicatively with an upgrade level', () => {
    const base = createInitialState(0);
    const s = { ...base, pets: ['pondsnail'], upgrades: { 'barn-silo': 2 } }; // (1+0.5*2)*1.05
    expect(barnCapMult(s)).toBeCloseTo(2 * 1.05, 10);
  });
});
