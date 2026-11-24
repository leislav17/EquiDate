import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { behaviors, classTitle, liveCategoryName, type Behavior, type ClassCatalog } from '../src/utils/competitionCatalog.ts';
import { liveParts } from '../src/utils/livePhases.ts';

test('the selected behavior determines how the second part opens', () => {
  for (const behavior of Object.keys(behaviors) as Behavior[]) {
    const catalog = { definition: { behavior } } as ClassCatalog;
    const result = liveParts({ catalog, name: 'Legacy DR', description: 'Legacy 2FE' });
    assert.equal(result.twoPhases, !['TD','TOD'].includes(behavior));
    assert.equal(result.qualifiedSecond, ['1D','DR'].includes(behavior));
    assert.equal(result.jumpOff, behavior === '1D');
  }
  assert.equal(liveParts({ name: '1,50 m · DR' }).qualifiedSecond, true);
  assert.equal(liveParts({ description: '2FE' }).twoPhases, true);
});

test('category aliases resolve for timing while the original competition entry can be displayed', () => {
  const catalog = { categories: [{ name: 'Escuela Menor', code: 'ESC-MEN', aliases: ['EMEN'] }] } as ClassCatalog;
  assert.equal(liveCategoryName(catalog, 'emen'), 'Escuela Menor');
  assert.equal(liveCategoryName(catalog, 'Otra categoría'), undefined);
  assert.equal(liveCategoryName(null, 'Escuela Mayor'), 'Escuela Mayor');
});

test('catalog saves a public title and confirms unmatched categories before starting', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,raw_app_meta_data jsonb,banned_until timestamptz);
      create table public.events(id uuid primary key,end_date date,discipline text);
      create table public.external_event_assignments(user_id uuid,event_id uuid);
      create table public.competition_classes(id uuid primary key,event_id uuid,name text,description text,live_format text);
      create table public.start_lists(class_id uuid primary key,version_id uuid);
      create table public.start_list_versions(id uuid primary key,class_id uuid,entries jsonb);
      create table public.live_start_snapshots(class_id uuid,version_id uuid,entries jsonb);
      create table public.live_second_round_qualifiers(class_id uuid,entry_key text);
      create table public.manual_live_entries(id uuid,class_id uuid);
      create function public.equidate_is_admin() returns boolean language sql as 'select false';
      create function public.equidate_start_live_results(actor uuid,target_event uuid,target_class uuid) returns void
        language sql as 'insert into public.live_start_snapshots(class_id) values(target_class)';
    `);
    await db.exec(readFileSync('supabase/migrations/20261124020000_competition_catalog.sql', 'utf8'));
    const [u,e,c,v] = ['1','2','3','4'].map(index => `00000000-0000-0000-0000-00000000000${index}`);
    await db.query(`insert into auth.users values($1,'{"equidate_external":true}',null)`, [u]);
    await db.query("insert into events values($1,current_date,'jumping')", [e]);
    await db.query('insert into external_event_assignments values($1,$2)', [u,e]);
    const { rows: items } = await db.query<{ code:string; id:string }>("select id,code from competition_catalog where code in ('DR','PONY','ESC-MEN')");
    const byCode = Object.fromEntries(items.map(item => [item.code, item.id]));
    const selection = { definitionId: byCode.DR, categoryIds: [byCode.PONY,byCode['ESC-MEN']], heightCm: 150, secondHeightCm: 155, specialName: 'Gran Premio República', entryFee: 25000 };
    await db.query("insert into competition_classes(id,event_id,name,catalog) values($1,$2,'',$3)", [c,e,JSON.stringify(selection)]);
    const query = await db.query<{ name:string; catalog:ClassCatalog; live_format:string }>('select name,catalog,live_format from competition_classes');
    const saved = query.rows[0];
    assert.equal(saved.name, '1,50/1,55 m · DR · Gran Premio República');
    assert.equal(saved.name, classTitle(selection, 'DR'));
    assert.equal(saved.live_format, 'double_round');
    assert.deepEqual(saved.catalog.categories.map(item => item.name), ['Pony','Escuela Menor']);
    assert.equal(saved.catalog.entryFee, 25000);
    await db.query("update competition_catalog set name='Ponies de prueba', active=false where id=$1", [byCode.PONY]);
    await db.query("update competition_classes set name='Otro título', catalog=$2 where id=$1", [c,JSON.stringify(selection)]);
    assert.deepEqual((await db.query('select name,catalog,live_format from competition_classes')).rows, [saved]);
    await db.query('insert into start_lists values($1,$2)', [c,v]);
    await db.query('insert into start_list_versions values($1,$2,$3)', [v,c,JSON.stringify([{category:'EMEN'},{category:'Pony'},{category:'Junior'}])]);
    const start = (differences: string[] | null) => db.query<{ missing:string[] }>(
      'select equidate_start_catalog_live($1,$2,$3,$4) as missing', [u,e,c,differences]);
    assert.deepEqual((await start(null)).rows[0].missing, ['Junior']);
    assert.equal((await db.query('select * from live_start_snapshots')).rows.length, 0);
    assert.deepEqual((await start(['Junior'])).rows[0].missing, []);
    assert.equal((await db.query('select * from live_start_snapshots')).rows.length, 1);
  } finally {
    await db.close();
  }
});
