import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SHARE_TITLE,
  injectOgTitle,
  resolveShareTitle,
  resolveStaticShareTitle,
  type ShareEvent,
} from '../src/utils/shareMetadata.ts';
import handler, { resolveEdgeShareTitle } from '../netlify/edge-functions/share-metadata.ts';

const eventId = 'ee4102fa-c37b-49a2-b6f4-15571b24dc2f';
const draftId = '11111111-2222-4333-8444-555555555555';

const events: ShareEvent[] = [
  { id: eventId, slug: 'san-diego', name: 'San Diego', status: 'published' },
  { id: draftId, slug: 'borrador', name: 'Concurso Privado', status: 'draft' },
];

const loc = (pathname = '/', search = '', hash = '') => ({ pathname, search, hash });

test('Static and discipline routes resolve to exact og:title strings without brackets', () => {
  assert.equal(resolveShareTitle(loc('/'), events), 'EquiDate');
  assert.equal(resolveShareTitle(loc('/jumping'), events), 'EquiDate | Salto');
  assert.equal(resolveShareTitle(loc('/jumping/'), events), 'EquiDate | Salto');
  assert.equal(resolveShareTitle(loc('/dressage'), events), 'EquiDate | Adiestramiento');
  assert.equal(resolveShareTitle(loc('/training'), events), 'EquiDate | Pasadas');
  assert.equal(resolveShareTitle(loc('/buscar/jinetes'), events), 'EquiDate | Buscar jinetes');
  assert.equal(resolveShareTitle(loc('/informacion-util'), events), 'EquiDate | Información útil');
  assert.equal(resolveShareTitle(loc('/sponsors'), events), 'EquiDate | Sponsors');
  assert.equal(resolveShareTitle(loc('/admin'), events), 'EquiDate | Admin');
  assert.equal(resolveShareTitle(loc('/admin/concursos'), events), 'EquiDate | Admin');
  assert.equal(resolveShareTitle(loc('/admin/jinetes'), events), 'EquiDate | Admin');
  assert.equal(resolveShareTitle(loc('/', '', '#/admin'), events), 'EquiDate | Admin');
  assert.equal(resolveShareTitle(loc('/ruta-inexistente'), events), 'EquiDate');
});

test('Competition and sub-resource routes resolve to EquiDate | Nombre del concurso', () => {
  assert.equal(resolveShareTitle(loc('/san-diego'), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc('/SAN-DIEGO/'), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc(`/event/${eventId}`), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc('/', `?event=${eventId}`), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc('/san-diego/document/doc-1'), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc('/san-diego/start-list/class-1'), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc('/san-diego/results/class-1'), events), 'EquiDate | San Diego');
  assert.equal(resolveShareTitle(loc('/san-diego/live-results/class-1'), events), 'EquiDate | San Diego');
});

test('Transmission routes resolve to EquiDate | Transmisión en vivo · Nombre del concurso regardless of arena', () => {
  assert.equal(
    resolveShareTitle(loc('/san-diego/transmission/day-1'), events),
    'EquiDate | Transmisión en vivo · San Diego'
  );
  assert.equal(
    resolveShareTitle(loc('/san-diego/transmission/day-1/arena-2'), events),
    'EquiDate | Transmisión en vivo · San Diego'
  );
  assert.equal(
    resolveShareTitle(loc('/san-diego', '', '#transmission/day-1/arena-2'), events),
    'EquiDate | Transmisión en vivo · San Diego'
  );
});

test('Draft competitions and malformed URLs fall back to EquiDate', () => {
  assert.equal(resolveShareTitle(loc('/borrador'), events), DEFAULT_SHARE_TITLE);
  assert.equal(resolveShareTitle(loc(`/event/${draftId}`), events), DEFAULT_SHARE_TITLE);
  assert.equal(resolveShareTitle(loc('/%E0%A4%A'), events), DEFAULT_SHARE_TITLE);
});

test('resolveStaticShareTitle skips Supabase lookup on static routes and returns null on event routes', () => {
  assert.equal(resolveStaticShareTitle(loc('/')), 'EquiDate');
  assert.equal(resolveStaticShareTitle(loc('/buscar/jinetes')), 'EquiDate | Buscar jinetes');
  assert.equal(resolveStaticShareTitle(loc('/san-diego')), null);
  assert.equal(resolveStaticShareTitle(loc('/', `?event=${eventId}`)), null);
});

test('injectOgTitle updates og:title cleanly, escapes HTML attributes, and keeps og:image intact', () => {
  const sampleHtml = [
    '<!doctype html><html><head>',
    '<title>EquiDate</title>',
    '<meta property="og:title" content="EquiDate" />',
    '<meta property="og:description" content="Toda la info de tus concursos en un solo lugar" />',
    '<meta property="og:image" content="https://equidate.com.ar/equidate-share.jpg" />',
    '</head><body></body></html>',
  ].join('');

  const updated = injectOgTitle(sampleHtml, 'EquiDate | Copa $1000 & "Amigos" <2026>');
  assert.match(updated, /<meta property="og:title" content="EquiDate \| Copa \$1000 &amp; &quot;Amigos&quot; &lt;2026&gt;" \/>/);
  assert.match(updated, /<meta property="og:image" content="https:\/\/equidate\.com\.ar\/equidate-share\.jpg" \/>/);
  assert.match(updated, /<meta property="og:description" content="Toda la info de tus concursos en un solo lugar" \/>/);
});

test('Edge function resolves Supabase published events and handles failures safely', async () => {
  const env = {
    get: (key: string) => {
      if (key === 'VITE_SUPABASE_URL') return 'https://example.supabase.co';
      if (key === 'VITE_SUPABASE_ANON_KEY') return 'anon-key';
      return undefined;
    },
  };

  let fetchedUrl = '';
  const mockFetch = (async (input: RequestInfo | URL) => {
    fetchedUrl = String(input);
    return new Response(JSON.stringify([{ id: eventId, slug: 'san-diego', name: 'San Diego', status: 'published' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  const title = await resolveEdgeShareTitle(new URL('https://equidate.com.ar/san-diego/transmission/d1/a2'), env, mockFetch);
  assert.equal(title, 'EquiDate | Transmisión en vivo · San Diego');
  assert.match(fetchedUrl, /status=eq\.published/);
  assert.match(fetchedUrl, /slug=eq\.san-diego/);

  // Fails open to default title when fetch throws
  const failingFetch = (async () => {
    throw new Error('network error');
  }) as unknown as typeof fetch;
  const fallback = await resolveEdgeShareTitle(new URL('https://equidate.com.ar/san-diego'), env, failingFetch);
  assert.equal(fallback, 'EquiDate');
});

test('Edge handler rewrites static HTML routes and leaves image assets untouched', async () => {
  const baseHtml = '<head><meta property="og:title" content="EquiDate" /><meta property="og:image" content="https://equidate.com.ar/equidate-share.jpg" /></head>';

  const res = await handler(new Request('https://equidate.com.ar/buscar/jinetes'), {
    next: async () =>
      new Response(baseHtml, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'gzip',
          'content-length': '999',
        },
      }),
  });

  const body = await res.text();
  assert.match(body, /content="EquiDate \| Buscar jinetes"/);
  assert.match(body, /equidate-share\.jpg/);
  assert.equal(res.headers.get('content-encoding'), null);
  assert.equal(res.headers.get('content-length'), null);

  // Image asset passes straight through
  const imgRes = await handler(new Request('https://equidate.com.ar/equidate-share.jpg'), {
    next: async () => new Response('img-bytes', { status: 200, headers: { 'content-type': 'image/jpeg' } }),
  });
  assert.equal(await imgRes.text(), 'img-bytes');
});
