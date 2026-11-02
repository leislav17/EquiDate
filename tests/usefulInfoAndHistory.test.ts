import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

test('Resources and reversible rider associations enforce roles and preserve source rows', async t => {
  const db = new PGlite();
  const v = '00000000-0000-4000-8000-000000000001';
  const src = `start:${v}:1`, src2 = `start:${v}:2`;
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated;
    CREATE FUNCTION equidate_is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE rider_associations(source text PRIMARY KEY,identity uuid NOT NULL,reason text NOT NULL);
    ALTER TABLE rider_associations ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON rider_associations TO authenticated;
    GRANT SELECT ON rider_associations TO anon;
    CREATE POLICY assoc_read ON rider_associations FOR SELECT TO anon,authenticated USING(true);
    CREATE POLICY assoc_write ON rider_associations FOR ALL TO authenticated USING(equidate_is_admin()) WITH CHECK(equidate_is_admin());
    CREATE TABLE start_list_versions(id uuid,entries jsonb);
    CREATE TABLE result_list_versions(id uuid,entries jsonb);
    GRANT SELECT ON start_list_versions,result_list_versions TO authenticated;
    INSERT INTO start_list_versions VALUES('${v}','[{"position":1,"rider":"Ana Perez","horse":"Sol"},{"position":2,"rider":"Ana Peres","horse":"Luna"}]');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261102011210_useful_resources_and_rider_history.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261102011611_rider_search_variants.sql',import.meta.url),'utf8'));
  const original = (await db.query('SELECT * FROM start_list_versions')).rows;
  const role = async (who: string, claims: object, fn: () => Promise<void>) => {
    await db.exec(`SET ROLE ${who}`); await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
    try { await fn(); } finally { await db.exec('RESET ROLE'); }
  };
  const admin = { sub: '00000000-0000-4000-8000-000000000099', app_metadata: { equidate_admin: true } };
  const merge = async (name: string, expected: unknown[] = []) => (await db.query<{op: string}>("SELECT merge_rider_associations($1,$2,'Corrección comprobada',$3::jsonb) op", [[src,src2],name,JSON.stringify(expected)])).rows[0].op;
  const snapshot = async () => (await db.query<{name_variants: string[]; identity: string}>('SELECT * FROM rider_associations ORDER BY source')).rows;
  const undo = async (op: string) => { await db.query('SELECT revert_rider_association($1)',[op]); };
  await role('authenticated',admin,async () => { await db.query("INSERT INTO useful_resources(title,url,published) VALUES('Oculta','https://example.org',false)"); });
  await t.test('Anonymous and ordinary accounts cannot write or read private history, even with forged user_metadata', async () => {
    for (const who of ['anon','authenticated']) await role(who,{user_metadata:{equidate_admin:true,role:'superadmin'}},async () => {
      assert.equal((await db.query('SELECT * FROM useful_resources')).rows.length,3);
      await assert.rejects(db.query("INSERT INTO useful_resources(title,url) VALUES('Intruso','https://example.org')"));
      await assert.rejects(merge('Intruso'));
      if (who==='anon') await assert.rejects(db.query('SELECT * FROM rider_association_history'));
      else assert.equal((await db.query('SELECT * FROM rider_association_history')).rows.length,0);
    });
  });
  await t.test('Admin CRUD, URL validation and superadmin access', async () => {
    await role('authenticated',{app_metadata:{role:'superadmin'}},async () => {
      assert.equal((await db.query('SELECT * FROM useful_resources')).rows.length,4);
      await db.query("UPDATE useful_resources SET sort_order=-1,published=true WHERE title='Oculta'");
      await assert.rejects(db.query("INSERT INTO useful_resources(title,url,published) VALUES('Bad','javascript:alert(1)',true)"));
      await assert.rejects(db.query("INSERT INTO useful_resources(title,published) VALUES('Missing',true)"));
      await db.query("DELETE FROM useful_resources WHERE title='Oculta'");
    });
  });
  await t.test('Atomic merge audits all rows; stale preview and forged history are rejected',async () => {
    await role('authenticated',admin,async () => {
      const op=await merge('Ana Pérez');
      const first=await snapshot(); assert.equal(first.length,2);
      assert.equal((first[0] as any).identity,(first[1] as any).identity);
      assert.equal((await db.query('SELECT * FROM rider_association_history WHERE operation=$1',[op])).rows.length,2);
      await assert.rejects(merge('Stale'));
      await assert.rejects(db.query("DELETE FROM rider_association_history"));
      await assert.rejects(db.query("INSERT INTO rider_association_history(operation,source) VALUES('forged','x')"));
      const op2=await merge('Ana Corregida',first);
      assert.ok(((await snapshot())[0].name_variants as string[]).includes('Ana Pérez'));
      await assert.rejects(undo(op));
      await undo(op2); assert.deepEqual(await snapshot(),first);
      await undo(op); assert.equal((await snapshot()).length,0);
      await assert.rejects(undo(op));
      await assert.rejects(db.query("SELECT merge_rider_associations(ARRAY['start:00000000-0000-4000-8000-000000000999:1'],'Ana','Motivo','[]')"));
    });
    assert.deepEqual((await db.query('SELECT * FROM start_list_versions')).rows,original);
    assert.equal((await db.query('SELECT * FROM result_list_versions')).rows.length,0);
  });
  await db.close();
});
