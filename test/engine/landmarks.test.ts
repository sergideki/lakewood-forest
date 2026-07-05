import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine/state';
import {
  landmarkLeverMult, landmarkCatchBonus, prosperityMult,
  buildLandmark, allLandmarksBuilt,
  festivalCost, canFundFestival, fundFestival,
} from '../../src/engine/landmarks';
import { farmRatesPerSec } from '../../src/engine/farm';
import { fishRatePerSec, creelCatchChance } from '../../src/engine/lake';
import { barnCapMult, forageMult, buyTreat, feedAllTreats } from '../../src/engine/town';
import { LANDMARK_IDS, LANDMARKS, FESTIVAL_BASE_COST } from '../../src/engine/content';
import type { GameState } from '../../src/engine/types';

const rich = (): GameState => ({
  ...createInitialState(0),
  resources: { gold: 1e6, wood: 1e6, acorns: 1e6, fish: 1e6 },
});

// A state with one farm villager assigned and one fish forager, so farm/fish rates are nonzero.
const active = (): GameState => {
  const s = rich();
  return {
    ...s,
    villagers: s.villagers.map((v) => ({ ...v, assignedTo: v.specialty })),
    creatures: [
      { id: 'cr-ripplefrog', species: 'ripplefrog', name: 'Ripple Frog', emoji: '🐸', rarity: 'common', affinity: 'fish', level: 1, xp: 0, assignment: { type: 'forage', dungeonId: null, startedAt: 0 } },
    ],
  };
};

describe('landmark levers', () => {
  it('are identities when none built', () => {
    const s = createInitialState(0);
    expect(landmarkLeverMult(s, 'farmRate')).toBe(1);
    expect(landmarkCatchBonus(s)).toBe(0);
    expect(prosperityMult(s)).toBe(1);
  });
  it('sum only built landmarks on the matching lever', () => {
    const s = { ...rich(), landmarks: ['windmill'] };
    expect(landmarkLeverMult(s, 'farmRate')).toBeCloseTo(1.10);
    expect(landmarkLeverMult(s, 'barnCap')).toBe(1);
  });
  it('fountain feeds catch bonus additively', () => {
    expect(landmarkCatchBonus({ ...rich(), landmarks: ['fountain'] })).toBeCloseTo(0.05);
  });
});

describe('buildLandmark', () => {
  it('pays exact cost and appends when affordable', () => {
    const s = buildLandmark(rich(), 'bakery');
    expect(s.landmarks).toContain('bakery');
    expect(s.resources.gold).toBe(1e6 - LANDMARKS.bakery.cost.gold!);
    expect(s.resources.wood).toBe(1e6 - LANDMARKS.bakery.cost.wood!);
    expect(s.resources.acorns).toBe(1e6 - LANDMARKS.bakery.cost.acorns!);
  });
  it('no-op (same ref) when unaffordable / duplicate / unknown', () => {
    const poor = createInitialState(0);
    expect(buildLandmark(poor, 'bakery')).toBe(poor);
    const built = buildLandmark(rich(), 'bakery');
    expect(buildLandmark(built, 'bakery')).toBe(built);
    const s = rich();
    expect(buildLandmark(s, 'nope')).toBe(s);
  });
});

describe('festival', () => {
  it('cost scales by growth^level', () => {
    expect(festivalCost(0)).toEqual(FESTIVAL_BASE_COST);
    expect(festivalCost(1).gold).toBe(Math.ceil(FESTIVAL_BASE_COST.gold * 1.15));
  });
  it('is gated on all 8 landmarks built', () => {
    expect(canFundFestival(rich())).toBe(false);
    const all = { ...rich(), landmarks: [...LANDMARK_IDS] };
    expect(allLandmarksBuilt(all)).toBe(true);
    expect(canFundFestival(all)).toBe(true);
  });
  it('fundFestival pays + increments; prosperity is linear', () => {
    const all = { ...rich(), landmarks: [...LANDMARK_IDS] };
    const s = fundFestival(all);
    expect(s.festivalLevel).toBe(1);
    expect(s.resources.gold).toBe(1e6 - FESTIVAL_BASE_COST.gold);
    expect(prosperityMult(s)).toBeCloseTo(1.02);
  });
});

describe('buff seams', () => {
  it('windmill lifts farm output ~10%', () => {
    const b = active();
    const w = { ...b, landmarks: ['windmill'] };
    expect(farmRatesPerSec(w).gold).toBeCloseTo(farmRatesPerSec(b).gold * 1.10, 6);
  });
  it('gazebo lifts barnCapMult 15%, lanterns forageMult 10%', () => {
    expect(barnCapMult({ ...rich(), landmarks: ['gazebo'] })).toBeCloseTo(barnCapMult(rich()) * 1.15, 6);
    expect(forageMult({ ...rich(), landmarks: ['lanterns'] })).toBeCloseTo(forageMult(rich()) * 1.10, 6);
  });
  it('fountain adds 0.05 catch chance', () => {
    const b = active();
    expect(creelCatchChance({ ...b, landmarks: ['fountain'] })).toBeCloseTo(creelCatchChance(b) + 0.05, 6);
  });
  it('M2: prosperity scales the whole fish rate exactly once (no forager double-count)', () => {
    const b = active();
    const p = { ...b, festivalLevel: 25 }; // prosperity 1.5
    expect(fishRatePerSec(p)).toBeCloseTo(fishRatePerSec(b) * 1.5, 6);
  });
});

describe('treats', () => {
  const withCreatures = (n: number, acorns: number): GameState => ({
    ...createInitialState(0),
    resources: { gold: 0, wood: 0, acorns, fish: 0 },
    creatures: Array.from({ length: n }, (_, i) => ({
      id: `c${i}`, species: 'fernling', name: 'Fernling', emoji: '🌱', rarity: 'common' as const, affinity: 'acorn' as const,
      level: 1, xp: 0, assignment: { type: 'idle' as const, dungeonId: null, startedAt: 0 },
    })),
  });
  it('feeds all when affordable, spends exact acorns', () => {
    const s = feedAllTreats(withCreatures(3, 100));
    expect(s.resources.acorns).toBe(100 - 75);
    expect(s.creatures.every((c) => c.xp > 0 || c.level > 1)).toBe(true);
  });
  it('feeds only as many as affordable', () => {
    const s = feedAllTreats(withCreatures(3, 60)); // 2 treats = 50
    expect(s.resources.acorns).toBe(60 - 50);
  });
  it('no-op (same ref) when broke', () => {
    const poor = withCreatures(3, 10);
    expect(feedAllTreats(poor)).toBe(poor);
  });
  it('bakery boosts treat XP', () => {
    const s = withCreatures(1, 100);
    const boosted = { ...s, landmarks: ['bakery'] };
    expect(buyTreat(boosted, 'c0').creatures[0].xp).toBeGreaterThan(buyTreat(s, 'c0').creatures[0].xp);
  });
});
