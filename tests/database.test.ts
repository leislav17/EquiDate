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
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, allowed_mime_types text[], file_size_limit bigint);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
    GRANT SELECT ON storage.objects TO anon;
    GRANT SELECT ON storage.buckets TO authenticated, anon;
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

  const existingPages = (await db.query('SELECT * FROM document_pages ORDER BY id')).rows;
  const existingDocs = (await db.query('SELECT * FROM documents ORDER BY id')).rows;
  const existingClasses = (await db.query('SELECT id, day_id, event_id, event_date, name FROM competition_classes ORDER BY id')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/20261006_arenas_streams.sql', import.meta.url), 'utf8'));
  const primary = (await db.query<{ id: string }>('SELECT id FROM competition_arenas WHERE event_id=$1 AND is_primary', [published])).rows[0].id;
  const privateArena = (await db.query<{ id: string }>('SELECT id FROM competition_arenas WHERE event_id=$1 AND is_primary', [draft])).rows[0].id;
  const secondary = '00000000-0000-4000-8000-000000000020';
  await context.test('Arena migration preserves every document/page and copies legacy streams to the primary arena', async () => {
    assert.deepEqual((await db.query('SELECT * FROM document_pages ORDER BY id')).rows, existingPages);
    assert.deepEqual((await db.query('SELECT * FROM documents ORDER BY id')).rows, existingDocs);
    assert.deepEqual((await db.query('SELECT id, day_id, event_id, event_date, name FROM competition_classes ORDER BY id')).rows, existingClasses);
    assert.equal((await db.query<{ arena_id: string }>('SELECT arena_id FROM competition_classes WHERE id=$1', [classId])).rows[0].arena_id, primary);
    assert.equal((await db.query('SELECT * FROM competition_streams')).rows.length, 3);
  });
  await context.test('One stream per day/arena, independent URLs and transaction rollback', async () => {
    await asRole('authenticated', true, async () => {
      await db.query("INSERT INTO competition_arenas(id,event_id,name) VALUES ($1,$2,'Pista de arena')", [secondary, published]);
      await db.query("SELECT equidate_save_stream($1,$2,'https://youtu.be/12345678901','America/Montevideo')", [dayId, secondary]);
      assert.equal((await db.query('SELECT * FROM competition_streams WHERE day_id=$1', [dayId])).rows.length, 2);
      assert.equal((await db.query<{ youtube_url: string }>('SELECT youtube_url FROM competition_streams WHERE day_id=$1 AND arena_id=$2', [dayId, primary])).rows[0].youtube_url, 'https://youtu.be/abcdefghijk');
      await assert.rejects(db.query("SELECT equidate_save_stream($1,$2,'https://youtu.be/abcdefghijk','Europe/Madrid')", [dayId, privateArena]));
      assert.equal((await db.query<{ time_zone: string }>('SELECT time_zone FROM competition_days WHERE id=$1', [dayId])).rows[0].time_zone, 'America/Montevideo');
      await db.query('UPDATE competition_classes SET arena_id=$1 WHERE id=$2', [secondary, classId]);
      await assert.rejects(db.query('UPDATE competition_classes SET arena_id=$1 WHERE id=$2', [privateArena, classId]));
      await assert.rejects(db.query('DELETE FROM competition_arenas WHERE id=$1', [secondary]));
      await assert.rejects(db.query('DELETE FROM competition_arenas WHERE id=$1', [primary]));
      await db.query("SELECT equidate_save_stream($1,$2,NULL,'America/Montevideo')", [dayId, secondary]);
      assert.equal((await db.query('SELECT * FROM competition_streams WHERE day_id=$1', [dayId])).rows.length, 1);
      assert.equal((await db.query('SELECT * FROM competition_classes WHERE arena_id=$1', [secondary])).rows.length, 1);
      await db.query("SELECT equidate_save_stream($1,$2,'https://youtu.be/abcdefghijk','America/Montevideo')", [dayId, secondary]);
      assert.equal((await db.query('SELECT * FROM competition_streams WHERE day_id=$1', [dayId])).rows.length, 2);
    });
  });
  await context.test('New list/result documents require a class, titles and dates are generated, legacy records remain assignable', async () => {
    await asRole('authenticated', true, async () => {
      await assert.rejects(db.query("INSERT INTO documents(event_id,name,type,mime_type) VALUES ($1,'Manual','START_LIST','application/pdf')", [published]));
      await db.query("INSERT INTO documents(event_id,class_id,name,type,event_date,mime_type) VALUES ($1,$2,'Ignored','RESULT','2026-01-01','application/pdf')", [published, classId]);
      const result = (await db.query<{ name: string; event_date: string }>("SELECT name,event_date::text FROM documents WHERE type='RESULT' AND class_id=$1", [classId])).rows[0];
      assert.equal(result.name, 'Resultados · Prueba 54 · Libre 1.30');
      assert.equal(result.event_date, '2026-10-04');
      await db.query("INSERT INTO documents(event_id,name,type,event_date,mime_type) VALUES ($1,'Ignored','PROGRAM','2026-10-04','application/pdf')", [published]);
      const program = (await db.query<{ name: string; event_date: string | null }>("SELECT name,event_date FROM documents WHERE type='PROGRAM'")).rows[0];
      assert.equal(program.name, 'Anteprograma');
      assert.equal(program.event_date, null);
      await assert.rejects(db.query('UPDATE documents SET class_id=NULL WHERE id=$1', [docId]));
      await db.query('UPDATE documents SET class_id=$1 WHERE id=$2', [draftClass, draftDoc]);
      assert.deepEqual((await db.query('SELECT * FROM document_pages ORDER BY id')).rows, existingPages);
    });
  });

  await db.exec(await readFile(new URL('../supabase/migrations/20261012_regulation_documents.sql', import.meta.url), 'utf8'));

  await context.test('Regulation migration supports general REGULATION documents with PDF and image pages', async () => {
    await asRole('authenticated', true, async () => {
      const regDocId = '00000000-0000-4000-8000-000000000030';
      // Save REGULATION via equidate_save_document with PDF and single page in page_payload
      const regPayload = {
        id: regDocId,
        event_id: published,
        name: 'Reglamento',
        type: 'REGULATION',
        event_date: null,
        class_id: null,
        storage_path: 'events/published/reglamento.pdf',
        mime_type: 'application/pdf',
        sort_order: 1,
      };
      const regPagePayload = [
        { storage_path: 'events/published/reglamento.pdf', mime_type: 'application/pdf', sort_order: 1 }
      ];
      await db.query('SELECT equidate_save_document($1, $2)', [JSON.stringify(regPayload), JSON.stringify(regPagePayload)]);

      const savedReg = (await db.query<{ name: string; type: string; event_date: string | null; class_id: string | null; storage_path: string }>(
        'SELECT name, type, event_date, class_id, storage_path FROM documents WHERE id=$1', [regDocId]
      )).rows[0];
      assert.equal(savedReg.name, 'Reglamento');
      assert.equal(savedReg.type, 'REGULATION');
      assert.equal(savedReg.event_date, null);
      assert.equal(savedReg.class_id, null);
      assert.equal(savedReg.storage_path, 'events/published/reglamento.pdf');

      const savedPage = (await db.query<{ storage_path: string; mime_type: string }>(
        'SELECT storage_path, mime_type FROM document_pages WHERE document_id=$1', [regDocId]
      )).rows[0];
      assert.equal(savedPage.storage_path, 'events/published/reglamento.pdf');
      assert.equal(savedPage.mime_type, 'application/pdf');

      // Test direct insert of REGULATION triggers automatic name 'Reglamento' and clears event_date/class_id
      const directRegId = '00000000-0000-4000-8000-000000000031';
      await db.query(
        "INSERT INTO documents(id, event_id, name, type, event_date, mime_type) VALUES ($1, $2, 'Nombre Manual', 'REGULATION', '2026-10-04', 'application/pdf')",
        [directRegId, published]
      );
      const directReg = (await db.query<{ name: string; event_date: string | null }>(
        'SELECT name, event_date FROM documents WHERE id=$1', [directRegId]
      )).rows[0];
      assert.equal(directReg.name, 'Reglamento');
      assert.equal(directReg.event_date, null);

      // Test converting an existing document to REGULATION clears class and sets name to Reglamento
      const convertDocId = '00000000-0000-4000-8000-000000000032';
      await db.query(
        "INSERT INTO documents(id, event_id, class_id, name, type, event_date, mime_type) VALUES ($1, $2, $3, 'Resultados Antiguos', 'RESULT', '2026-10-04', 'image/jpeg')",
        [convertDocId, published, classId]
      );
      // Update to REGULATION clearing class_id
      await db.query(
        "UPDATE documents SET type='REGULATION', class_id=NULL, event_date=NULL WHERE id=$1",
        [convertDocId]
      );
      const converted = (await db.query<{ name: string; type: string; class_id: string | null; event_date: string | null }>(
        'SELECT name, type, class_id, event_date FROM documents WHERE id=$1', [convertDocId]
      )).rows[0];
      assert.equal(converted.type, 'REGULATION');
      assert.equal(converted.name, 'Reglamento');
      assert.equal(converted.class_id, null);
      assert.equal(converted.event_date, null);

      // Verify storage bucket has allowed_mime_types = NULL and 25MB file_size_limit
      const bucket = (await db.query<{ allowed_mime_types: unknown; file_size_limit: number }>(
        "SELECT allowed_mime_types, file_size_limit FROM storage.buckets WHERE id='event-documents'"
      )).rows[0];
      assert.equal(bucket.allowed_mime_types, null);
      assert.equal(Number(bucket.file_size_limit), 26214400);

      // Test secure deletion via equidate_delete_document
      const delDocId = '00000000-0000-4000-8000-000000000033';
      await db.query(
        "INSERT INTO documents(id, event_id, name, type, mime_type, storage_path) VALUES ($1, $2, 'Para Borrar', 'PROGRAM', 'application/pdf', 'events/published/borrar.pdf')",
        [delDocId, published]
      );
      await db.query(
        "INSERT INTO document_pages(document_id, storage_path, mime_type, sort_order) VALUES ($1, 'events/published/borrar.pdf', 'application/pdf', 1)",
        [delDocId]
      );

      // Verify document and page exist before delete
      assert.equal((await db.query('SELECT 1 FROM documents WHERE id=$1', [delDocId])).rows.length, 1);
      assert.equal((await db.query('SELECT 1 FROM document_pages WHERE document_id=$1', [delDocId])).rows.length, 1);

      // Execute equidate_delete_document as admin
      const delResult = (await db.query<{ equidate_delete_document: { success: boolean; deleted_storage_paths: string[] } }>(
        'SELECT equidate_delete_document($1)', [delDocId]
      )).rows[0].equidate_delete_document;

      assert.equal(delResult.success, true);
      assert.deepEqual(delResult.deleted_storage_paths, ['events/published/borrar.pdf']);

      // Verify exclusively delDocId was removed
      assert.equal((await db.query('SELECT 1 FROM documents WHERE id=$1', [delDocId])).rows.length, 0);
      assert.equal((await db.query('SELECT 1 FROM document_pages WHERE document_id=$1', [delDocId])).rows.length, 0);
      // Other documents still exist
      assert.equal((await db.query('SELECT 1 FROM documents WHERE id=$1', [regDocId])).rows.length, 1);
    });

    // Test non-admin cannot delete documents via equidate_delete_document or directly
    for (const role of ['anon', 'authenticated']) {
      await asRole(role, false, async () => {
        await assert.rejects(
          db.query("SELECT equidate_delete_document('00000000-0000-4000-8000-000000000030')"),
          (err: Error) => err.message.includes('Permisos de administrador') || (err as { code?: string }).code === '42501'
        );
        if (role === 'authenticated') {
          // Direct delete should affect 0 rows or be rejected by RLS
          const res = await db.query("DELETE FROM documents WHERE id='00000000-0000-4000-8000-000000000030' RETURNING id");
          assert.equal(res.rows.length, 0);
        }
      });
    }
  });
  await context.test('Arena and stream RLS rejects ordinary users and hides draft contests', async () => {
    for (const role of ['anon', 'authenticated']) await asRole(role, false, async () => {
      assert.equal((await db.query('SELECT * FROM competition_arenas WHERE event_id=$1', [draft])).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM competition_streams WHERE event_id=$1', [draft])).rows.length, 0);
      await assert.rejects(db.query("INSERT INTO competition_arenas(event_id,name) VALUES ($1,'Forbidden')", [published]));
      await assert.rejects(db.query("SELECT equidate_save_stream($1,$2,'https://youtu.be/abcdefghijk','Europe/Madrid')", [dayId, primary]));
      if (role === 'authenticated') {
        assert.equal((await db.query("UPDATE competition_arenas SET name='Forbidden' WHERE id=$1 RETURNING id", [secondary])).rows.length, 0);
        assert.equal((await db.query('DELETE FROM competition_streams WHERE day_id=$1 RETURNING id', [dayId])).rows.length, 0);
      }
    });
  });
  await context.test('A new contest automatically receives a primary arena', async () => {
    await asRole('authenticated', true, async () => {
      const created = (await db.query<{ id: string }>("INSERT INTO events(name,venue,start_date,end_date) VALUES ('Nuevo','Club','2026-10-04','2026-10-05') RETURNING id")).rows[0].id;
      assert.equal((await db.query('SELECT * FROM competition_arenas WHERE event_id=$1 AND is_primary', [created])).rows.length, 1);
    });
  });
  await context.test('Batch multi-day class creation is atomic and creates independent records', async () => {
    await asRole('authenticated', true, async () => {
      // Create multi-day classes for day 1 and day 2
      const day2Id = (await db.query<{ id: string }>(
        'SELECT id FROM competition_days WHERE event_id=$1 AND event_date=$2', [published, '2026-10-05']
      )).rows[0].id;

      const multiInsert = await db.query<{ id: string; event_date: string; start_time: string }>(
        `INSERT INTO competition_classes (day_id, event_id, event_date, arena_id, number, name, start_time, sort_order)
         VALUES
           ($1, $2, '2026-10-04', $3, '10', '1 m', '09:00', 1),
           ($4, $2, '2026-10-05', $3, '10', '1 m', '09:30', 1)
         RETURNING id, event_date, start_time`,
        [dayId, published, primary, day2Id]
      );
      assert.equal(multiInsert.rows.length, 2);

      const class1 = multiInsert.rows[0].id;
      const class2 = multiInsert.rows[1].id;

      // Edit class 2 independently
      await db.query("UPDATE competition_classes SET start_time='10:00' WHERE id=$1", [class2]);
      const checkClass2 = (await db.query<{ start_time: string }>("SELECT start_time FROM competition_classes WHERE id=$1", [class2])).rows[0];
      const checkClass1 = (await db.query<{ start_time: string }>("SELECT start_time FROM competition_classes WHERE id=$1", [class1])).rows[0];
      assert.equal(checkClass2.start_time, '10:00:00');
      assert.equal(checkClass1.start_time, '09:00:00'); // remains unchanged

      // Delete class 1 independently
      await db.query("DELETE FROM competition_classes WHERE id=$1", [class1]);
      assert.equal((await db.query("SELECT 1 FROM competition_classes WHERE id=$1", [class1])).rows.length, 0);
      assert.equal((await db.query("SELECT 1 FROM competition_classes WHERE id=$1", [class2])).rows.length, 1);
    });
  });

  await db.exec(await readFile(new URL('../supabase/migrations/20261013_other_documents.sql', import.meta.url), 'utf8'));

  await context.test('Other documents migration supports general OTHER documents with custom names and validation', async () => {
    await asRole('authenticated', true, async () => {
      const otherDocId = '00000000-0000-4000-8000-000000000040';
      // 1. Save OTHER document via equidate_save_document with custom name
      const otherPayload = {
        id: otherDocId,
        event_id: published,
        name: 'Información para participantes',
        type: 'OTHER',
        event_date: null,
        class_id: null,
        storage_path: 'events/published/info.pdf',
        mime_type: 'application/pdf',
        sort_order: 1,
      };
      const otherPagePayload = [
        { storage_path: 'events/published/info.pdf', mime_type: 'application/pdf', sort_order: 1 }
      ];
      await db.query('SELECT equidate_save_document($1, $2)', [JSON.stringify(otherPayload), JSON.stringify(otherPagePayload)]);

      const savedOther = (await db.query<{ name: string; type: string; event_date: string | null; class_id: string | null; storage_path: string }>(
        'SELECT name, type, event_date, class_id, storage_path FROM documents WHERE id=$1', [otherDocId]
      )).rows[0];
      assert.equal(savedOther.name, 'Información para participantes');
      assert.equal(savedOther.type, 'OTHER');
      assert.equal(savedOther.event_date, null);
      assert.equal(savedOther.class_id, null);
      assert.equal(savedOther.storage_path, 'events/published/info.pdf');

      // 2. Multiple OTHER documents in the same competition
      const secondOtherId = '00000000-0000-4000-8000-000000000041';
      const secondPayload = {
        id: secondOtherId,
        event_id: published,
        name: 'Estabulación y Boxes',
        type: 'OTHER',
        event_date: null,
        class_id: null,
        storage_path: 'events/published/boxes.jpg',
        mime_type: 'image/jpeg',
        sort_order: 2,
      };
      await db.query('SELECT equidate_save_document($1, null)', [JSON.stringify(secondPayload)]);
      const savedSecond = (await db.query<{ name: string; type: string; event_date: string | null }>(
        'SELECT name, type, event_date FROM documents WHERE id=$1', [secondOtherId]
      )).rows[0];
      assert.equal(savedSecond.name, 'Estabulación y Boxes');
      assert.equal(savedSecond.type, 'OTHER');
      assert.equal(savedSecond.event_date, null);

      // 3. Validation: rejecting OTHER document with empty or whitespace-only name
      const blankOtherId = '00000000-0000-4000-8000-000000000042';
      await assert.rejects(
        db.query(
          "INSERT INTO documents(id, event_id, name, type, mime_type) VALUES ($1, $2, '   ', 'OTHER', 'application/pdf')",
          [blankOtherId, published]
        ),
        /El nombre del documento es obligatorio/
      );

      // 4. Updating and renaming an OTHER document
      await db.query("UPDATE documents SET name='Información de Acceso Actualizada' WHERE id=$1", [otherDocId]);
      const updatedName = (await db.query<{ name: string }>("SELECT name FROM documents WHERE id=$1", [otherDocId])).rows[0].name;
      assert.equal(updatedName, 'Información de Acceso Actualizada');

      // 5. Converting a class document (RESULT) to OTHER clears class_id and event_date and keeps custom name
      const convertDocId = '00000000-0000-4000-8000-000000000043';
      await db.query(
        "INSERT INTO documents(id, event_id, class_id, name, type, event_date, mime_type) VALUES ($1, $2, $3, 'Resultados Prueba', 'RESULT', '2026-10-04', 'image/jpeg')",
        [convertDocId, published, classId]
      );
      await db.query(
        "UPDATE documents SET type='OTHER', name='Plano de Pistas', class_id=NULL, event_date=NULL WHERE id=$1",
        [convertDocId]
      );
      const convertedDoc = (await db.query<{ name: string; type: string; class_id: string | null; event_date: string | null }>(
        'SELECT name, type, class_id, event_date FROM documents WHERE id=$1', [convertDocId]
      )).rows[0];
      assert.equal(convertedDoc.name, 'Plano de Pistas');
      assert.equal(convertedDoc.type, 'OTHER');
      assert.equal(convertedDoc.class_id, null);
      assert.equal(convertedDoc.event_date, null);

      // 6. Converting OTHER to REGULATION sets automatic name 'Reglamento'
      await db.query("UPDATE documents SET type='REGULATION' WHERE id=$1", [convertDocId]);
      const regConverted = (await db.query<{ name: string; type: string }>(
        'SELECT name, type FROM documents WHERE id=$1', [convertDocId]
      )).rows[0];
      assert.equal(regConverted.name, 'Reglamento');
      assert.equal(regConverted.type, 'REGULATION');

      // 7. Delete an OTHER document via equidate_delete_document safely
      const delResult = (await db.query<{ equidate_delete_document: { success: boolean } }>(
        'SELECT equidate_delete_document($1)', [secondOtherId]
      )).rows[0].equidate_delete_document;
      assert.equal(delResult.success, true);
      assert.equal((await db.query('SELECT 1 FROM documents WHERE id=$1', [secondOtherId])).rows.length, 0);
    });

    // 8. Non-admin cannot insert or delete OTHER documents
    await asRole('anon', false, async () => {
      const anonDocId = '00000000-0000-4000-8000-000000000044';
      await assert.rejects(
        db.query(
          "INSERT INTO documents(id, event_id, name, type, mime_type) VALUES ($1, $2, 'Intento Anonimo', 'OTHER', 'application/pdf')",
          [anonDocId, published]
        )
      );
    });
  });

  await db.close();
});
