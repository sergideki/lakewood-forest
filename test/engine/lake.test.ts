import { describe, it, expect } from 'vitest';
import { createInitialState, SPECIES } from '../../src/engine';
import { assignCreature } from '../../src/engine/forest';
import { BASE_ROD_RATE, CREEL_FLOOR, CREEL_HOURS, PET_IDS, getHabitat, HABITATS } from '../../src/engine/content';
import {
  fishRatePerSec,
  creelCap,
  accrueCreel,
  collectCreel,
  rollCatch,
  habitatStatus,
  canBuildHabitat,
  buildHabitat,
  collectHabitat,
} from '../../src/engine/lake';
import { rollDiscovery } from '../../src/engine/creatures';
import type { GameState } from '../../src/engine/types';

// A state with one discovered fish-affinity creature set to forage (fills the creel).
function withWaterForager(): GameState {
  const s = createInitialState(0);
  const frog = {
    id: 'cr-ripplefrog', species: 'ripplefrog', name: 'Ripple Frog', emoji: '🐸',
    rarity: 'common' as const, affinity: 'fish' as const, level: 1, xp: 0,
    assignment: { type: 'forage' as const, dungeonId: null, startedAt: 0 },
  };
  return { ...s, creatures: [...s.creatures, frog], discovered: [...s.discovered, 'ripplefrog'] };
}

describe('fishRatePerSec', () => {
  it('is the flat rod base with zero water creatures', () => {
    expect(fishRatePerSec(createInitialState(0))).toBe(BASE_ROD_RATE);
  });
  it('rises when a fish-affinity creature forages', () => {
    expect(fishRatePerSec(withWaterForager())).toBeGreaterThan(BASE_ROD_RATE);
  });
  it('forage-tools lifts only the creature part, not the rod base', () => {
    const s = withWaterForager();
    const creaturePart = fishRatePerSec(s) - BASE_ROD_RATE;
    const boosted = { ...s, upgrades: { 'forage-tools': 2 } };
    expect(fishRatePerSec(boosted)).toBeCloseTo(BASE_ROD_RATE + creaturePart * 1.3);
  });
});

describe('creelCap', () => {
  it('is a day of the current fish rate, at least the floor, integer', () => {
    const cap = creelCap(createInitialState(0));
    expect(cap).toBe(Math.max(CREEL_FLOOR, Math.round(BASE_ROD_RATE * CREEL_HOURS * 3600)));
    expect(Number.isInteger(cap)).toBe(true);
  });
  it('rises with more foragers', () => {
    expect(creelCap(withWaterForager())).toBeGreaterThan(creelCap(createInitialState(0)));
  });
});

describe('accrueCreel', () => {
  it('fills at the fish rate over elapsed seconds', () => {
    const after = accrueCreel(createInitialState(0), 100);
    expect(after.storage.creel.fish).toBeCloseTo(BASE_ROD_RATE * 100);
  });
  it('clamps at the cap', () => {
    const s = createInitialState(0);
    expect(accrueCreel(s, 10 ** 9).storage.creel.fish).toBe(creelCap(s));
  });
  it('is a no-op for zero or negative elapsed', () => {
    const s = createInitialState(0);
    expect(accrueCreel(s, 0)).toBe(s);
    expect(accrueCreel(s, -5)).toBe(s);
  });
});

describe('collectCreel', () => {
  const lowRng = () => 0;      // "hit" the catch, pick the first pet
  const highRng = () => 0.999; // never catch

  it('banks whole fish and carries the remainder', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 12.7 } } };
    const after = collectCreel(s, highRng); // isolate banking from catching
    expect(after.resources.fish).toBe(12);
    expect(after.storage.creel.fish).toBeCloseTo(0.7);
  });
  it('empty creel is a no-op — no bank, no catch roll', () => {
    const s = createInitialState(0); // creel.fish = 0
    expect(collectCreel(s, lowRng)).toBe(s);
    expect(collectCreel(s, lowRng).pets.length).toBe(0);
  });
  it('catches a pet when rng is below CATCH_CHANCE and fish were banked', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 5 } } };
    expect(collectCreel(s, lowRng).pets.length).toBe(1);
  });
  it('catches nothing when rng is above CATCH_CHANCE', () => {
    const s = { ...createInitialState(0), storage: { ...createInitialState(0).storage, creel: { fish: 5 } } };
    expect(collectCreel(s, highRng).pets.length).toBe(0);
  });
});

describe('rollCatch', () => {
  it('no-ops (same ref) when the pool is exhausted', () => {
    const full = { ...createInitialState(0), pets: [...PET_IDS] };
    expect(rollCatch(full, 1, () => 0)).toBe(full);
  });
  it('respects the chance gate', () => {
    const s = createInitialState(0);
    expect(rollCatch(s, 0, () => 0.5)).toBe(s);
  });
});

function richFish(): GameState {
  return { ...createInitialState(0), resources: { gold: 10_000, wood: 10_000, acorns: 10_000, fish: 10_000 } };
}

describe('habitatStatus', () => {
  it('is unbuilt initially and for unknown ids', () => {
    expect(habitatStatus(createInitialState(0), 'lilypads', 0)).toBe('unbuilt');
    expect(habitatStatus(createInitialState(0), 'nope', 0)).toBe('unbuilt');
  });
  it('unbuilt → attracting → ready → done across time and discovery', () => {
    const def = getHabitat('lilypads')!;
    let s = buildHabitat(richFish(), 'lilypads', 1000);
    expect(habitatStatus(s, 'lilypads', 1000)).toBe('attracting');
    const readyAt = 1000 + def.attractSec * 1000;
    expect(habitatStatus(s, 'lilypads', readyAt)).toBe('ready');
    s = collectHabitat(s, 'lilypads', readyAt);
    expect(habitatStatus(s, 'lilypads', readyAt)).toBe('done');
  });
});

describe('buildHabitat', () => {
  it('pays the exact cost across all resources and stamps builtAt', () => {
    const s = buildHabitat(richFish(), 'reedbed', 5000); // cost: fish 40, wood 20
    expect(s.resources.fish).toBe(10_000 - 40);
    expect(s.resources.wood).toBe(10_000 - 20);
    expect(s.resources.gold).toBe(10_000);
    expect(s.habitats.find((h) => h.id === 'reedbed')!.builtAt).toBe(5000);
  });
  it('is a no-op when unaffordable, already built, or unknown', () => {
    const broke = createInitialState(0); // 0 fish
    expect(buildHabitat(broke, 'lilypads', 0)).toBe(broke);
    const built = buildHabitat(richFish(), 'lilypads', 1);
    expect(buildHabitat(built, 'lilypads', 2)).toBe(built);
    const s = richFish();
    expect(buildHabitat(s, 'nope', 0)).toBe(s);
  });
  it('canBuildHabitat matches build behaviour', () => {
    expect(canBuildHabitat(richFish(), 'lilypads')).toBe(true);
    expect(canBuildHabitat(createInitialState(0), 'lilypads')).toBe(false);
    expect(canBuildHabitat(richFish(), 'nope')).toBe(false);
  });
});

describe('collectHabitat', () => {
  it('is a no-op unless ready', () => {
    const s = buildHabitat(richFish(), 'lilypads', 1000);
    expect(collectHabitat(s, 'lilypads', 1000)).toBe(s); // attracting
    const fresh = createInitialState(0);
    expect(collectHabitat(fresh, 'lilypads', 0)).toBe(fresh); // unbuilt
  });
  it('discovers exactly the target species and spawns one creature when ready', () => {
    const def = getHabitat('lilypads')!;
    const built = buildHabitat(richFish(), 'lilypads', 1000);
    const readyAt = 1000 + def.attractSec * 1000;
    const before = built.creatures.length;
    const after = collectHabitat(built, 'lilypads', readyAt);
    expect(after.discovered).toContain(def.attracts);
    expect(after.creatures.length).toBe(before + 1);
    expect(after.creatures.some((c) => c.species === def.attracts)).toBe(true);
  });
  it('is idempotent — a second collect is a no-op (status is done)', () => {
    const def = getHabitat('lilypads')!;
    const readyAt = 1000 + def.attractSec * 1000;
    const once = collectHabitat(buildHabitat(richFish(), 'lilypads', 1000), 'lilypads', readyAt);
    expect(collectHabitat(once, 'lilypads', readyAt)).toBe(once);
  });
});

describe('habitat content integrity', () => {
  it('every habitat targets a known fish-affinity species', () => {
    for (const h of HABITATS) {
      expect(SPECIES[h.attracts]).toBeTruthy();
      expect(SPECIES[h.attracts].affinity).toBe('fish');
    }
  });

  it('maps habitats to water species one-to-one (no species reachable by two habitats)', () => {
    const targets = HABITATS.map((h) => h.attracts);
    expect(new Set(targets).size).toBe(targets.length);
    const waterSpecies = Object.values(SPECIES).filter((sp) => sp.affinity === 'fish');
    expect(new Set(targets)).toEqual(new Set(waterSpecies.map((sp) => sp.id)));
  });
});

describe('rollDiscovery excludes water creatures (directed-only)', () => {
  it('never randomly discovers a fish-affinity species, even when only water species remain', () => {
    const land = Object.values(SPECIES).filter((sp) => sp.affinity !== 'fish').map((sp) => sp.id);
    const s = { ...createInitialState(0), discovered: land };
    const after = rollDiscovery(s, 1, () => 0); // chance 1; land-only pool must be empty → no-op
    expect(after).toBe(s);
    expect(after.discovered.some((id) => SPECIES[id].affinity === 'fish')).toBe(false);
  });
});


import { accrueMarigold, creelCatchChance } from '../../src/engine';
import { CATCH_CHANCE, MARIGOLD_CATCH_CAP } from '../../src/engine';

function withMarigolds(n: number, fish: number) {
  const base = createInitialState(0);
  const plots = Array.from({ length: n }, (_, i) => ({ id: `m-${i}`, crop: 'marigold' as const }));
  return {
    ...base,
    unlockedCrops: ['wheat', 'marigold'],
    plots: [...base.plots, ...plots],
    resources: { ...base.resources, fish },
  };
}

describe('marigold catch bonus', () => {
  it('is base CATCH_CHANCE with zero marigolds', () => {
    expect(creelCatchChance(createInitialState(0))).toBeCloseTo(CATCH_CHANCE, 5);
  });

  it('adds 0.05 per planted marigold while fish remain', () => {
    expect(creelCatchChance(withMarigolds(2, 100))).toBeCloseTo(CATCH_CHANCE + 0.10, 5);
  });

  it('clamps at MARIGOLD_CATCH_CAP', () => {
    expect(creelCatchChance(withMarigolds(8, 100))).toBe(MARIGOLD_CATCH_CAP);
  });

  it('is dormant (base chance) when the pond is dry', () => {
    expect(creelCatchChance(withMarigolds(3, 0))).toBeCloseTo(CATCH_CHANCE, 5);
  });
});

describe('accrueMarigold', () => {
  it('drains fish over time per planted marigold', () => {
    const s = withMarigolds(2, 100); // 2 * 0.02 = 0.04 fish/s
    const after = accrueMarigold(s, 100); // 4 fish
    expect(after.resources.fish).toBeCloseTo(96, 5);
  });

  it('clamps fish at zero, never negative', () => {
    const s = withMarigolds(2, 1);
    expect(accrueMarigold(s, 10_000).resources.fish).toBe(0);
  });

  it('is a no-op with no marigolds or non-positive elapsed', () => {
    const none = createInitialState(0);
    expect(accrueMarigold(none, 100)).toBe(none);
    const s = withMarigolds(1, 50);
    expect(accrueMarigold(s, 0)).toBe(s);
  });
});

describe('collectCreel marigold dormancy (integrated)', () => {
  // base CATCH_CHANCE=0.25; 3 marigolds boost to 0.40 while the pond has fish.
  // A mid rng of 0.30 catches ONLY when boosted (0.30<0.40) and misses when dormant (0.30>=0.25).
  const midRng = () => 0.30;
  const threeMarigolds = (fish: number) => {
    const base = createInitialState(0);
    const plots = [
      ...base.plots,
      { id: 'm-0', crop: 'marigold' as const },
      { id: 'm-1', crop: 'marigold' as const },
      { id: 'm-2', crop: 'marigold' as const },
    ];
    return { ...base, plots, resources: { ...base.resources, fish }, storage: { ...base.storage, creel: { fish: 5 } } };
  };

  it('rolls at the boosted chance when the pond has fish before collecting', () => {
    expect(collectCreel(threeMarigolds(10), midRng).pets.length).toBe(1);
  });

  it('is dormant (base chance) when the pond was dry, even though the collect banks fresh fish', () => {
    expect(collectCreel(threeMarigolds(0), midRng).pets.length).toBe(0);
  });
});
