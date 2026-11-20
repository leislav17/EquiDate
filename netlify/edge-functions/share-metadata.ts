import { eventReference } from '../../src/utils/navigation.ts';
import {
  DEFAULT_SHARE_TITLE,
  injectOgTitle,
  resolveShareTitle,
  resolveStaticShareTitle,
  type ShareEvent,
} from '../../src/utils/shareMetadata.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATIC_ASSET_EXT_REGEX = /\.[a-z0-9]{1,8}$/i;

export interface EdgeContext {
  next: () => Promise<Response>;
}

export interface EdgeEnvReader {
  get: (key: string) => string | undefined;
}

function getDefaultEnvReader(): EdgeEnvReader {
  const runtime = globalThis as {
    Netlify?: { env?: EdgeEnvReader };
    Deno?: { env?: EdgeEnvReader };
  };
  return {
    get: (key: string) =>
      runtime.Netlify?.env?.get(key) ??
      runtime.Deno?.env?.get(key) ??
      (typeof process !== 'undefined' ? process.env?.[key] : undefined),
  };
}

export async function fetchPublishedEventForRoute(
  reference: string,
  env: EdgeEnvReader = getDefaultEnvReader(),
  fetchImpl: typeof fetch = fetch
): Promise<ShareEvent[]> {
  if (!reference || reference === '!invalid') return [];

  const supabaseUrl = (env.get('SUPABASE_URL') || env.get('VITE_SUPABASE_URL') || '').trim().replace(/\/+$/, '');
  const supabaseAnonKey = (env.get('SUPABASE_ANON_KEY') || env.get('VITE_SUPABASE_ANON_KEY') || '').trim();
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const normalized = reference.toLowerCase();
  const filter = UUID_REGEX.test(normalized)
    ? `id=eq.${encodeURIComponent(normalized)}`
    : `slug=eq.${encodeURIComponent(normalized)}`;

  const endpoint = `${supabaseUrl}/rest/v1/events?select=id,slug,name,status&status=eq.published&${filter}&limit=1`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetchImpl(endpoint, {
        method: 'GET',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const rows = (await res.json()) as unknown;
      return Array.isArray(rows) ? (rows as ShareEvent[]) : [];
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

export async function resolveEdgeShareTitle(
  url: URL,
  env: EdgeEnvReader = getDefaultEnvReader(),
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const location = { pathname: url.pathname, search: url.search, hash: '' };
  const staticTitle = resolveStaticShareTitle(location);
  if (staticTitle !== null) return staticTitle;

  const reference = eventReference(location);
  if (!reference || reference === '!invalid') return DEFAULT_SHARE_TITLE;

  const events = await fetchPublishedEventForRoute(reference, env, fetchImpl);
  return resolveShareTitle(location, events);
}

export default async function handler(request: Request, context: EdgeContext): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return context.next();
  }

  const url = new URL(request.url);
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/.netlify/') ||
    (STATIC_ASSET_EXT_REGEX.test(url.pathname) && !url.pathname.toLowerCase().endsWith('.html'))
  ) {
    return context.next();
  }

  const [response, ogTitle] = await Promise.all([
    context.next(),
    resolveEdgeShareTitle(url),
  ]);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html') || request.method === 'HEAD') {
    return response;
  }

  if (ogTitle === DEFAULT_SHARE_TITLE) {
    return response;
  }

  const html = await response.text();
  const updatedHtml = injectOgTitle(html, ogTitle);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const config = {
  path: '/*',
  excludedPath: [
    '/assets/*',
    '/.netlify/*',
    '/*.png',
    '/*.jpg',
    '/*.jpeg',
    '/*.webp',
    '/*.svg',
    '/*.ico',
    '/*.css',
    '/*.js',
    '/*.mjs',
    '/*.map',
    '/*.json',
    '/*.txt',
    '/*.xml',
    '/*.woff',
    '/*.woff2',
  ],
};
