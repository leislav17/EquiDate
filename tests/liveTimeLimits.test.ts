import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { liveClassHeight, resolvePartTimes, timeGroup, totalLiveFaults } from '../src/utils/liveTimeLimits.ts';

test('derive both category times from distance or from an editable time allowance', () => {
  assert.equal(liveClassHeight('Prueba 8 - 0,90 m'), 90);
  assert.equal(timeGroup('Tercera', 90), 'third');
  assert.equal(timeGroup('Tercera', 80), 'shared');
  assert.deepEqual(resolvePartTimes({ distance: 403 }, 90), {
    distance: 403, schoolAllowed: 75, schoolOptimal: 65, thirdAllowed: 70, thirdOptimal: 61,
  });
  const estimated = resolvePartTimes({ schoolAllowed: 75 }, 90);
  assert.equal(estimated.schoolOptimal, 65);
  assert.equal(estimated.thirdAllowed, 70);
  assert.equal(estimated.thirdOptimal, 61);
  const corrected = resolvePartTimes({ schoolAllowed: 80, thirdAllowed: 69, thirdOptimal: 64 }, 90);
  assert.equal(corrected.thirdAllowed, 69);
  assert.equal(corrected.thirdOptimal, 64);
  assert.equal(corrected.schoolOptimal, 70);
});

test('time faults are added per part without changing obstacle faults', () => {
  assert.equal(totalLiveFaults(4, 74.5, 74), 5);
  assert.equal(totalLiveFaults(4, 74, 74), 4);
  assert.equal(totalLiveFaults(0, 75.01, 74), 2);
  assert.equal(totalLiveFaults(4, 74.5, undefined), 4);
  assert.equal(totalLiveFaults(null, null, 65), '');
});

test('an assigned external operator saves settings and public readers only see shared settings', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      create table auth.users(id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz);
      create table events(id uuid primary key, end_date date, discipline text);
      create table external_event_assignments(user_id uuid, event_id uuid);
      create table competition_classes(id uuid primary key, event_id uuid);
      create table live_result_starts(class_id uuid primary key, public_visible boolean);
      grant select on live_result_starts to anon,authenticated;`);
    await db.exec(readFileSync('supabase/migrations/20261124010000_live_time_limits.sql', 'utf8'));
    const u = '00000000-0000-0000-0000-000000000001';
    const e = '00000000-0000-0000-0000-000000000002';
    const c = '00000000-0000-0000-0000-000000000003';
    await db.query(`insert into auth.users values($1,'{"equidate_external":true}',null)`, [u]);
    await db.query("insert into events values($1,current_date,'jumping')", [e]);
    await db.query('insert into competition_classes values($1,$2)', [c,e]);
    await db.query('insert into external_event_assignments values($1,$2)', [u,e]);
    await db.query('insert into live_result_starts values($1,true)', [c]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u]);
    await db.exec('set role authenticated');
    const save = (expected: object, proposed: object) =>
      db.query('select equidate_live_time_limits($1,$2,$3::jsonb,$4::jsonb) as settings',
        [e,c,JSON.stringify(expected),JSON.stringify(proposed)]);
    const values = { '1': { sharedAllowed: 74 }, '2': { sharedAllowed: 40 } };
    await assert.rejects(save({}, { '1': { sharedAllowed: 0 } }), { code: '22023' });
    assert.deepEqual((await save({}, values)).rows, [{ settings: values }]);
    await assert.rejects(save({}, values), { code: '40001' });
    await db.exec('set role anon');
    assert.equal((await db.query('select * from live_time_limits')).rows.length, 1);
    await db.exec('reset role; update live_result_starts set public_visible=false; set role anon');
    assert.equal((await db.query('select * from live_time_limits')).rows.length, 0);
    await db.exec('reset role; delete from external_event_assignments; set role authenticated');
    await assert.rejects(save(values, values), { code: '42501' });
  } finally {
    await db.close();
  }
});
