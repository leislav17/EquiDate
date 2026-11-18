import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

async function request(user: any, admin: boolean, body: any, target: any = { app_metadata: { equidate_external: true } }) {
  let handler: any, updates: any[] = [], queried = false;
  const authClient = { auth: { getUser: async () => ({ data: { user }, error: null }) }, rpc: async () => ({ data: admin, error: null }) };
  const service = { auth: { admin: { getUserById: async () => ({ data: { user: target }, error: null }), updateUserById: async (...args: any[]) => { updates.push(args); return { error: null }; } } }, from: () => ({ select: () => ({ eq: async () => { queried = true; return { data: [], error: null }; } }) }) };
  const source = readFileSync('supabase/functions/external-assignments/index.ts', 'utf8').replace(/^import .*\n/, '');
  const js = transformSync(source, { loader: 'ts', target: 'es2022' }).code;
  vm.runInNewContext(js, { createClient: (_url: string, key: string) => key === 'service' ? service : authClient, Deno: { env: { get: (key: string) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'anon' }, serve: (fn: any) => { handler = fn; } }, Response, Date });
  const result = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) }));
  return { status: result.status, updates, queried };
}
const external = { id: 'external', app_metadata: { equidate_external: true } };
test('disabled external user cannot read assigned events with an existing token', async () => {
  const result = await request({ ...external, banned_until: '2099-01-01T00:00:00Z' }, false, { action: 'mine' });
  assert.equal(result.status, 403); assert.equal(result.queried, false);
});
test('external user cannot disable accounts or reset passwords', async () => {
  for (const action of ['disable', 'enable', 'password']) {
    const result = await request(external, false, { action, userId: 'target', password: 'password123' });
    assert.equal(result.status, 403); assert.equal(result.updates.length, 0);
  }
});
test('admin can manage external accounts but cannot manage an admin account', async () => {
  const actor = { id: 'admin', app_metadata: { equidate_admin: true } };
  const disabled = await request(actor, true, { action: 'disable', userId: 'target' });
  assert.equal(disabled.status, 200); assert.equal(disabled.updates[0][1].ban_duration, '876000h');
  const protectedAdmin = await request(actor, true, { action: 'disable', userId: 'admin' }, { app_metadata: { equidate_external: true, equidate_admin: true } });
  assert.equal(protectedAdmin.status, 400); assert.equal(protectedAdmin.updates.length, 0);
  const invalidPassword = await request(actor, true, { action: 'password', userId: 'target', password: 'short' });
  assert.equal(invalidPassword.status, 400); assert.equal(invalidPassword.updates.length, 0);
  const password = await request(actor, true, { action: 'password', userId: 'target', password: 'abcdefgh' });
  assert.equal(password.status, 200); assert.equal(password.updates[0][1].password, 'abcdefgh');
});
