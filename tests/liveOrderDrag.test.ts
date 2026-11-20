import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combinedLiveKeys, moveLivePosition, orderLiveEntries } from '../src/utils/liveOrder.ts';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
test('drag moves a binomial to any other position while preserving identity',()=>{
  const original=[1,2,3,4];
  assert.deepEqual(moveLivePosition(original,1,4),[2,3,4,1]);
  assert.deepEqual(moveLivePosition(original,4,1),[4,1,2,3]);
  assert.deepEqual(original,[1,2,3,4]);
  assert.deepEqual(moveLivePosition(original,2,2),original);
  assert.deepEqual(orderLiveEntries([{position:1},{position:2},{position:3}], [3,1,2]).map(x=>x.position),[3,1,2]);
});

test('manual rows can move among published rows without changing identities',()=>{
  const initial=combinedLiveKeys([1,2],['abc'],null);
  const moved=moveLivePosition(initial,'m:abc','p:1');
  assert.deepEqual(moved,['m:abc','p:1','p:2']);
  assert.deepEqual(combinedLiveKeys([1,2],['abc'],moved),moved);
  assert.deepEqual(combinedLiveKeys([1,2],['abc','new'],moved),['m:abc','p:1','p:2','m:new']);
});

test('mixed order is persisted atomically, guarded against stale updates and preserves marks',async()=>{
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key,raw_app_meta_data jsonb,banned_until timestamptz);
    create table events(id uuid primary key,end_date date,status text,discipline text);
    create table external_event_assignments(user_id uuid,event_id uuid,primary key(user_id,event_id));
    create table competition_classes(id uuid primary key,event_id uuid);
    create table start_list_versions(id uuid primary key,class_id uuid,entries jsonb,unique(class_id,id));
    create table start_lists(class_id uuid primary key,version_id uuid);
    create table manual_live_entries(id uuid primary key,class_id uuid,obstacle_faults integer,time_seconds numeric);
    create table live_tracking(class_id uuid,start_version_id uuid,live_order integer[],primary key(class_id,start_version_id));
    grant select on events,competition_classes,start_lists to anon,authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20261120020000_live_manual_order.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261120130308_combined_live_tracking_order.sql','utf8'));
  const u='00000000-0000-0000-0000-000000000001',e='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003',v='00000000-0000-0000-0000-000000000004',m='00000000-0000-0000-0000-000000000005';
  await db.query("insert into auth.users values($1,'{\"equidate_external\":true}',null)",[u]);
  await db.query("insert into events values($1,current_date,'published','jumping')",[e]);
  await db.query('insert into competition_classes values($1,$2)',[c,e]);
  await db.query('insert into external_event_assignments values($1,$2)',[u,e]);
  await db.query("insert into start_list_versions values($1,$2,'[{\"position\":1},{\"position\":2}]')",[v,c]);
  await db.query('insert into start_lists values($1,$2)',[c,v]);
  await db.query('insert into manual_live_entries(id,class_id,obstacle_faults,time_seconds) values($1,$2,4,55)',[m,c]);
  const order=['p:2',`m:${m}`,'p:1'];
  await db.query('select equidate_set_combined_live_order($1,$2,$3,$4,0,$5)',[u,e,c,v,order]);
  assert.deepEqual((await db.query<{entries:string[]}>('select entries from live_combined_order')).rows[0].entries,order);
  assert.deepEqual((await db.query<{live_order:number[]}>('select live_order from live_tracking')).rows[0].live_order,[2,1]);
  assert.equal((await db.query<{obstacle_faults:number}>('select obstacle_faults from manual_live_entries')).rows[0].obstacle_faults,4);
  await assert.rejects(db.query('select equidate_set_combined_live_order($1,$2,$3,$4,0,$5)',[u,e,c,v,order]));
  await db.query('delete from external_event_assignments where user_id=$1',[u]);
  await assert.rejects(db.query('select equidate_set_combined_live_order($1,$2,$3,$4,1,$5)',[u,e,c,v,order]));
  await db.query('insert into external_event_assignments values($1,$2)',[u,e]);
  await assert.rejects(db.query('select equidate_set_manual_only_order($1,$2,$3,0,$4)',[u,e,c,[`m:${m}`]]));
  await db.query('delete from start_lists where class_id=$1',[c]);
  await db.query('select equidate_set_manual_only_order($1,$2,$3,0,$4)',[u,e,c,[`m:${m}`]]);
  assert.deepEqual((await db.query<{entries:string[]}>('select entries from live_manual_only_order')).rows[0].entries,[`m:${m}`]);
  await assert.rejects(db.query('select equidate_set_manual_only_order($1,$2,$3,0,$4)',[u,e,c,[`m:${m}`]]));
  await db.close();
});


