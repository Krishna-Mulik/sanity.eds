export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Drops the origin from a same-origin URL for display — a finding about
 * this site's own content doesn't need to repeat this site's own domain
 * (and it's especially noisy on `pnpm dev`, where it's just localhost:5173).
 * A genuinely cross-origin URL is left untouched, since there the domain
 * *is* the point (a third-party host, a different EDS environment, etc.).
 */
export function relativizeUrl(url: string, origin: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== origin) return url;
    return parsed.pathname + parsed.search + parsed.hash || '/';
  } catch {
    return url;
  }
}
