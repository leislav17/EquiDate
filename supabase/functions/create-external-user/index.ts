import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return response({ error: 'Método no permitido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = req.headers.get('Authorization') || '';
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: user, error: authError } = await client.auth.getUser();
  if (authError || !user.user) return response({ error: 'Sesión inválida.' }, 401);
  const { data: admin, error: permissionError } = await client.rpc('equidate_is_admin');
  if (permissionError || admin !== true) return response({ error: 'Acceso reservado para administradores.' }, 403);
  let body;
  try { body = await req.json(); } catch { return response({ error: 'Datos inválidos.' }, 400); }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || password.length < 8) return response({ error: 'Ingresá un correo y una contraseña de al menos 8 caracteres.' }, 400);
  const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { equidate_external: true } });
  if (error) return response({ error: 'No se pudo crear el usuario. Verificá el correo, la contraseña o si la cuenta ya existe.' }, 400);
  return response({ success: true });
});
