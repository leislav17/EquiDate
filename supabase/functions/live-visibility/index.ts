import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:object,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const isCurrent=(end:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(end))return false;
  const next=new Date(`${end}T00:00:00Z`);
  if(Number.isNaN(next.getTime())||next.toISOString().slice(0,10)!==end)return false;
  next.setUTCDate(next.getUTCDate()+1);
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=(type:string)=>parts.find(p=>p.type===type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`<=next.toISOString().slice(0,10);
};

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply({error:'Método no permitido.'},405);
  const url=Deno.env.get('SUPABASE_URL')!;
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')||''}},auth:{persistSession:false}});
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth.user)return reply({error:'Sesión inválida.'},401);
  if(auth.user.app_metadata?.equidate_external!==true || (auth.user.banned_until && new Date(auth.user.banned_until).getTime()>Date.now()))return reply({error:'Acceso denegado.'},403);
  let body;try{body=await req.json();}catch{return reply({error:'Datos inválidos.'},400);}
  if(typeof body.eventId!=='string')return reply({error:'Concurso inválido.'},400);
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='set'){
    if(typeof body.classId!=='string'||typeof body.visible!=='boolean')return reply({error:'Datos inválidos.'},400);
    const {error}=await service.rpc('equidate_set_live_visibility',{actor:auth.user.id,target_event:body.eventId,target_class:body.classId,visible:body.visible});
    return error?reply({error:'No se pudo cambiar la visibilidad.'},403):reply({success:true});
  }
  if(body.action==='list'){
    const {data:assignment,error}=await service.from('external_event_assignments').select('event:events(id,end_date,discipline)').eq('user_id',auth.user.id).eq('event_id',body.eventId).maybeSingle();
    if(error||!assignment?.event||!isCurrent(assignment.event.end_date)||(assignment.event.discipline&&assignment.event.discipline!=='jumping'))return reply({error:'Concurso no autorizado.'},403);
    const {data:classes,error:classesError}=await service.from('competition_classes').select('id').eq('event_id',body.eventId);
    if(classesError)return reply({error:'No se pudo consultar la visibilidad.'},500);
    const ids=(classes??[]).map((c:{id:string})=>c.id);
    if(!ids.length)return reply({classes:[]});
    const starts=await service.from('live_result_starts').select('class_id,public_visible').in('class_id',ids);
    return starts.error?reply({error:'No se pudo consultar la visibilidad.'},500):reply({classes:starts.data});
  }
  return reply({error:'Operación inválida.'},400);
});
