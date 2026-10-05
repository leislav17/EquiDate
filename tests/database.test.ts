import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const published = '00000000-0000-4000-8000-000000000001';
const draft = '00000000-0000-4000-8000-000000000002';
const docId = '00000000-0000-4000-8000-000000000003';
const dayId = '00000000-0000-4000-8000-000000000004';
const classId = '00000000-0000-4000-8000-000000000005';
const draftDay = '00000000-0000-4000-8000-000000000006';
const draftClass = '00000000-0000-4000-8000-000000000007';
const draftDoc = '00000000-0000-4000-8000-000000000008';

test('Incremental migration preserves records and enforces RLS and associations', async context => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
    GRANT SELECT ON storage.objects TO anon;
  `);
  const schema = (await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')).replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '');
  await db.exec(schema);
  await db.query(`INSERT INTO events(id,name,venue,start_date,end_date,status) VALUES
    ($1,'Publicado','Club','2026-10-04','2026-10-05','published'),
    ($2,'Borrador','Club','2026-10-04','2026-10-05','draft')`, [published, draft]);
  await db.query(`INSERT INTO documents(id,event_id,name,type,event_date,storage_path,mime_type) VALUES
    ($1,$2,'Existente','START_LIST','2026-10-04','old.jpg','image/jpeg'),
    ($3,$4,'Privado','RESULT','2026-10-04','private.jpg','image/jpeg')`, [docId, published, draftDoc, draft]);
  await db.query(`INSERT INTO document_pages(document_id,storage_path,mime_type) VALUES
    ($1,'old-page.jpg','image/jpeg'),($2,'private-page.jpg','image/jpeg')`, [docId, draftDoc]);
  const before = (await db.query('SELECT * FROM document_pages ORDER BY id')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_competition_schedule.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('SELECT * FROM document_pages ORDER BY id')).rows, before);
  assert.equal((await db.query('SELECT * FROM events')).rows.length, 2);
  assert.equal((await db.query('SELECT * FROM documents')).rows.length, 2);
  await db.query(`INSERT INTO competition_days(id,event_id,event_date,youtube_url) VALUES
    ($1,$2,'2026-10-04','https://youtu.be/abcdefghijk'),
    ($3,$4,'2026-10-04','https://youtu.be/abcdefghijk'),
    (gen_random_uuid(),$2,'2026-10-05','https://youtu.be/abcdefghijk')`, [dayId, published, draftDay, draft]);
  await db.query(`INSERT INTO competition_classes(id,day_id,event_id,event_date,number,name,start_time)
    VALUES ($1,$2,$3,'2026-10-04','54','Libre 1.30','08:00'),($4,$5,$6,'2026-10-04','55','Privada','12:00')`,
    [classId, dayId, published, draftClass, draftDay, draft]);
  const asRole = async (role: string, admin: boolean, action: () => Promise<void>) => {
    await db.exec('SET ROLE ' + role);
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ app_metadata: { equidate_admin: admin } })]);
    try { await action(); } finally { await db.exec('RESET ROLE'); }
  };
  await context.test('Anonymous and ordinary authenticated readers only see published data', async () => {
    for (const role of ['anon', 'authenticated']) await asRole(role, false, async () => {
      for (const table of ['events', 'documents', 'document_pages', 'competition_classes']) {
        assert.equal((await db.query('SELECT * FROM ' + table)).rows.length, 1, role + ' ' + table);
      }
      assert.equal((await db.query('SELECT * FROM competition_days')).rows.length, 2);
      await assert.rejects(db.query(`INSERT INTO competition_days(event_id,event_date) VALUES ($1,'2026-10-05')`, [draft]));
      await assert.rejects(db.query(`INSERT INTO events(name,venue,start_date,end_date) VALUES ('No','No','2026-10-04','2026-10-05')`));
      if (role === 'authenticated') {
        assert.equal((await db.query("UPDATE events SET name='Hacked' WHERE id=$1 RETURNING id", [published])).rows.length, 0);
        assert.equal((await db.query("DELETE FROM documents WHERE id=$1 RETURNING id", [docId])).rows.length, 0);
        await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('event-documents','bad')"));
        await assert.rejects(db.query("SELECT equidate_save_document('{}',null)"));
      }
    });
  });
  await context.test('Explicit admin can manage all rows and storage', async () => {
    await asRole('authenticated', true, async () => {
      assert.equal((await db.query('SELECT * FROM events')).rows.length, 2);
      await db.query("UPDATE competition_classes SET start_time='08:15' WHERE id=$1", [classId]);
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('event-documents','ok')");
      await db.query('UPDATE documents SET class_id=$1 WHERE id=$2', [classId, docId]);
    });
  });
  await context.test('Cross-event, cross-date, invalid dates and linked deletions are rejected', async () => {
    await asRole('authenticated', true, async () => {
      await assert.rejects(db.query('UPDATE documents SET class_id=$1 WHERE id=$2', [draftClass, docId]));
      await assert.rejects(db.query("UPDATE documents SET event_date='2026-10-05' WHERE id=$1", [docId]));
      await assert.rejects(db.query("UPDATE documents SET type='PROGRAM' WHERE id=$1", [docId]));
      await assert.rejects(db.query('DELETE FROM competition_classes WHERE id=$1', [classId]));
      await assert.rejects(db.query("INSERT INTO competition_days(event_id,event_date) VALUES ($1,'2026-11-01')", [published]));
      await assert.rejects(db.query("UPDATE competition_days SET time_zone='Invalid/Zone' WHERE id=$1", [dayId]));
      await assert.rejects(db.query("UPDATE events SET end_date='2026-10-03' WHERE id=$1", [published]));
    });
  });
  await context.test('Document save is atomic, metadata edits preserve pages, and failed replacements roll back', async () => {
    const payload = { id: docId, event_id: published, name: 'Editado', type: 'START_LIST', event_date: '2026-10-04',
      class_id: classId, storage_path: 'old.jpg', mime_type: 'image/jpeg', sort_order: 1 };
    await asRole('authenticated', true, async () => {
      await db.query('SELECT equidate_save_document($1,null)', [JSON.stringify(payload)]);
      assert.deepEqual((await db.query('SELECT * FROM document_pages ORDER BY id')).rows, before);
      await assert.rejects(db.query('SELECT equidate_save_document($1,$2)', [JSON.stringify({ ...payload, name: 'Fallido' }), JSON.stringify([{ storage_path: null, mime_type: 'image/jpeg', sort_order: 1 }])]));
      assert.equal((await db.query<{ name: string }>('SELECT name FROM documents WHERE id=$1', [docId])).rows[0].name, 'Editado');
      assert.deepEqual((await db.query('SELECT * FROM document_pages ORDER BY id')).rows, before);
      await db.query('SELECT equidate_save_document($1,$2)', [JSON.stringify(payload), JSON.stringify([{ storage_path: 'new.jpg', mime_type: 'image/jpeg', sort_order: 1 }])]);
      assert.equal((await db.query<{ storage_path: string }>('SELECT storage_path FROM document_pages WHERE document_id=$1', [docId])).rows[0].storage_path, 'new.jpg');
    });
  });
  await db.close();
});
