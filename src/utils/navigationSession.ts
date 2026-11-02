/** Temporary UI state only: never store contest data, rider names, searches or auth. */
export const NAVIGATION_STORAGE_KEY = 'equidate:navigation:v1';
export const NAVIGATION_TTL = 4 * 60 * 60 * 1000;
export interface NavigationEntry { at: number; open?: string[]; info?: boolean; scroll?: number; selection?: { kind: 'structured' | 'document'; id: string } | null }
export interface NavigationStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
function browserStorage(): NavigationStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; } catch { return undefined; }
}
function readAll(storage: NavigationStorage | undefined, now: number): Record<string, NavigationEntry> {
  try {
    const raw = JSON.parse(storage?.getItem(NAVIGATION_STORAGE_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([key, value]) => {
      const r = value as NavigationEntry;
      return key.length <= 400 && r && typeof r === 'object' && Number.isFinite(r.at) && r.at <= now && now - r.at < NAVIGATION_TTL;
    }).map(([key, value]) => {
      const r = value as NavigationEntry;
      const clean: NavigationEntry = { at: r.at };
      if (Array.isArray(r.open)) clean.open = [...new Set(r.open.filter(id => typeof id === 'string' && id.length <= 150))].slice(0,200);
      if (typeof r.info === 'boolean') clean.info = r.info;
      if (typeof r.scroll === 'number' && Number.isFinite(r.scroll) && r.scroll >= 0) clean.scroll = Math.min(r.scroll, 1000000);
      if (r.selection === null) clean.selection = null;
      else if (r.selection && ['structured','document'].includes(r.selection.kind) && typeof r.selection.id === 'string' && r.selection.id.length <= 150) clean.selection = { kind: r.selection.kind, id: r.selection.id };
      return [key, clean];
    }));
  } catch { return {}; }
}
export function readNavigationEntry(key: string, storage = browserStorage(), now = Date.now()): NavigationEntry | undefined {
  return readAll(storage, now)[key];
}
export function writeNavigationEntry(key: string, patch: Omit<Partial<NavigationEntry>, 'at'>, storage = browserStorage(), now = Date.now()): void {
  if (!storage) return;
  try {
    const entries = readAll(storage, now);
    entries[key] = { ...entries[key], ...patch, at: now };
    const bounded = Object.fromEntries(Object.entries(entries).sort((a,b) => b[1].at - a[1].at).slice(0,30));
    storage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(bounded));
  } catch { /* Private browsing or quota restrictions must not break navigation. */ }
}
export function removeNavigationEntry(key: string, storage = browserStorage(), now = Date.now()): void {
  try { const entries = readAll(storage, now); delete entries[key]; storage?.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(entries)); } catch { /* best effort */ }
}

/** Token refresh/refocus is not a change of data access. Only identity/authorization changes require a reset. */
export function sessionDataScope(session: { user: { id: string; app_metadata?: Record<string, unknown> } } | null): string {
  return session ? JSON.stringify([session.user.id, session.user.app_metadata?.equidate_admin === true, session.user.app_metadata?.role || null]) : 'anonymous';
}
