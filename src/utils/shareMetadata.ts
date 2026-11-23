import { eventReference, isAdminRoute, resolveEvent, resourceHash, type RouteLocation } from './navigation.ts';

export const DEFAULT_SHARE_TITLE = 'EquiDate';

export interface ShareEvent {
  id: string;
  slug?: string;
  name: string;
  status: string;
}

function normalizePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname).replace(/\/+$/, '').toLowerCase() || '/';
  } catch {
    return '';
  }
}

/**
 * Resolves og:title for non-competition routes without querying event data.
 * Returns null when the route references a competition that must be looked up.
 */
export function resolveStaticShareTitle(location: RouteLocation): string | null {
  if (isAdminRoute(location)) return 'EquiDate | Admin';

  const normalizedPath = normalizePathname(location.pathname);
  if (!normalizedPath) return DEFAULT_SHARE_TITLE;

  switch (normalizedPath) {
    case '/buscar/jinetes':
      return 'EquiDate | Buscar jinetes';
    case '/informacion-util':
      return 'EquiDate | Información útil';
    case '/sponsors':
      return 'EquiDate | Sponsors';
    case '/jumping':
      return 'EquiDate | Salto';
    case '/dressage':
      return 'EquiDate | Adiestramiento';
    case '/training':
      return 'EquiDate | Pasadas';
    default:
      break;
  }

  if (eventReference(location)) return null;
  return DEFAULT_SHARE_TITLE;
}

export function resolveShareTitle(location: RouteLocation, events: ShareEvent[]): string {
  const staticTitle = resolveStaticShareTitle(location);
  if (staticTitle !== null) return staticTitle;

  const matched = resolveEvent(location, events, false);
  const event = matched ? events.find(item => item.id === matched.id) : undefined;
  const eventName = event?.name?.trim();
  if (!eventName) return DEFAULT_SHARE_TITLE;

  if (resourceHash(location).startsWith('#transmission/')) {
    return `EquiDate | Transmisión en vivo · ${eventName}`;
  }

  return `EquiDate | ${eventName}`;
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function injectOgTitle(html: string, ogTitle: string): string {
  const escaped = escapeHtmlAttr(ogTitle);
  const propertyFirst = /(<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["'])[^"']*(["'][^>]*>)/i;
  if (propertyFirst.test(html)) {
    return html.replace(propertyFirst, (_match, prefix, suffix) => `${prefix}${escaped}${suffix}`);
  }
  const contentFirst = /(<meta\b[^>]*\bcontent=["'])[^"']*(["'][^>]*\bproperty=["']og:title["'][^>]*>)/i;
  if (contentFirst.test(html)) {
    return html.replace(contentFirst, (_match, prefix, suffix) => `${prefix}${escaped}${suffix}`);
  }
  return html;
}
