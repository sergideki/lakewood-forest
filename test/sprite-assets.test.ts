import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PET_IDS, CROP_IDS, createInitialState } from '../src/engine';

const ROOT = join(__dirname, '..');

/** Width/height straight from the PNG IHDR chunk (bytes 16-23). */
function pngSize(path: string): { w: number; h: number } {
  const buf = readFileSync(path);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const WATER_SPECIES = ['ripplefrog', 'puddleduck', 'koisprite', 'mistleotter'];
const VILLAGER_IDS = createInitialState(0).villagers.map((v) => v.id);

describe('sprite assets', () => {
  // 1 — mandatory presence + size. Villagers are CONDITIONAL (spec drop-path):
  //     absence allowed, but a present file must be 64×64.
  const mandatory: Array<[string, string[]]> = [
    ['creatures', WATER_SPECIES],
    ['pets', PET_IDS],
    ['crops', CROP_IDS],
  ];
  for (const [dir, ids] of mandatory) {
    for (const id of ids) {
      it(`assets/${dir}/${id}.png exists and is 64×64`, () => {
        const p = join(ROOT, 'assets', dir, `${id}.png`);
        expect(existsSync(p), `${p} missing`).toBe(true);
        expect(pngSize(p)).toEqual({ w: 64, h: 64 });
      });
    }
  }
  for (const id of VILLAGER_IDS) {
    it(`assets/villagers/${id}.png is 64×64 when present (drop-path allowed)`, () => {
      const p = join(ROOT, 'assets', 'villagers', `${id}.png`);
      if (existsSync(p)) expect(pngSize(p)).toEqual({ w: 64, h: 64 });
    });
  }

  // 2+3 — registry↔disk + key membership, by text-parsing sprites.ts
  //       (importing it would require() PNGs — breaks under node).
  it('every sprites.ts require() resolves and every key is a known id', () => {
    const src = readFileSync(join(ROOT, 'src/ui/sprites.ts'), 'utf8');
    const active = src.split('\n').filter((l) => !l.trim().startsWith('//'));
    const entries = active.join('\n').matchAll(
      /^\s*'?([\w-]+)'?:\s*require\('\.\.\/\.\.\/(assets\/[\w-]+\/[\w-]+\.png)'\)/gm,
    );
    const known = new Set([
      ...WATER_SPECIES,
      ...['fernling','pebblepup','mossmouse','barkbug','hedgehush','cedarcat','lumifox','owlin','stagheart','emberkit'],
      ...PET_IDS, ...CROP_IDS, ...VILLAGER_IDS,
    ]);
    let count = 0;
    for (const [, key, rel] of entries) {
      count += 1;
      expect(existsSync(join(ROOT, rel)), `${rel} referenced but missing`).toBe(true);
      expect(known.has(key), `registry key '${key}' is not a known id`).toBe(true);
    }
    expect(count).toBeGreaterThanOrEqual(10); // forest 10 minimum — regex must actually match
  });
});
