import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('provisional marks respect assignment, expiration, version and public visibility', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key, raw_app_meta_data jsonb,banned_until timestamptz);
    create table public.events(id uuid primary key,end_date date,status text,discipline text);
    create table public.external_event_assignments(user_id uuid,event_id uuid,primary key(user_id,event_id));
    create table public.competition_classes(id uuid primary key,event_id uuid);
    create table public.start_list_versions(id uuid primary key,class_id uuid,entries jsonb,unique(class_id,id));
    create table public.start_lists(class_id uuid primary key,version_id uuid);
    grant select on public.events,public.competition_classes,public.start_lists,public.start_list_versions to anon,authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20261118151405_provisional_live_results.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261119104700_live_results_two_phases.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261119105343_live_tracking.sql','utf8'));
  const user='00000000-0000-0000-0000-000000000001', event='00000000-0000-0000-0000-000000000002', cls='00000000-0000-0000-0000-000000000003', ver='00000000-0000-0000-0000-000000000004', other='00000000-0000-0000-0000-000000000005';
  await db.query("insert into auth.users values ($1,'{\"equidate_external\":true}',null)",[user]);
  await db.query("insert into events values ($1,current_date,'published','jumping'),($2,current_date,'published','jumping')",[event,other]);
  await db.query('insert into external_event_assignments values($1,$2)',[user,event]);
  await db.query('insert into competition_classes values($1,$2)',[cls,event]);
  await db.query("insert into start_list_versions values($1,$2,'[{\"position\":1,\"rider\":\"A\",\"horse\":\"B\",\"category\":\"Tercera\"},{\"position\":2,\"rider\":\"C\",\"horse\":\"D\"}]')",[ver,cls]);
  await db.query('insert into start_lists values($1,$2)',[cls,ver]);
  const save=(ev=event,v=ver,pos=1)=>db.query('select equidate_external_save_live_result($1,$2,$3,$4,$5,4,65.25)',[user,ev,cls,v,pos]);
  await save(); await save(event,ver,2);
  const phases=(f:number|null,t:number|null)=>db.query('select equidate_external_save_live_result_phases($1,$2,$3,$4,1,4,65.25,$5,$6)',[user,event,cls,ver,f,t]);
  await phases(8,42.33);
  assert.deepEqual((await db.query('select phase2_faults,phase2_seconds from provisional_live_results where position=1')).rows[0],{phase2_faults:8,phase2_seconds:'42.33'});
  await assert.rejects(phases(2,null));
  assert.equal((await db.query<{phase2_faults:number}>('select phase2_faults from provisional_live_results where position=1')).rows[0].phase2_faults,8);
  await phases(null,null);
  const track=(pos:number,action:string)=>db.query('select equidate_live_tracking_action($1,$2,$3,$4,$5,$6)',[user,event,cls,ver,pos,action]);
  const saveAndAdvance=(pos:number)=>db.query('select equidate_save_live_result_and_advance($1,$2,$3,$4,$5,0,42,null,null)',[user,event,cls,ver,pos]);
  await track(1,'current'); await saveAndAdvance(1);
  assert.equal((await db.query<{current_position:number|null}>('select current_position from live_tracking')).rows[0].current_position,null); // next already has a mark
  await track(2,'current'); await saveAndAdvance(1); // correcting another row must not move the current rider
  assert.equal((await db.query<{current_position:number}>('select current_position from live_tracking')).rows[0].current_position,2);
  await assert.rejects(track(2,'absent')); // cannot mark a scored rider absent
  await db.query('delete from provisional_live_results where position=2');
  await track(2,'absent');
  assert.deepEqual((await db.query<{current_position:number|null;no_shows:number[]}>('select current_position,no_shows from live_tracking')).rows[0],{current_position:null,no_shows:[2]});
  await track(2,'restore'); await track(2,'current');
  assert.equal((await db.query<{current_position:number}>('select current_position from live_tracking')).rows[0].current_position,2);
  await assert.rejects(save(other)); await assert.rejects(save(event,other)); await assert.rejects(save(event,ver,3));
  await db.exec('set role anon'); const visible=await db.query<{position:number}>('select position from provisional_live_results');assert.equal(visible.rows.length,1);assert.equal(visible.rows[0].position,1);await db.exec('reset role');
  await db.query('delete from external_event_assignments where user_id=$1',[user]);await assert.rejects(save());await assert.rejects(phases(0,40));await assert.rejects(track(1,'current'));await assert.rejects(saveAndAdvance(1));
  await db.query('insert into external_event_assignments values($1,$2)',[user,event]);
  await db.query("update auth.users set banned_until=now()+interval '1 day'");await assert.rejects(save());
  await db.query('update auth.users set banned_until=null');await db.query("update events set end_date=current_date-3 where id=$1",[event]);await assert.rejects(save());
  assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','public.equidate_external_save_live_result(uuid,uuid,uuid,uuid,integer,integer,numeric)','execute') as allowed")).rows[0].allowed,false);
  await db.close();
});
