import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// An assignment is valid through the whole day after the event in Argentina.
const isCurrent = (end: string, now = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const next = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(next.getTime()) || next.toISOString().slice(0, 10) !== end) return false;
  next.setUTCDate(next.getUTCDate() + 1);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}` <= next.toISOString().slice(0, 10);
};
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return reply({ error: 'Sesión inválida.' }, 401);
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  let body; try { body = await req.json(); } catch { return reply({ error: 'Datos inválidos.' }, 400); }
  if (body.action === 'mine') {
    if (auth.user.app_metadata?.equidate_external !== true || (auth.user.banned_until && new Date(auth.user.banned_until).getTime() > Date.now())) return reply({ error: 'Acceso denegado.' }, 403);
    const { data, error } = await service.from('external_event_assignments').select('event:events(id,name,start_date,end_date)').eq('user_id', auth.user.id);
    if (error) return reply({ error: 'No se pudieron consultar tus concursos.' }, 500);
    return reply({ events: (data || []).map((row: { event: { end_date: string } | null }) => row.event).filter((event: { end_date: string } | null) => event && isCurrent(event.end_date)) });
  }
  const { data: admin, error: adminError } = await client.rpc('equidate_is_admin');
  if (adminError || admin !== true) return reply({ error: 'Acceso reservado para administradores.' }, 403);
  if (body.action === 'list') {
    const users = [];
    for (let page = 1; ; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return reply({ error: 'No se pudieron consultar los usuarios.' }, 500);
      users.push(...data.users.filter(u => u.app_metadata?.equidate_external === true).map(u => ({ id: u.id, email: u.email, disabled: !!u.banned_until && new Date(u.banned_until).getTime() > Date.now() })));
      if (data.users.length < 200) break;
    }
    const { data: assignments, error } = await service.from('external_event_assignments').select('user_id,event_id,event:events(end_date)');
    if (error) return reply({ error: 'No se pudieron consultar las asignaciones.' }, 500);
    return reply({ users, assignments: (assignments || []).map((a: { user_id: string; event_id: string; event: { end_date: string } | null }) => ({ user_id: a.user_id, event_id: a.event_id, current: !!a.event && isCurrent(a.event.end_date) })) });
  }
  if (['disable', 'enable', 'password', 'email', 'delete'].includes(body.action) && typeof body.userId === 'string') {
    const { data, error } = await service.auth.admin.getUserById(body.userId);
    if (error || data.user?.app_metadata?.equidate_external !== true || data.user.app_metadata?.equidate_admin === true || data.user.app_metadata?.role === 'superadmin') return reply({ error: 'Usuario externo inválido.' }, 400);
    if (body.action === 'password' && (typeof body.password !== 'string' || body.password.length < 8)) return reply({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
    if (body.action === 'email' && (typeof body.email !== 'string' || !body.email.trim())) return reply({ error: 'Correo inválido.' }, 400);
    if (body.action === 'delete') {
      const result = await service.auth.admin.deleteUser(body.userId);
      if (result.error) return reply({ error: 'No se pudo eliminar el usuario.' }, 400);
      return reply({ success: true });
    }
    const attributes = body.action === 'password' ? { password: body.password } : body.action === 'email' ? { email: body.email.trim().toLowerCase(), email_confirm: true } : { ban_duration: body.action === 'disable' ? '876000h' : 'none' };
    const result = await service.auth.admin.updateUserById(body.userId, attributes);
    if (result.error) return reply({ error: 'No se pudo actualizar el usuario.' }, 400);
    return reply({ success: true });
  }
  if (body.action === 'replace' && typeof body.userId === 'string' && typeof body.newUserId === 'string' && typeof body.eventId === 'string') {
    const { data, error } = await service.auth.admin.getUserById(body.newUserId);
    const next = data?.user;
    if (error || !next || next.app_metadata?.equidate_external !== true || next.app_metadata?.equidate_admin === true || next.app_metadata?.role === 'superadmin' || (next.banned_until && new Date(next.banned_until).getTime() > Date.now())) return reply({ error: 'Usuario de reemplazo inválido o desactivado.' }, 400);
    const result = await service.rpc('equidate_replace_external_assignment', { target_event: body.eventId, old_user: body.userId, new_user: body.newUserId });
    if (result.error) return reply({ error: 'No se pudo reemplazar la asignación.' }, 400);
    return reply({ success: true });
  }
  if (body.action === 'unassign' && typeof body.userId === 'string' && typeof body.eventId === 'string') {
    const { error } = await service.from('external_event_assignments').delete().eq('user_id', body.userId).eq('event_id', body.eventId);
    if (error) return reply({ error: 'No se pudo quitar el concurso.' }, 400);
    return reply({ success: true });
  }
  if (body.action === 'assign' && typeof body.userId === 'string' && typeof body.eventId === 'string') {
    const { data, error } = await service.auth.admin.getUserById(body.userId);
    if (error || data.user?.app_metadata?.equidate_external !== true) return reply({ error: 'Usuario externo inválido.' }, 400);
    const result = await service.from('external_event_assignments').upsert({ user_id: body.userId, event_id: body.eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true });
    if (result.error) return reply({ error: 'No se pudo asignar el concurso.' }, 400);
    return reply({ success: true });
  }
  return reply({ error: 'Operación inválida.' }, 400);
});
