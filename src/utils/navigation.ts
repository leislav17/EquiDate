export const NAVIGATION_EVENT = 'equidate:navigation';

export interface RouteLocation { pathname: string; search: string; hash: string }
export interface RoutableEvent { id: string; slug?: string; status: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminRoute({ pathname, hash }: RouteLocation): boolean {
  return /^\/admin(?:\/|$)/i.test(pathname) || /^#\/?admin(?:[/?]|$)/i.test(hash);
}

export function eventPath(event: Pick<RoutableEvent, 'id' | 'slug'>): string {
  return event.slug ? '/' + encodeURIComponent(event.slug) : '/event/' + encodeURIComponent(event.id);
}

export function eventReference(location: RouteLocation): string | null {
  if (isAdminRoute(location)) return null;
  if (location.pathname.replace(/\/+$/, '') === '/buscar/jinetes') return null;
  let path: string;
  try { path = decodeURIComponent(location.pathname).replace(/\/+$/, ''); } catch { return '!invalid'; }
  const legacy = path.match(/^\/(?:events?|concursos?)\/([^/]+)$/i);
  if (legacy) return legacy[1];
  const resource = path.match(/^\/([^/]+)\/(?:document|start-list|results|transmission)\/.+$/);
  if (resource) return resource[1];
  if (path) return path.slice(1);
  const hash = location.hash.match(/^#\/?(?:event\/|event-|concurso\/)([^/?#]+)$/i);
  return hash?.[1] || new URLSearchParams(location.search).get('event');
}

export function resolveEvent(location: RouteLocation, events: RoutableEvent[], isAdmin = false): RoutableEvent | undefined {
  const reference = eventReference(location);
  if (!reference) return undefined;
  return events.find(event => (isAdmin || event.status === 'published') &&
    (event.slug === reference?.toLowerCase() || (uuid.test(reference || '') && event.id.toLowerCase() === reference?.toLowerCase())));
}

export function readLocation(): RouteLocation {
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash };
}

export function navigate(url: string, replace = false): void {
  if (url === window.location.pathname + window.location.search + window.location.hash) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function navigateHash(hash: string): void {
  const normalized = hash ? '#' + hash.replace(/^#/, '') : '';
  const suffix = resourceSuffix(normalized);
  const base = window.location.pathname.split('/')[1];
  if (!normalized && base && resourceHash(readLocation()) && !window.location.hash) {
    navigate('/' + base + window.location.search);
    return;
  }
  if (suffix && base && !['admin', 'event', 'events', 'concurso', 'concursos'].includes(base)) {
    navigate('/' + base + suffix + window.location.search);
  } else navigate(window.location.pathname + window.location.search + normalized);
}

export function resourceHash(location: RouteLocation): string {
  if (/^(#document-|#transmission\/|#start-list\/|#results\/)/.test(location.hash)) return location.hash;
  const match = location.pathname.replace(/\/+$/, '').match(/^\/[^/]+\/(document|start-list|results|transmission)\/(.+)$/);
  return match ? '#' + match[1] + (match[1] === 'document' ? '-' : '/') + match[2] : '';
}

export function resourceSuffix(hash: string): string {
  if (hash.startsWith('#document-')) return '/document/' + hash.slice(10);
  const match = hash.match(/^#(start-list|results|transmission)\/(.+)$/);
  return match ? '/' + match[1] + '/' + match[2] : '';
}

/** Retain legacy hash links, including opening in a new tab. Use History API for SPA clicks. */
export function installHashNavigation(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    const hash = anchor.getAttribute('href') || '';
    if (hash !== '#' && !/^#(?:document-|transmission\/|start-list\/|results\/)/.test(hash)) return;
    event.preventDefault();
    navigateHash(hash === '#' ? '' : hash);
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}

export function subscribeNavigation(listener: () => void): () => void {
  const events = ['popstate', 'hashchange', NAVIGATION_EVENT];
  for (const name of events) window.addEventListener(name, listener);
  return () => { for (const name of events) window.removeEventListener(name, listener); };
}
