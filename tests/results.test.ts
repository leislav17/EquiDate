import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateResultColumns, validateResultEntries, reviewResultImport, resultPdf, resultColumnsForPhases, resultColumnGroups, resultColumnsForFormat, validateResultDetails } from '../src/utils/results.ts';
import type { CompetitionClass, DocumentItem } from '../src/types/equestrian.ts';

const columns = [{ key: 'faults', label: 'Faltas' }, { key: 'time', label: 'Tiempo' }];
const row = { position: 1, rider: 'Ana', horse: '', club: null, rank: '1', values: { faults: '0', time: '61,25' } };
test('Optimum time, reference times, qualification and category rankings preserve source meaning', () => {
  const optimum = resultColumnsForFormat('optimum');
  assert.ok(optimum.some(c => c.key === 'time_difference'));
  assert.deepEqual(validateResultDetails({ definition: 'Tiempo óptimo', allowedTime: '71', optimalTime: '62' }), { definition: 'Tiempo óptimo', allowedTime: '71', optimalTime: '62' });
  const entries = [{ ...row, horse: 'Caballo', category: '3 MY', qualified: true, values: { time: '61,94', time_difference: '0,06' } }, { ...row, position: 2, horse: 'Caballo', category: '3 MN', qualified: false, values: { time: '61,94', time_difference: '0,06' } }];
  const normalized = validateResultEntries(entries,optimum);
  assert.equal(normalized[0].qualified,true);
  assert.equal(normalized[1].qualified,false);
  assert.equal(normalized[0].values?.time_difference,'0,06');
  assert.throws(() => validateResultEntries([{ ...entries[0], qualified: 'yes' }],optimum));
  assert.throws(() => validateResultEntries([entries[0],{...entries[0],position:2}],optimum));
  assert.throws(() => validateResultColumns([{ key:'championship_points',label:'Puntos campeonato',scope:'championship' }]));
  assert.throws(() => validateResultDetails({ championship: '1' }));
  assert.deepEqual(resultColumnGroups(resultColumnsForFormat('jump_off')).map(g=>g.label),['Recorrido','Desempate']);
  assert.deepEqual(resultColumnGroups(resultColumnsForFormat('two_rounds')).map(g=>g.label),['Recorrido 1','Recorrido 2','']);
  assert.equal(validateResultEntries([row],columns)[0].qualified,undefined); // Never infer qualification from rank.
});
test('One and two phase formats keep faults and times distinct, including zeros and missing marks', () => {
  assert.deepEqual(resultColumnsForPhases(1), columns);
  const two = resultColumnsForPhases(2);
  assert.deepEqual(resultColumnGroups(two).map(g => g.label), ['Fase 1', 'Fase 2']);
  assert.deepEqual(two.map(c => c.key), ['phase1_faults', 'phase1_time', 'phase2_faults', 'phase2_time']);
  const values = { phase1_faults: '0', phase1_time: '70,15', phase2_faults: '4', phase2_time: '' };
  assert.deepEqual(validateResultEntries([{ ...row, values }], two)[0].values, values);
  assert.throws(() => validateResultEntries([row], two));
  const custom = [{ key: 'official_time', label: 'Tiempo oficial' }];
  assert.equal(resultColumnGroups(custom)[0].columns[0].key, 'official_time');
});
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
  for (const file of ['20261031164507_structured_start_lists.sql', '20261031170402_optional_start_list_horse.sql', '20261031171539_structured_results.sql', '20261031174558_result_details_and_qualification.sql']) await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
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
  await t.test('Two-phase columns and every source mark survive a full database round trip', async () => {
    await asRole('authenticated',admin,async () => {
      const head = (await db.query<{ revision: string }>('SELECT revision FROM result_lists WHERE class_id=$1',[c2])).rows[0];
      const twoPhase = { ...make(c2), expectedRevision: head.revision, columns: resultColumnsForPhases(2), entries: [{ ...row, values: { phase1_faults: '0', phase1_time: '65,34', phase2_faults: '4', phase2_time: '' } }] };
      await save([twoPhase]);
      const stored = (await db.query<{ columns: typeof twoPhase.columns; entries: typeof twoPhase.entries }>('SELECT v.columns,v.entries FROM result_list_versions v JOIN result_lists h ON h.version_id=v.id WHERE h.class_id=$1',[c2])).rows[0];
      assert.deepEqual(stored.columns,twoPhase.columns);
      assert.deepEqual(stored.entries,twoPhase.entries);
    });
  });
  await t.test('Reference times, red-rank flags, categories and groups survive publication; championship data and invalid flags reject atomically', async () => {
    await asRole('authenticated',admin,async () => {
      const head = (await db.query<{revision:string}>('SELECT revision FROM result_lists WHERE class_id=$1',[c2])).rows[0];
      const detailed = { ...make(c2), expectedRevision:head.revision, columns:resultColumnsForFormat('optimum'), details:{ definition:'Tiempo óptimo',height:'0,90 m',allowedTime:'71',optimalTime:'62' }, entries:[{...row, horse:'Caballo',category:'3 MY',qualified:true,values:{time:'61,94',time_difference:'0,06'}},{...row,position:2,horse:'Caballo',category:'3 MN',qualified:false,values:{time:'61,94',time_difference:'0,06'}}] };
      await assert.rejects(save([{...detailed,entries:[{...detailed.entries[0],qualified:'yes'}]}]));
      await assert.rejects(save([{...detailed,columns:[{key:'championship_points',label:'Puntos',scope:'championship'}]}]));
      await assert.rejects(save([{...detailed,details:{optimalTime:62}}]));
      await save([detailed]);
      await save([detailed]); // Retry includes every detail, not just scores.
      const stored = (await db.query<{details:typeof detailed.details;entries:typeof detailed.entries}>('SELECT v.details,v.entries FROM result_list_versions v JOIN result_lists h ON h.version_id=v.id WHERE h.class_id=$1',[c2])).rows[0];
      assert.deepEqual(stored.details,detailed.details);
      assert.deepEqual(stored.entries,detailed.entries);
      await assert.rejects(save([{...detailed,details:{...detailed.details,optimalTime:'63'}}]));
    });
  });
  await db.close();
});
