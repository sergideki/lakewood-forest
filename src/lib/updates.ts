// Update-check logic for the sideloaded Android APK. The pure comparison below is unit-tested;
// the network + install side effects live in the UI layer (Settings) behind Platform checks.

export const RELEASES_LATEST_API =
  'https://api.github.com/repos/sergideki/lakewood-forest/releases/latest';

export interface ReleaseInfo {
  version: string;              // tag without a leading "v" (e.g. "1.1.0")
  htmlUrl: string;             // release page (fallback link)
  apkUrl: string | null;      // browser_download_url of the first .apk asset, if any
}

/** Strip a leading v/V and split into numeric components; non-numeric parts become 0. */
function parts(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((p) => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/** Semver-ish compare: -1 if a<b, 0 if equal, 1 if a>b. Compares component by component. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** True when `latest` is a strictly newer version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}

/** Map the GitHub "latest release" JSON to our ReleaseInfo, or null if it isn't usable. */
export function parseRelease(json: unknown): ReleaseInfo | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as {
    tag_name?: unknown;
    html_url?: unknown;
    assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
  };
  if (typeof r.tag_name !== 'string' || typeof r.html_url !== 'string') return null;
  const apkAsset = Array.isArray(r.assets)
    ? r.assets.find((a) => typeof a?.name === 'string' && (a.name as string).toLowerCase().endsWith('.apk'))
    : undefined;
  const apkUrl =
    apkAsset && typeof apkAsset.browser_download_url === 'string' ? apkAsset.browser_download_url : null;
  return { version: r.tag_name.replace(/^v/i, ''), htmlUrl: r.html_url, apkUrl };
}
