import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { hasTwoPhases } from '../../utils/livePhases';
import { moveLivePosition, orderLiveEntries } from '../../utils/liveOrder';

type Participant = {position:number; rider:string; horse:string; category?:string; club?:string};
type Mark = {position:number; obstacle_faults:number; time_seconds:number; phase2_faults:number|null; phase2_seconds:number|null};
type LiveClass = {id:string; number:string; name:string; description:string; event_date:string; versionId:string; entries:Participant[]; marks:Mark[]; tracking:{current_position:number|null; no_shows:number[]; live_order:number[]|null}|null};
export const ExternalLiveResults: React.FC<{eventId:string; eventName:string; onBack:()=>void}> = ({eventId,eventName,onBack}) => {
  const [classes,setClasses]=useState<LiveClass[]>([]);
  const [classId,setClassId]=useState('');
  const [drafts,setDrafts]=useState<Record<number,{faults:string;seconds:string;secondFaults:string;secondSeconds:string}>>({});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState(''), [message,setMessage]=useState('');
  const [dragging,setDragging]=useState<number|null>(null), [dropTarget,setDropTarget]=useState<number|null>(null);
  const drag=useRef<{position:number;target:number;startX:number;startY:number;moved:boolean}|null>(null);
  const load=async()=>{
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_list',eventId}});
    if(error || !Array.isArray(data?.classes)) { setError('No se pudieron cargar las pruebas. Verificá que tu acceso siga vigente.'); setLoading(false); return; }
    setClasses(data.classes); setLoading(false);
  };
  useEffect(()=>{void load();},[eventId]);
  const chosen=classes.find(c=>c.id===classId);
  const setTracking=async(position:number,operation:'current'|'absent'|'restore')=>{
    if(!chosen)return;
    setBusy(position);setError('');setMessage('');
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_tracking',eventId,classId:chosen.id,startVersionId:chosen.versionId,position,operation}});
    if(error || !data?.success) setError('No se pudo actualizar el estado. Verificá tu acceso y actualizá el listado.');
    else {await load();setMessage('Estado actualizado.');}
    setBusy(null);
  };
  const move=async(position:number,target:number)=>{
    if(!chosen)return;
    const order=orderLiveEntries(chosen.entries,chosen.tracking?.live_order).map(row=>row.position);
    const changed=moveLivePosition(order,position,target);
    if(changed===order)return;
    setBusy(position);setError('');setMessage('');
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_reorder',eventId,classId:chosen.id,startVersionId:chosen.versionId,expectedOrder:order,newOrder:changed}});
    if(error || !data?.success) {await load();setError('No se pudo cambiar el orden. Se actualizó el listado; revisalo e intentá nuevamente.');}
    else {await load();setMessage('Orden del vivo actualizado.');}
    setBusy(null);
  };
  const changeClass=(id:string)=>{setClassId(id);setDrafts({});setError('');setMessage('');};
  const change=(pos:number,key:'faults'|'seconds'|'secondFaults'|'secondSeconds',value:string,mark?:Mark)=>setDrafts(current=>({...current,[pos]:{...(current[pos] || {faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||'',secondFaults:mark?.phase2_faults?.toString() ?? '',secondSeconds:mark?.phase2_seconds?.toString() ?? ''}),[key]:value}}));
  const save=async(row:Participant,mark?:Mark)=>{
    if(!chosen)return;
    const values=drafts[row.position]||{faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||'',secondFaults:mark?.phase2_faults?.toString() ?? '',secondSeconds:mark?.phase2_seconds?.toString() ?? ''};
    const secondsText=values.seconds.trim().replace(',','.');
    if (!/^\d+$/.test(values.faults) || Number(values.faults)>999 || !/^\d+(?:\.\d{1,2})?$/.test(secondsText) || Number(secondsText)>9999999) {setError('Ingresá faltas enteras y un tiempo válido con hasta dos decimales.');return;}
    const secondSeconds=values.secondSeconds.trim().replace(',','.');
    const hasSecond=hasTwoPhases(chosen.description) && (values.secondFaults.trim() !== '' || secondSeconds !== '');
    if (hasSecond && (!/^\d+$/.test(values.secondFaults) || Number(values.secondFaults)>999 || !/^\d+(?:\.\d{1,2})?$/.test(secondSeconds) || Number(secondSeconds)>9999999)) {setError('Completá faltas y tiempo válidos para la segunda fase, o dejá ambos campos vacíos.');return;}
    setError('');setMessage('');setBusy(row.position);
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_save',eventId,classId:chosen.id,startVersionId:chosen.versionId,position:row.position,faults:Number(values.faults),seconds:Number(secondsText),secondFaults:hasSecond?Number(values.secondFaults):null,secondSeconds:hasSecond?Number(secondSeconds):null}});
    if(error || !data?.success) setError('No se pudo guardar. Verificá el acceso y actualizá si cambió el orden de ingreso.');
    else {await load();setDrafts(current=>{const next={...current};delete next[row.position];return next;});setMessage('Marca guardada como provisoria.');}
    setBusy(null);
  };
  const input='w-full h-10 px-2 border border-neutral-300 rounded-lg text-sm';
  return <section className="max-w-5xl mx-auto px-4 py-8 space-y-5"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#123E59] min-h-11"><ArrowLeft size={18}/>Volver al concurso</button><h1 className="text-2xl font-display font-black text-[#123E59]">Resultados en vivo</h1><p className="text-sm text-neutral-600">{eventName} · Las marcas se publican como provisorias y mantienen el orden de ingreso.</p>
    {loading?<p>Cargando pruebas…</p>:<><label className="block text-sm font-bold max-w-xl">Prueba<select className={input+' mt-1'} value={classId} onChange={e=>changeClass(e.target.value)}><option value="">Elegí una prueba</option>{classes.map(c=><option key={c.id} value={c.id}>{c.event_date.split('-').reverse().join('/')} · Prueba {c.number} — {c.name}</option>)}</select></label>{!classes.length&&<p className="text-sm text-neutral-600">No hay pruebas con orden de ingreso publicado.</p>}{chosen&&<div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs"><h2 className="font-bold text-[#123E59]">Orden de ingreso</h2><p className="text-xs text-neutral-500 mt-1">Arrastrá el ícono junto al binomio para cambiar el orden del vivo. El número original se conserva. Las marcas sin categoría no se muestran públicamente.</p><ol className="divide-y divide-neutral-200">{orderLiveEntries(chosen.entries,chosen.tracking?.live_order).map((row,index,ordered)=>{const mark=chosen.marks.find(m=>m.position===row.position);const draft=drafts[row.position]||{faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||'',secondFaults:mark?.phase2_faults?.toString() ?? '',secondSeconds:mark?.phase2_seconds?.toString() ?? ''};const isCurrent=chosen.tracking?.current_position===row.position;const isAbsent=chosen.tracking?.no_shows?.includes(row.position);return <li key={row.position} data-live-position={row.position} className={'py-4 flex flex-wrap gap-3 items-end '+(isCurrent?'bg-rose-50 ':'')+(dropTarget===row.position && dragging!==row.position?'ring-2 ring-[#A61E4D] ':'')+(dragging===row.position?'opacity-60':'')}><button type="button" disabled={busy!==null} aria-label={`Arrastrar a ${row.rider}; también podés usar las flechas arriba y abajo`} title="Arrastrar para cambiar el orden" className="min-w-11 min-h-11 flex items-center justify-center text-[#123E59] cursor-grab active:cursor-grabbing touch-none select-none disabled:opacity-50" onPointerDown={e=>{if(busy!==null)return; e.currentTarget.setPointerCapture(e.pointerId); drag.current={position:row.position,target:row.position,startX:e.clientX,startY:e.clientY,moved:false};}} onPointerMove={e=>{if(!drag.current)return; if(Math.hypot(e.clientX-drag.current.startX,e.clientY-drag.current.startY)>5){drag.current.moved=true;setDragging(drag.current.position);} const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-live-position]');const target=Number(el?.getAttribute('data-live-position'));if(el && Number.isInteger(target)){drag.current.target=target;setDropTarget(target);}}} onPointerUp={e=>{const current=drag.current;drag.current=null;setDragging(null);setDropTarget(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(current?.moved && current.target!==current.position)void move(current.position,current.target);}} onPointerCancel={()=>{drag.current=null;setDragging(null);setDropTarget(null);}} onKeyDown={e=>{if(e.key==='ArrowUp' || e.key==='ArrowDown'){e.preventDefault();const target=ordered[index+(e.key==='ArrowUp'?-1:1)];if(target)void move(row.position,target.position);}}}><GripVertical aria-hidden="true" size={20}/></button><div className="w-full sm:min-w-48 sm:flex-1 text-sm"><span className="font-bold text-[#123E59]">{row.rider}</span><span className="block text-xs text-neutral-500">Orden original: {row.position}</span><span className="block text-neutral-600">{row.horse}{row.category ? ' · '+row.category : ' · Sin categoría'}</span><span className="block mt-1 text-xs font-bold text-[#A61E4D]">{isCurrent?'En pista':isAbsent?'No se presentó':mark?'Resultado cargado':'Pendiente'}</span><div className="flex flex-wrap gap-2 mt-2"><button disabled={busy!==null || isCurrent || isAbsent} onClick={()=>void setTracking(row.position,'current')} className="text-xs font-bold text-[#123E59] underline disabled:opacity-50 min-h-9">Marcar en pista</button>{!mark && <button disabled={busy!==null} onClick={()=>void setTracking(row.position,isAbsent?'restore':'absent')} className="text-xs font-bold text-[#123E59] underline disabled:opacity-50 min-h-9">{isAbsent?'Volver a pendiente':'No se presentó'}</button>}</div></div><label className="text-xs font-bold w-28">{hasTwoPhases(chosen.description)?'Fase 1 · Faltas':'Faltas'}<input className={input+' mt-1'} inputMode="numeric" value={draft.faults} onChange={e=>change(row.position,'faults',e.target.value,mark)} /></label><label className="text-xs font-bold w-32">{hasTwoPhases(chosen.description)?'Fase 1 · Tiempo (seg.)':'Tiempo (seg.)'}<input className={input+' mt-1'} inputMode="decimal" value={draft.seconds} onChange={e=>change(row.position,'seconds',e.target.value,mark)} /></label>{hasTwoPhases(chosen.description)&&<><label className="text-xs font-bold w-28">Fase 2 · Faltas<input className={input+' mt-1'} inputMode="numeric" value={draft.secondFaults} onChange={e=>change(row.position,'secondFaults',e.target.value,mark)} /></label><label className="text-xs font-bold w-32">Fase 2 · Tiempo (seg.)<input className={input+' mt-1'} inputMode="decimal" value={draft.secondSeconds} onChange={e=>change(row.position,'secondSeconds',e.target.value,mark)} /></label></>}<button disabled={busy!==null || isAbsent} onClick={()=>void save(row,mark)} className="bg-[#123E59] text-white px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50">{busy===row.position?'Guardando…':mark?'Corregir':'Guardar'}</button></li>})}</ol></div>}</>}
    {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}{message&&<p role="status" className="text-green-700 text-sm">{message}</p>}
  </section>;
};
