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
const youtubeId = (value: string) => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|live|shorts)\/([A-Za-z0-9_-]{11})\/?$/)?.[1] || null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
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
  if (body.action === 'live_list' || body.action === 'live_save' || body.action === 'live_tracking') {
    if (auth.user.app_metadata?.equidate_external !== true || (auth.user.banned_until && new Date(auth.user.banned_until).getTime() > Date.now())) return reply({ error: 'Acceso denegado.' }, 403);
    if (typeof body.eventId !== 'string') return reply({ error: 'Concurso inválido.' }, 400);
    if (body.action === 'live_tracking') {
      if (typeof body.classId !== 'string' || typeof body.startVersionId !== 'string' || !Number.isInteger(body.position) || !['current','absent','restore'].includes(body.operation)) return reply({ error: 'Datos inválidos.' }, 400);
      const { error } = await service.rpc('equidate_live_tracking_action', { actor: auth.user.id, target_event: body.eventId, target_class: body.classId, start_version: body.startVersionId, target_position: body.position, action: body.operation });
      if (error) return reply({ error: 'No se pudo actualizar el estado.' }, 403);
      return reply({ success: true });
    }
    if (body.action === 'live_save') {
      if (typeof body.classId !== 'string' || typeof body.startVersionId !== 'string' || !Number.isInteger(body.position) || !Number.isInteger(body.faults) || typeof body.seconds !== 'number' || !Number.isFinite(body.seconds)) return reply({ error: 'Datos inválidos.' }, 400);
      const { error } = await service.rpc('equidate_save_live_result_and_advance', { actor: auth.user.id, target_event: body.eventId, target_class: body.classId, start_version: body.startVersionId, target_position: body.position, faults: body.faults, seconds: body.seconds, second_faults: body.secondFaults ?? null, second_seconds: body.secondSeconds ?? null });
      if (error) return reply({ error: 'No se pudo guardar. Comprobá tu acceso y que el listado no haya cambiado.' }, 403);
      return reply({ success: true });
    }
    const { data: assignment, error: assignmentError } = await service.from('external_event_assignments').select('event:events(id,name,end_date,discipline)').eq('user_id', auth.user.id).eq('event_id', body.eventId).maybeSingle();
    if (assignmentError || !assignment?.event || !isCurrent(assignment.event.end_date) || (assignment.event.discipline && assignment.event.discipline !== 'jumping')) return reply({ error: 'Concurso no autorizado.' }, 403);
    const { data: classes, error: classesError } = await service.from('competition_classes').select('id,number,name,description,event_date,arena_id,sort_order').eq('event_id', body.eventId).order('event_date').order('sort_order');
    if (classesError) return reply({ error: 'No se pudieron consultar las pruebas.' }, 500);
    const ids = (classes || []).map((c: {id:string}) => c.id);
    if (!ids.length) return reply({ classes: [] });
    const { data: heads, error: headsError } = await service.from('start_lists').select('class_id,version_id').in('class_id', ids).not('version_id','is',null);
    if (headsError) return reply({ error: 'No se pudieron consultar los listados.' }, 500);
    const versionIds = (heads || []).map((h: {version_id:string}) => h.version_id);
    if (!versionIds.length) return reply({ classes: [] });
    const [versions, marks, tracking] = await Promise.all([
      service.from('start_list_versions').select('id,class_id,entries').in('id', versionIds),
      service.from('provisional_live_results').select('class_id,start_version_id,position,obstacle_faults,time_seconds,phase2_faults,phase2_seconds').in('class_id', ids).in('start_version_id', versionIds),
      service.from('live_tracking').select('class_id,start_version_id,current_position,no_shows').in('class_id', ids).in('start_version_id', versionIds),
    ]);
    if (versions.error || marks.error || tracking.error) return reply({ error: 'No se pudieron consultar las marcas.' }, 500);
    return reply({ classes: (classes || []).flatMap((c: {id:string}) => {
      const head = (heads || []).find((h: {class_id:string}) => h.class_id === c.id);
      const version = (versions.data || []).find((v: {id:string,class_id:string}) => v.id === head?.version_id && v.class_id === c.id);
      return version ? [{ ...c, versionId: version.id, entries: version.entries, tracking: (tracking.data || []).find((t: {class_id:string,start_version_id:string}) => t.class_id === c.id && t.start_version_id === version.id) || null, marks: (marks.data || []).filter((m: {class_id:string,start_version_id:string}) => m.class_id === c.id && m.start_version_id === version.id) }] : [];
    }) });
  }
  if (body.action === 'streams_list' || body.action === 'streams_save') {
    if (auth.user.app_metadata?.equidate_external !== true || (auth.user.banned_until && new Date(auth.user.banned_until).getTime() > Date.now())) return reply({ error: 'Acceso denegado.' }, 403);
    if (typeof body.eventId !== 'string') return reply({ error: 'Concurso inválido.' }, 400);
    if (body.action === 'streams_save') {
      if (typeof body.dayId !== 'string' || typeof body.arenaId !== 'string' || typeof body.url !== 'string') return reply({ error: 'Datos inválidos.' }, 400);
      const url = body.url.trim();
      if (url && !youtubeId(url)) return reply({ error: 'Ingresá un enlace válido de YouTube.' }, 400);
      const { error } = await service.rpc('equidate_external_save_stream', { actor: auth.user.id, target_event: body.eventId, target_day: body.dayId, target_arena: body.arenaId, video_url: url || null });
      if (error) return reply({ error: 'No se pudo guardar. Verificá que el acceso siga habilitado.' }, 403);
      return reply({ success: true });
    }
    const { data: assignment, error: assignmentError } = await service.from('external_event_assignments').select('event:events(id,name,end_date)').eq('user_id', auth.user.id).eq('event_id', body.eventId).maybeSingle();
    if (assignmentError || !assignment?.event || !isCurrent(assignment.event.end_date)) return reply({ error: 'Concurso no autorizado.' }, 403);
    const [days, arenas, streams] = await Promise.all([
      service.from('competition_days').select('id,event_date').eq('event_id', body.eventId).order('event_date'),
      service.from('competition_arenas').select('id,name,sort_order').eq('event_id', body.eventId).order('sort_order'),
      service.from('competition_streams').select('day_id,arena_id,youtube_url').eq('event_id', body.eventId),
    ]);
    if (days.error || arenas.error || streams.error) return reply({ error: 'No se pudieron cargar las transmisiones.' }, 500);
    return reply({ days: days.data, arenas: arenas.data, streams: streams.data });
  }
  if (body.action === 'mine') {
    if (auth.user.app_metadata?.equidate_external !== true || (auth.user.banned_until && new Date(auth.user.banned_until).getTime() > Date.now())) return reply({ error: 'Acceso denegado.' }, 403);
    const { data, error } = await service.from('external_event_assignments').select('event:events(id,name,start_date,end_date,discipline)').eq('user_id', auth.user.id);
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
