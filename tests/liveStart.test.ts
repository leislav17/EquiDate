import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('start is per class, preserves old marks, persists across versions and checks authorization', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key,raw_app_meta_data jsonb,banned_until timestamptz);
    create table events(id uuid primary key,end_date date,status text,discipline text);
    create table external_event_assignments(user_id uuid,event_id uuid,primary key(user_id,event_id));
    create table competition_classes(id uuid primary key,event_id uuid);
    create table provisional_live_results(class_id uuid); create table manual_live_entries(class_id uuid,time_seconds numeric);
    grant select on events,competition_classes to anon,authenticated;`);
  const u='00000000-0000-0000-0000-000000000001', e='00000000-0000-0000-0000-000000000002', a='00000000-0000-0000-0000-000000000003', b='00000000-0000-0000-0000-000000000004', c='00000000-0000-0000-0000-000000000005';
  await db.query("insert into auth.users values ($1,'{\"equidate_external\":true}',null)",[u]);
  await db.query("insert into events values($1,current_date,'published','jumping')",[e]);
  await db.query('insert into competition_classes values($1,$4),($2,$4),($3,$4)',[a,b,c,e]);
  await db.query('insert into external_event_assignments values($1,$2)',[u,e]);
  await db.query('insert into provisional_live_results values($1)',[a]);
  await db.exec(readFileSync('supabase/migrations/20261120124332_live_result_starts.sql','utf8'));
  assert.deepEqual((await db.query('select class_id from live_result_starts')).rows,[{class_id:a}]);
  const start=(cls:string)=>db.query('select equidate_start_live_results($1,$2,$3)',[u,e,cls]);
  await start(b); await start(b);
  assert.equal((await db.query('select * from live_result_starts')).rows.length,2);
  await db.exec('set role anon'); assert.equal((await db.query('select * from live_result_starts')).rows.length,2); await assert.rejects(start(c)); await db.exec('reset role');
  await db.query('delete from external_event_assignments where user_id=$1',[u]); await assert.rejects(start(c));
  await db.query('insert into external_event_assignments values($1,$2)',[u,e]);
  await db.query("update auth.users set banned_until=now()+interval '1 day'"); await assert.rejects(start(c));
  await db.query('update auth.users set banned_until=null');
  await db.query("update events set end_date=current_date-3 where id=$1",[e]); await assert.rejects(start(c));
  await db.close();
});



