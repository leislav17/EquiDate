import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Slug migration preserves existing rows, creates unique stable URLs and keeps RLS', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
        venue text NOT NULL, start_date date NOT NULL, end_date date NOT NULL, status text NOT NULL DEFAULT 'published',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
      CREATE FUNCTION handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
      CREATE TRIGGER tr_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
      ALTER TABLE events ENABLE ROW LEVEL SECURITY;
      CREATE POLICY public_read ON events FOR SELECT TO anon USING (status = 'published');
      CREATE POLICY admin_write ON events TO authenticated USING (true) WITH CHECK (true);
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT SELECT ON events TO anon; GRANT ALL ON events TO authenticated;
      INSERT INTO events(name,venue,start_date,end_date,updated_at) VALUES
        ('Polo Jumping Tour - San Diego','Club','2026-10-30','2026-11-01','2020-01-01'),
        ('San Jorge Village','Club','2026-11-06','2026-11-08','2020-01-01'),
        ('San Jorge Village - preliminar','Club','2026-11-14','2026-11-14','2020-01-01'),
        ('San Jorge Village - pasadas preliminar','Club','2026-11-11','2026-11-11','2020-01-01'),
        ('Polo Jumping Tour - San Diego','Club','2027-10-30','2027-11-01','2020-01-01');
    `);
    const before = (await db.query<Record<string, unknown>>('select * from events order by id')).rows;
    await db.exec(await readFile(new URL('../supabase/migrations/20261101000804_event_slugs.sql', import.meta.url), 'utf8'));
    const after = (await db.query<{ id: string; slug: string }>('select * from events order by id')).rows;
    assert.deepEqual(after.map(({ slug, ...row }) => row), before);
    assert.deepEqual(new Set(after.map(row => row.slug)), new Set(['san-diego', 'san-diego-2', 'sjv', 'sjv-preliminar', 'sjv-pasadas-preliminar']));
    const create = (name: string, slug?: string) => db.query<{ id: string; slug: string }>('insert into events(name,venue,start_date,end_date,slug) values ($1,\'Club\',\'2028-01-01\',\'2028-01-01\',$2) returning id,slug', [name, slug ?? null]);
    assert.equal((await create('Día de Caballos Jóvenes')).rows[0].slug, 'dia-de-caballos-jovenes');
    assert.equal((await create('Otro', 'mi-concurso')).rows[0].slug, 'mi-concurso');
    for (const invalid of ['admin', 'assets', 'event', 'concurso', 'a/b', 'á', 'a--b', 'a'.repeat(121), 'san-diego']) await assert.rejects(create('No válido', invalid));
    const original = after[0];
    await db.query('update events set name=\'Nuevo nombre\' where id=$1', [original.id]);
    assert.equal((await db.query<{ slug: string }>('select slug from events where id=$1', [original.id])).rows[0].slug, original.slug);
    await assert.rejects(db.query('update events set slug=\'otro\' where id=$1', [original.id]));
    await db.exec("update events set status='draft' where slug='sjv'; SET ROLE anon;");
    assert.equal((await db.query("select * from events where slug='sjv'")).rows.length, 0);
    await assert.rejects(create('No autorizado'));
    await db.exec('RESET ROLE; SET ROLE authenticated;');
    assert.equal((await create('Polo Jumping Tour - San Diego')).rows[0].slug, 'san-diego-3');
  } finally { await db.close(); }
});
