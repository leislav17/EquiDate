import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateStartEntries, reviewStartImport, startListAction, startParticipantCount, startPdf } from '../src/utils/startLists.ts';
import type { StartVersion } from '../src/utils/startLists.ts';
import type { CompetitionClass, DocumentItem } from '../src/types/equestrian.ts';

const rider = { position: 1, rider: 'Ana Pérez', horse: 'Relámpago', club: null };
test('Netlify main refuses a production database and accepts only the designated TEST project', () => {
  const guard = fileURLToPath(new URL('../scripts/check-build-environment.mjs', import.meta.url));
  const execute = (url: string) => spawnSync(process.execPath, [guard], { env: { ...process.env, BRANCH: 'main', VITE_SUPABASE_URL: url }, encoding: 'utf8' });
  assert.notEqual(execute('https://jfeyddnaiwlcmwykkwwe.supabase.co').status, 0);
  assert.notEqual(execute('').status, 0);
  assert.equal(execute('https://slophgtrynlfesjonbzf.supabase.co').status, 0);
});
test('List priority, optional PDF and zero participants preserve all legacy combinations', () => {
  const pdf = { type: 'START_LIST', classId: 'one', mimeType: 'application/pdf', id: 'old' } as DocumentItem;
  const empty = { entries: [] } as unknown as StartVersion;
  assert.equal(startListAction(undefined, []), 'hidden');
  assert.equal(startListAction(undefined, [pdf]), 'document');
  assert.equal(startListAction(empty, []), 'structured');
  assert.equal(startListAction(empty, [pdf]), 'structured');
  assert.equal(startParticipantCount(empty, 34), 0);
  assert.equal(startParticipantCount(undefined, 34), 34);
  assert.equal(startParticipantCount(undefined, null), null);
  assert.equal(startPdf([pdf], 'one'), pdf);
  assert.equal(startPdf([pdf], 'two'), undefined);
  assert.equal(startPdf([{ ...pdf, mimeType: 'image/jpeg' }], 'one'), undefined);
});
test('Import rejects ambiguous mappings, unreviewed data, duplicate orders and duplicate binomials', () => {
  assert.deepEqual(validateStartEntries([{ ...rider, position: 7 }, { ...rider, position: 2, horse: 'Otro' }]).map(e => e.position), [2, 7]);
  assert.throws(() => validateStartEntries([rider, rider]), /Orden/);
  assert.throws(() => validateStartEntries([rider, { ...rider, position: 2, rider: ' ANA   PÉREZ ' }]), /duplicado/);
  assert.throws(() => validateStartEntries([{ ...rider, position: 0 }]), /Orden/);
  assert.deepEqual(validateStartEntries([{ ...rider, horse: ' ', club: '' }]), [{ ...rider, horse: '', club: null }]);
  assert.equal(validateStartEntries([{ ...rider, horse: '' }, { ...rider, position: 2, horse: '' }]).length, 2);
  assert.throws(() => validateStartEntries([{ ...rider, horse: null }]), /caballo/);
  const c = { id: randomUUID(), eventId: randomUUID(), date: '2026-10-31', arenaId: randomUUID(), number: '1' } as CompetitionClass;
  const batch = [{ id: randomUUID(), classId: c.id, eventId: c.eventId, date: c.date, arenaId: c.arenaId, number: c.number, expectedRevision: null, sourceName: 'origen.pdf', reviewed: true, uncertainties: [], entries: [rider] }];
  assert.equal(reviewStartImport(batch, [c], [], c.eventId).length, 1);
  for (const change of [{ date: '2026-11-01' }, { arenaId: randomUUID() }, { number: '2' }, { eventId: randomUUID() }, { expectedRevision: randomUUID() }, { reviewed: false }, { uncertainties: ['Ilegible'] }]) {
    assert.throws(() => reviewStartImport([{ ...batch[0], ...change }], [c], [], c.eventId));
  }
  assert.throws(() => reviewStartImport([...batch, ...batch], [c], [], c.eventId), /más de una/);
});

test('Database: atomic versions, RLS, retries, stale replacements and historical preservation', async t => {
  const db = new PGlite();
  const event = randomUUID(), draft = randomUUID(), c1 = randomUUID(), c2 = randomUUID(), privateClass = randomUUID(), arena = randomUUID();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION public.equidate_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.jwt()->'app_metadata'->'equidate_admin'='true'::jsonb,false) $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    CREATE TABLE events(id uuid PRIMARY KEY,status text);
    CREATE TABLE competition_classes(id uuid PRIMARY KEY,event_id uuid REFERENCES events, event_date date,arena_id uuid,number text,participant_count integer);
    CREATE TABLE documents(id uuid PRIMARY KEY,body text);
    GRANT SELECT ON events,competition_classes TO anon,authenticated;
    GRANT UPDATE ON competition_classes TO authenticated;
    INSERT INTO events VALUES('${event}','published'),('${draft}','draft');
    INSERT INTO competition_classes VALUES('${c1}','${event}','2026-10-31','${arena}','1',37),('${c2}','${event}','2026-10-31','${arena}','2',NULL),('${privateClass}','${draft}','2026-10-31','${arena}','3',5);
    INSERT INTO documents VALUES(gen_random_uuid(),'historical PDF unchanged');`);
  const docsBefore = (await db.query('SELECT * FROM documents')).rows;
  await db.exec(await readFile(new URL('../supabase/migrations/20261031164507_structured_start_lists.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261031170402_optional_start_list_horse.sql', import.meta.url), 'utf8'));
  const batch = (classId = c1, entries = [rider]) => ({ id: randomUUID(), classId, eventId: classId === privateClass ? draft : event, date: '2026-10-31', arenaId: arena, number: classId === c1 ? '1' : classId === c2 ? '2' : '3', expectedRevision: null as string | null, sourceName: 'lista.pdf', reviewed: true, uncertainties: [], entries });
  const asRole = async (role: string, claims: object, action: () => Promise<void>) => {
    await db.exec(`SET ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
    try { await action(); } finally { await db.exec('RESET ROLE'); }
  };
  const admin = { app_metadata: { equidate_admin: true } };
  const save = async (items: object[]) => (await db.query<{ value: { revision: string; versionId: string }[] }>('SELECT equidate_import_start_lists($1::jsonb) value', [JSON.stringify(items)])).rows[0].value;
  let first = batch(), revision = '';
  await t.test('Only trusted app_metadata authorizes writing, including direct table access', async () => {
    for (const role of ['anon', 'authenticated']) await asRole(role, { user_metadata: { equidate_admin: true } }, async () => {
      await assert.rejects(save([first]));
      await assert.rejects(db.query('INSERT INTO start_list_versions(id,class_id,entries,source_name) VALUES($1,$2,$3,$4)', [randomUUID(),c1,'[]','bad']));
    });
  });
  await t.test('Admin publishes and retries idempotently; zero rows is a published version', async () => {
    await asRole('authenticated', admin, async () => {
      const response = await save([first, batch(c2, []), batch(privateClass, [{ ...rider, horse: '' }])]); revision = response[0].revision;
      const blank = (await db.query<{ entries: typeof rider[] }>('SELECT entries FROM start_list_versions WHERE class_id=$1', [privateClass])).rows[0];
      assert.equal(blank.entries[0].horse, '');
      assert.equal(blank.entries[0].club, null);
      assert.equal((await save([first]))[0].revision, revision);
      await assert.rejects(save([{ ...first, sourceName: null }]));
      assert.equal((await db.query('SELECT * FROM start_list_versions')).rows.length, 3);
    });
    await asRole('anon', {}, async () => {
      assert.equal((await db.query('SELECT * FROM start_lists')).rows.length, 2);
      assert.equal((await db.query('SELECT * FROM start_list_versions')).rows.length, 2);
    });
  });
  await t.test('One bad class rolls back a multi-class replacement; concurrency token and duplicates reject changes', async () => {
    await asRole('authenticated', admin, async () => {
      const good = { ...batch(), expectedRevision: revision };
      await assert.rejects(save([good, { ...batch(c2), date: '2026-11-01' }]));
      assert.equal((await db.query('SELECT * FROM start_list_versions')).rows.length, 3);
      await assert.rejects(save([batch()]));
      await assert.rejects(save([{ ...good, uncertainties: ['No se lee'] }]));
      await assert.rejects(save([{ ...good, reviewed: false }]));
      await assert.rejects(save([{ ...good, entries: [rider, rider] }]));
      await assert.rejects(save([{ ...good, entries: [rider, { ...rider, position: 2 }] }]));
      assert.equal((await db.query('SELECT * FROM start_list_versions')).rows.length, 3);
      const correction = { ...good, entries: [{ ...rider, horse: 'Corregido' }] };
      const response = await save([correction]); revision = response[0].revision;
      await assert.rejects(save([first])); // an old retry cannot republish an old version
      await assert.rejects(db.query('UPDATE start_list_versions SET entries=\'[]\''));
      await assert.rejects(db.query('DELETE FROM start_list_versions'));
    });
    await asRole('anon', {}, async () => {
      const versions = (await db.query<{ entries: typeof rider[] }>('SELECT * FROM start_list_versions')).rows;
      assert.equal(versions.length, 2);
      assert.ok(versions.some(v => v.entries[0]?.horse === 'Corregido'));
      assert.ok(!versions.some(v => v.entries[0]?.horse === 'Relámpago'));
    });
  });
  await t.test('Unpublish preserves every version and manual count; revision prevents ABA replacement', async () => {
    await asRole('authenticated', admin, async () => {
      await db.query('SELECT equidate_unpublish_start_list($1,$2)', [c1,revision]);
      await assert.rejects(save([{ ...batch(), expectedRevision: revision }]));
      const head = (await db.query<{ revision: string }>('SELECT revision FROM start_lists WHERE class_id=$1',[c1])).rows[0];
      await save([{ ...batch(), expectedRevision: head.revision }]);
      assert.equal((await db.query('SELECT * FROM start_list_versions')).rows.length, 5);
    });
    assert.deepEqual((await db.query('SELECT * FROM documents')).rows, docsBefore);
    assert.equal((await db.query<{ participant_count: number }>('SELECT participant_count FROM competition_classes WHERE id=$1',[c1])).rows[0].participant_count,37);
    await assert.rejects(db.query('DELETE FROM competition_classes WHERE id=$1',[c1]));
  });
  await db.close();
});
