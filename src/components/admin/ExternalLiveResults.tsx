import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Participant = {position:number; rider:string; horse:string; category?:string; club?:string};
type Mark = {position:number; obstacle_faults:number; time_seconds:number};
type LiveClass = {id:string; number:string; name:string; event_date:string; versionId:string; entries:Participant[]; marks:Mark[]};
export const ExternalLiveResults: React.FC<{eventId:string; eventName:string; onBack:()=>void}> = ({eventId,eventName,onBack}) => {
  const [classes,setClasses]=useState<LiveClass[]>([]);
  const [classId,setClassId]=useState('');
  const [drafts,setDrafts]=useState<Record<number,{faults:string;seconds:string}>>({});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState(''), [message,setMessage]=useState('');
  const load=async()=>{
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_list',eventId}});
    if(error || !Array.isArray(data?.classes)) { setError('No se pudieron cargar las pruebas. Verificá que tu acceso siga vigente.'); setLoading(false); return; }
    setClasses(data.classes); setLoading(false);
  };
  useEffect(()=>{void load();},[eventId]);
  const chosen=classes.find(c=>c.id===classId);
  const changeClass=(id:string)=>{setClassId(id);setDrafts({});setError('');setMessage('');};
  const change=(pos:number,key:'faults'|'seconds',value:string,mark?:Mark)=>setDrafts(current=>({...current,[pos]:{...(current[pos] || {faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||''}),[key]:value}}));
  const save=async(row:Participant,mark?:Mark)=>{
    if(!chosen)return;
    const values=drafts[row.position]||{faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||''};
    const secondsText=values.seconds.trim().replace(',','.');
    if (!/^\d+$/.test(values.faults) || Number(values.faults)>999 || !/^\d+(?:\.\d{1,2})?$/.test(secondsText) || Number(secondsText)>9999999) {setError('Ingresá faltas enteras y un tiempo válido con hasta dos decimales.');return;}
    setError('');setMessage('');setBusy(row.position);
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_save',eventId,classId:chosen.id,startVersionId:chosen.versionId,position:row.position,faults:Number(values.faults),seconds:Number(secondsText)}});
    if(error || !data?.success) setError('No se pudo guardar. Verificá el acceso y actualizá si cambió el orden de ingreso.');
    else {await load();setDrafts(current=>{const next={...current};delete next[row.position];return next;});setMessage('Marca guardada como provisoria.');}
    setBusy(null);
  };
  const input='w-full h-10 px-2 border border-neutral-300 rounded-lg text-sm';
  return <section className="max-w-5xl mx-auto px-4 py-8 space-y-5"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#123E59] min-h-11"><ArrowLeft size={18}/>Volver al concurso</button><h1 className="text-2xl font-display font-black text-[#123E59]">Resultados en vivo</h1><p className="text-sm text-neutral-600">{eventName} · Las marcas se publican como provisorias y mantienen el orden de ingreso.</p>
    {loading?<p>Cargando pruebas…</p>:<><label className="block text-sm font-bold max-w-xl">Prueba<select className={input+' mt-1'} value={classId} onChange={e=>changeClass(e.target.value)}><option value="">Elegí una prueba</option>{classes.map(c=><option key={c.id} value={c.id}>{c.event_date.split('-').reverse().join('/')} · Prueba {c.number} — {c.name}</option>)}</select></label>{!classes.length&&<p className="text-sm text-neutral-600">No hay pruebas con orden de ingreso publicado.</p>}{chosen&&<div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs"><h2 className="font-bold text-[#123E59]">Orden de ingreso</h2><p className="text-xs text-neutral-500 mt-1">Las marcas sin categoría no se muestran públicamente.</p><ol className="divide-y divide-neutral-200">{[...chosen.entries].sort((a,b)=>a.position-b.position).map(row=>{const mark=chosen.marks.find(m=>m.position===row.position);const draft=drafts[row.position]||{faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||''};return <li key={row.position} className="py-4 grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto] gap-3 items-end"><div className="col-span-2 sm:col-span-1 text-sm"><span className="font-bold text-[#123E59]">{row.position}. {row.rider}</span><span className="block text-neutral-600">{row.horse}{row.category ? ' · '+row.category : ' · Sin categoría'}</span></div><label className="text-xs font-bold">Faltas<input className={input+' mt-1'} inputMode="numeric" value={draft.faults} onChange={e=>change(row.position,'faults',e.target.value,mark)} /></label><label className="text-xs font-bold">Tiempo (seg.)<input className={input+' mt-1'} inputMode="decimal" value={draft.seconds} onChange={e=>change(row.position,'seconds',e.target.value,mark)} /></label><button disabled={busy!==null} onClick={()=>void save(row,mark)} className="bg-[#123E59] text-white px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50">{busy===row.position?'Guardando…':mark?'Corregir':'Guardar'}</button></li>})}</ol></div>}</>}
    {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}{message&&<p role="status" className="text-green-700 text-sm">{message}</p>}
  </section>;
};
