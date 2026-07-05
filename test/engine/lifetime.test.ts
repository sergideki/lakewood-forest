import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine';
import { bumpLifetime } from '../../src/engine/lifetime';

describe('lifetime', () => {
  it('createInitialState seeds all lifetime counters at zero', () => {
    const s = createInitialState(0);
    expect(s.lifetime).toEqual({ gold: 0, wood: 0, acorns: 0, fish: 0 });
  });

  it('bumpLifetime adds a partial delta and leaves other keys unchanged', () => {
    const s = createInitialState(0);
    const next = bumpLifetime(s, { fish: 5, gold: 2 });
    expect(next.lifetime).toEqual({ gold: 2, wood: 0, acorns: 0, fish: 5 });
    expect(s.lifetime.fish).toBe(0); // pure — original untouched
  });

  it('bumpLifetime accumulates across calls', () => {
    let s = createInitialState(0);
    s = bumpLifetime(s, { wood: 3 });
    s = bumpLifetime(s, { wood: 4, acorns: 1 });
    expect(s.lifetime).toEqual({ gold: 0, wood: 7, acorns: 1, fish: 0 });
  });
});
