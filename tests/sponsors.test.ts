import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import {
  groupSponsorsByCategory,
  isSponsorActiveOnDate,
  normalizeSponsorCategoryName,
  resolveDirectorySponsors,
  resolveSponsorsForSlot,
  safeSponsorUrl,
} from '../src/utils/sponsors.ts';
import type { SponsorCategory, SponsorItem } from '../src/types/equestrian.ts';

const baseSponsor = (overrides: Partial<SponsorItem> = {}): SponsorItem => ({
  id: 's1',
  name: 'Sponsor Test',
  imageUrl: 'https://cdn.example.com/logo.png',
  categoryId: null,
  scope: 'global',
  eventId: null,
  placement: 'all',
  variant: 'logo_card',
  sortOrder: 10,
  active: true,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...overrides,
});

const baseCategory = (overrides: Partial<SponsorCategory> = {}): SponsorCategory => ({
  id: 'cat-1',
  name: 'Talabartería',
  sortOrder: 10,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...overrides,
});

test('Sponsor URL safety, category normalization, and date-range helpers validate inputs strictly', () => {
  assert.equal(safeSponsorUrl('https://talabarteria.com.ar/promo?utm=1'), true);
  assert.equal(safeSponsorUrl('http://club.org.ar'), true);
  assert.equal(safeSponsorUrl('javascript:alert(1)'), false);
  assert.equal(safeSponsorUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(safeSponsorUrl('https://user:pass@evil.com'), false);
  assert.equal(safeSponsorUrl(''), false);
  assert.equal(safeSponsorUrl(null), false);

  assert.equal(normalizeSponsorCategoryName('  Fotos  &   videos  '), 'Fotos & videos');

  assert.equal(isSponsorActiveOnDate(baseSponsor({ active: false }), '2026-11-23'), false);
  assert.equal(
    isSponsorActiveOnDate(baseSponsor({ startsAt: '2026-11-24' }), '2026-11-23'),
    false
  );
  assert.equal(
    isSponsorActiveOnDate(baseSponsor({ endsAt: '2026-11-22' }), '2026-11-23'),
    false
  );
  assert.equal(
    isSponsorActiveOnDate(
      baseSponsor({ startsAt: '2026-11-23', endsAt: '2026-11-23' }),
      '2026-11-23'
    ),
    true
  );
});

test('resolveSponsorsForSlot handles global slots, event priority, and exclusivity', () => {
  const sponsors: SponsorItem[] = [
    baseSponsor({ id: 'g-home', name: 'Home Only', placement: 'home', sortOrder: 20 }),
    baseSponsor({ id: 'g-foot', name: 'Footer Only', placement: 'listings_footer', sortOrder: 10 }),
    baseSponsor({ id: 'g-all', name: 'Global All', placement: 'all', sortOrder: 30 }),
    baseSponsor({
      id: 'g-expired',
      name: 'Expired',
      placement: 'all',
      endsAt: '2026-11-20',
      sortOrder: 1,
    }),
    baseSponsor({
      id: 'e1-s1',
      name: 'Event 1 Sponsor',
      scope: 'event',
      eventId: 'ev-1',
      placement: 'event_detail',
      sortOrder: 5,
    }),
  ];

  // Home footer shows global home + all sorted by sortOrder
  assert.deepEqual(
    resolveSponsorsForSlot(sponsors, { slot: 'home_footer', todayStr: '2026-11-23' }).map(
      (s) => s.id
    ),
    ['g-home', 'g-all']
  );

  // Event 1 detail has its own sponsor -> replaces global fallback cleanly
  assert.deepEqual(
    resolveSponsorsForSlot(sponsors, {
      slot: 'event_detail',
      eventId: 'ev-1',
      todayStr: '2026-11-23',
    }).map((s) => s.id),
    ['e1-s1']
  );

  // Event 2 detail has no event sponsors -> falls back to global 'all' unless hidden
  assert.deepEqual(
    resolveSponsorsForSlot(sponsors, {
      slot: 'event_detail',
      eventId: 'ev-2',
      todayStr: '2026-11-23',
    }).map((s) => s.id),
    ['g-all']
  );
  assert.deepEqual(
    resolveSponsorsForSlot(sponsors, {
      slot: 'event_detail',
      eventId: 'ev-2',
      hideGlobalSponsors: true,
      todayStr: '2026-11-23',
    }),
    []
  );

  // Listings footer on RiderSearch (no eventId) -> global listings_footer + all
  assert.deepEqual(
    resolveSponsorsForSlot(sponsors, { slot: 'listings_footer', todayStr: '2026-11-23' }).map(
      (s) => s.id
    ),
    ['g-foot', 'g-all']
  );

  // Listings footer on Event 1 with exclusivity -> only Event 1 sponsors
  assert.deepEqual(
    resolveSponsorsForSlot(sponsors, {
      slot: 'listings_footer',
      eventId: 'ev-1',
      hideGlobalSponsors: true,
      todayStr: '2026-11-23',
    }).map((s) => s.id),
    ['e1-s1']
  );

  // Sponsors EquiDate directory shows all active global sponsors (home + listings_footer + all), excluding event-only and expired
  assert.deepEqual(
    resolveDirectorySponsors(sponsors, '2026-11-23').map((s) => s.id),
    ['g-foot', 'g-home', 'g-all']
  );
});

test('groupSponsorsByCategory orders groups by category sortOrder, skips empty categories, and trails uncategorized', () => {
  const categories: SponsorCategory[] = [
    baseCategory({ id: 'cat-haras', name: 'Haras', sortOrder: 30 }),
    baseCategory({ id: 'cat-fotos', name: 'Fotos & videos', sortOrder: 10 }),
    baseCategory({ id: 'cat-empty', name: 'Club', sortOrder: 20 }),
  ];

  const items: SponsorItem[] = [
    baseSponsor({ id: 's-none', name: 'Sin Cat', categoryId: null }),
    baseSponsor({ id: 's-haras-1', name: 'Haras A', categoryId: 'cat-haras' }),
    baseSponsor({ id: 's-fotos-1', name: 'Fotos A', categoryId: 'cat-fotos' }),
    baseSponsor({ id: 's-orphan', name: 'Cat Borrada', categoryId: 'deleted-id' }),
  ];

  const groups = groupSponsorsByCategory(items, categories);
  assert.deepEqual(
    groups.map((g) => ({
      category: g.category?.name ?? null,
      ids: g.items.map((i) => i.id),
    })),
    [
      { category: 'Fotos & videos', ids: ['s-fotos-1'] },
      { category: 'Haras', ids: ['s-haras-1'] },
      { category: null, ids: ['s-none', 's-orphan'] },
    ]
  );

  assert.deepEqual(groupSponsorsByCategory([], categories), []);
});

test('Sponsors and categories SQL migrations enforce RLS, admin-only writes, and integrity constraints', async (t) => {
  const db = new PGlite();
  const publishedEventId = '00000000-0000-4000-8000-000000000101';
  const draftEventId = '00000000-0000-4000-8000-000000000102';

  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE FUNCTION public.equidate_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT COALESCE(auth.jwt()->'app_metadata'->'equidate_admin' = 'true'::jsonb, false)
        OR COALESCE(auth.jwt()->'app_metadata'->>'role' = 'superadmin', false)
    $$;
    CREATE TABLE public.events (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'draft'
    );
    GRANT SELECT ON public.events TO anon, authenticated;
    INSERT INTO public.events (id, name, status) VALUES
      ('${publishedEventId}', 'Concurso Publicado', 'published'),
      ('${draftEventId}', 'Concurso Borrador', 'draft');
  `);

  await db.exec(
    await readFile(new URL('../supabase/migrations/20261123120000_sponsors.sql', import.meta.url), 'utf8')
  );
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20261123150000_sponsor_categories.sql', import.meta.url),
      'utf8'
    )
  );

  const asRole = async (who: string, claims: object, fn: () => Promise<void>) => {
    await db.exec(`SET ROLE ${who}`);
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    try {
      await fn();
    } finally {
      await db.exec('RESET ROLE');
    }
  };

  const adminClaims = { sub: '00000000-0000-4000-8000-000000000099', app_metadata: { equidate_admin: true } };

  await t.test('Seeded categories exist and admin can manage categories and categorized sponsors', async () => {
    await asRole('authenticated', adminClaims, async () => {
      const seeded = (
        await db.query<{ id: string; name: string }>(
          'SELECT id, name FROM public.sponsor_categories ORDER BY sort_order'
        )
      ).rows;
      assert.deepEqual(
        seeded.map((c) => c.name),
        ['Fotos & videos', 'Talabartería', 'Haras', 'Club']
      );

      // Reject case-insensitive / trimmed duplicate category
      await assert.rejects(
        db.query("INSERT INTO public.sponsor_categories (name, sort_order) VALUES ('  haras ', 50)")
      );

      // Admin can add custom category
      const customCat = (
        await db.query<{ id: string }>(
          "INSERT INTO public.sponsor_categories (name, sort_order) VALUES ('Veterinaria', 50) RETURNING id"
        )
      ).rows[0];

      await db.query(
        `
          INSERT INTO public.sponsors (name, image_url, target_url, category_id, scope, placement, variant, sort_order, active)
          VALUES
            ('Global Activo', 'https://cdn.example.com/g1.png', 'https://example.com', $1, 'global', 'all', 'logo_card', 10, true),
            ('Global Pausado', 'https://cdn.example.com/g2.png', NULL, $2, 'global', 'home', 'banner', 20, false)
        `,
        [seeded[1].id, customCat.id]
      );
      await db.query(`
        INSERT INTO public.sponsors (name, image_url, scope, event_id, placement, active)
        VALUES
          ('Sponsor Publicado', 'https://cdn.example.com/e1.png', 'event', '${publishedEventId}', 'event_detail', true),
          ('Sponsor Borrador', 'https://cdn.example.com/e2.png', 'event', '${draftEventId}', 'event_detail', true)
      `);

      // Deleting category keeps sponsor with category_id = NULL
      await db.query('DELETE FROM public.sponsor_categories WHERE id = $1', [customCat.id]);
      const pausedRow = (
        await db.query<{ category_id: string | null }>(
          "SELECT category_id FROM public.sponsors WHERE name = 'Global Pausado'"
        )
      ).rows[0];
      assert.equal(pausedRow.category_id, null);

      // Reject javascript: target_url
      await assert.rejects(
        db.query(`
          INSERT INTO public.sponsors (name, image_url, target_url, scope, placement)
          VALUES ('Bad Link', 'https://cdn.example.com/a.png', 'javascript:alert(1)', 'global', 'home')
        `)
      );

      // Reject mismatched scope/event_id
      await assert.rejects(
        db.query(`
          INSERT INTO public.sponsors (name, image_url, scope, event_id, placement)
          VALUES ('Mismatched', 'https://cdn.example.com/a.png', 'global', '${publishedEventId}', 'home')
        `)
      );

      // Reject starts_at > ends_at
      await assert.rejects(
        db.query(`
          INSERT INTO public.sponsors (name, image_url, scope, placement, starts_at, ends_at)
          VALUES ('Bad Dates', 'https://cdn.example.com/a.png', 'global', 'home', '2026-12-10', '2026-12-01')
        `)
      );
    });
  });

  await t.test('Anonymous and forged-metadata users read categories & published active sponsors, and cannot write', async () => {
    for (const roleName of ['anon', 'authenticated']) {
      await asRole(roleName, { user_metadata: { equidate_admin: true, role: 'superadmin' } }, async () => {
        const cats = (
          await db.query<{ name: string }>('SELECT name FROM public.sponsor_categories ORDER BY sort_order')
        ).rows;
        assert.deepEqual(
          cats.map((c) => c.name),
          ['Fotos & videos', 'Talabartería', 'Haras', 'Club']
        );

        const visible = (await db.query<{ name: string }>('SELECT name FROM public.sponsors ORDER BY name')).rows;
        assert.deepEqual(
          visible.map((r) => r.name),
          ['Global Activo', 'Sponsor Publicado']
        );

        await assert.rejects(
          db.query("INSERT INTO public.sponsor_categories (name, sort_order) VALUES ('Intrusa', 99)")
        );

        await assert.rejects(
          db.query(`
            INSERT INTO public.sponsors (name, image_url, scope, placement)
            VALUES ('Intruso', 'https://cdn.example.com/x.png', 'global', 'home')
          `)
        );
      });
    }
  });

  await db.close();
});
