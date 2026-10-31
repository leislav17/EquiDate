import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateResultColumns, validateResultEntries, reviewResultImport, resultPdf } from '../src/utils/results.ts';
import type { CompetitionClass, DocumentItem } from '../src/types/equestrian.ts';

const columns = [{ key: 'faults', label: 'Faltas' }, { key: 'time', label: 'Tiempo' }];
const row = { position: 1, rider: 'Ana', horse: '', club: null, rank: '1', values: { faults: '0', time: '61,25' } };
test('Results preserve source values, tied ranks, empty fields and class associations', () => {
  assert.deepEqual(validateResultEntries([row, { ...row, position: 2, rider: 'Bea' }], columns).map(r => r.rank), ['1', '1']);
  assert.equal(validateResultEntries([row], columns)[0].horse, '');
  assert.equal(validateResultEntries([row], columns)[0].values?.time, '61,25');
  assert.throws(() => validateResultColumns([...columns, columns[0]]));
  assert.throws(() => validateResultEntries([{ ...row, values: { unknown: '7' } }], columns));
  const c = { id: randomUUID(), eventId: randomUUID(), date: '2026-10-31', arenaId: randomUUID(), number: '3' } as CompetitionClass;
  const item = { id: randomUUID(), classId: c.id, eventId: c.eventId, date: c.date, arenaId: c.arenaId, number: c.number, expectedRevision: null, sourceName: 'resultados.pdf', reviewed: true, uncertainties: [], columns, entries: [row] };
  assert.deepEqual(reviewResultImport([item], [c], [], c.eventId)[0].entries[0].values, row.values);
  assert.throws(() => reviewResultImport([{ ...item, number: '9' }], [c], [], c.eventId));
  assert.throws(() => reviewResultImport([{ ...item, uncertainties: ['Ilegible'] }], [c], [], c.eventId));
  const pdf = { classId: c.id, type: 'RESULT', mimeType: 'application/pdf' } as DocumentItem;
  assert.equal(resultPdf([pdf], c.id), pdf);
  assert.equal(resultPdf([{ ...pdf, type: 'START_LIST' }], c.id), undefined);
});

test('Result publication is atomic, admin-only, independent of start lists, and preserves history', async t => {
  const db = new PGlite();
  const event = randomUUID(), draft = randomUUID(), c1 = randomUUID(), c2 = randomUUID(), privateClass = randomUUID(), arena = randomUUID();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION public.equidate_is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(auth.jwt()->'app_metadata'->'equidate_admin'='true'::jsonb,false) $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    CREATE TABLE events(id uuid PRIMARY KEY,status text);
    CREATE TABLE competition_classes(id uuid PRIMARY KEY,event_id uuid REFERENCES events,event_date date,arena_id uuid,number text,participant_count integer);
    CREATE TABLE documents(id uuid PRIMARY KEY,body text);
    GRANT SELECT ON events,competition_classes TO anon,authenticated;
    GRANT UPDATE ON competition_classes TO authenticated;
    INSERT INTO events VALUES('${event}','published'),('${draft}','draft');
    INSERT INTO competition_classes VALUES('${c1}','${event}','2026-10-31','${arena}','1',39),('${c2}','${event}','2026-10-31','${arena}','2',NULL),('${privateClass}','${draft}','2026-10-31','${arena}','3',5);
    INSERT INTO documents VALUES(gen_random_uuid(),'Historical PDF');`);
  for (const file of ['20261031164507_structured_start_lists.sql', '20261031170402_optional_start_list_horse.sql', '20261031171539_structured_results.sql']) await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  const make = (classId = c1, entries = [row]) => ({ id: randomUUID(), classId, eventId: classId === privateClass ? draft : event, date: '2026-10-31', arenaId: arena, number: classId === c1 ? '1' : classId === c2 ? '2' : '3', expectedRevision: null as string | null, reviewed: true, uncertainties: [], sourceName: 'resultados.pdf', columns, entries });
  const asRole = async (role: string, claims: object, action: () => Promise<void>) => {
    await db.exec('SET ROLE ' + role);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify(claims)]);
    try { await action(); } finally { await db.exec('RESET ROLE'); }
  };
  const admin = { app_metadata: { equidate_admin: true } };
  const save = async (items: unknown[]) => (await db.query<{ value: { revision: string }[] }>('SELECT equidate_import_result_lists($1) value', [JSON.stringify(items)])).rows[0].value;
  const first = make(c1, [row, { ...row, rider: 'Bea', position: 2 }]);
  let revision = '';
  await t.test('Public and ordinary users cannot write, even with user_metadata admin claims', async () => {
    for (const role of ['anon','authenticated']) await asRole(role,{ user_metadata: { equidate_admin: true } },async () => {
      await assert.rejects(save([first]));
      await assert.rejects(db.query('INSERT INTO result_list_versions(id,class_id,entries,columns,source_name) VALUES($1,$2,$3,$4,$5)',[randomUUID(),c1,'[]','[]','bad']));
    });
  });
  await t.test('Admin publishes ties and empty results; public cannot read draft contests', async () => {
    await asRole('authenticated',admin,async () => {
      revision = (await save([first,make(c2,[]),make(privateClass)]))[0].revision;
      assert.equal((await save([first]))[0].revision,revision);
      assert.equal((await db.query('SELECT * FROM result_list_versions')).rows.length,3);
    });
    await asRole('anon',{},async () => {
      assert.equal((await db.query('SELECT * FROM result_lists')).rows.length,2);
      assert.equal((await db.query('SELECT * FROM result_list_versions')).rows.length,2);
    });
  });
  await t.test('Invalid values, duplicate orders, stale revisions and wrong class mapping roll back whole batches',async () => {
    await asRole('authenticated',admin,async () => {
      const replacement = { ...make(), expectedRevision: revision };
      await assert.rejects(save([replacement,{...make(c2), date:'2026-11-01'}]));
      await assert.rejects(save([{...replacement,entries:[{...row,values:{unknown:'0'}}]}]));
      await assert.rejects(save([{...replacement,columns:[...columns,columns[0]]}]));
      await assert.rejects(save([{...replacement,entries:[row,row]}]));
      await assert.rejects(save([{...replacement,reviewed:false}]));
      assert.equal((await db.query('SELECT * FROM result_list_versions')).rows.length,3);
      revision = (await save([replacement]))[0].revision;
      await assert.rejects(save([{ ...replacement, id: randomUUID() }]));
      await assert.rejects(db.query('UPDATE result_list_versions SET entries=\'[]\''));
      await assert.rejects(db.query('DELETE FROM result_list_versions'));
      await db.query('SELECT equidate_unpublish_result_list($1,$2)',[c1,revision]);
      assert.equal((await db.query('SELECT * FROM result_list_versions')).rows.length,4);
    });
    assert.equal((await db.query('SELECT * FROM documents')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM start_lists')).rows.length,0);
    assert.equal((await db.query<{ participant_count: number }>('SELECT participant_count FROM competition_classes WHERE id=$1',[c1])).rows[0].participant_count,39);
  });
  await db.close();
});
