import { describe, it, expect } from 'vitest';
import { compareVersions, isNewer, parseRelease } from '../../src/lib/updates';

describe('compareVersions', () => {
  it('orders by numeric component', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
  it('ignores a leading v and pads missing components', () => {
    expect(compareVersions('v1.1', '1.1.0')).toBe(0);
    expect(compareVersions('v1.2', 'v1.1.9')).toBe(1);
    expect(compareVersions('1', '1.0.0')).toBe(0);
  });
  it('treats non-numeric parts as 0', () => {
    expect(compareVersions('1.0.x', '1.0.0')).toBe(0);
  });
});

describe('isNewer', () => {
  it('is true only when latest strictly exceeds current', () => {
    expect(isNewer('1.1.0', '1.0.0')).toBe(true);
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', '1.1.0')).toBe(false);
    expect(isNewer('v1.0.1', '1.0.0')).toBe(true);
  });
});

describe('parseRelease', () => {
  it('extracts version, html url, and the first .apk asset', () => {
    const info = parseRelease({
      tag_name: 'v1.2.0',
      html_url: 'https://github.com/sergideki/lakewood-forest/releases/tag/v1.2.0',
      assets: [
        { name: 'source.zip', browser_download_url: 'https://x/source.zip' },
        { name: 'lakewood.apk', browser_download_url: 'https://x/lakewood.apk' },
      ],
    });
    expect(info).toEqual({
      version: '1.2.0',
      htmlUrl: 'https://github.com/sergideki/lakewood-forest/releases/tag/v1.2.0',
      apkUrl: 'https://x/lakewood.apk',
    });
  });
  it('returns apkUrl null when no .apk asset is present', () => {
    const info = parseRelease({ tag_name: '1.0.0', html_url: 'https://x/r', assets: [] });
    expect(info?.apkUrl).toBeNull();
    expect(info?.version).toBe('1.0.0');
  });
  it('returns null for malformed input', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({})).toBeNull();
    expect(parseRelease({ tag_name: 'v1' })).toBeNull(); // missing html_url
  });
});
