import {ManualLiveRow} from './ManualLiveRow';
import {ManualEntryForm} from './ManualEntryForm';
import {type ManualEntry} from '../../utils/liveMatches';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, GripVertical, Play, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { hasTwoPhases } from '../../utils/livePhases';
import { combinedLiveKeys, moveLivePosition, orderLiveEntries } from '../../utils/liveOrder';

type Participant = {position:number; rider:string; horse:string; category?:string; club?:string};
type Mark = {position:number; obstacle_faults:number; time_seconds:number; phase2_faults:number|null; phase2_seconds:number|null};
type LiveClass = {started:boolean;publicVisible:boolean;manual?:ManualEntry[];manualTracking:{current_manual_id:string|null;no_shows:string[]}|null;combined:{entries:string[];revision:number}|null;id:string; number:string; name:string; description:string; event_date:string; versionId:string; entries:Participant[]; marks:Mark[]; tracking:{current_position:number|null; no_shows:number[]; live_order:number[]|null}|null};
export const ExternalLiveResults: React.FC<{eventId:string; eventName:string; onBack:()=>void}> = ({eventId,eventName,onBack}) => {
  const [classes,setClasses]=useState<LiveClass[]>([]);
  const [classId,setClassId]=useState('');
  const [drafts,setDrafts]=useState<Record<number,{faults:string;seconds:string;secondFaults:string;secondSeconds:string}>>({});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState<number|null>(null);
  const [error,setError]=useState(''), [message,setMessage]=useState('');
  const [dragging,setDragging]=useState<string|null>(null);
  const [previewOrder,setPreviewOrder]=useState<string[]|null>(null);
  const [editing,setEditing]=useState<ManualEntry|'new'|null>(null);
  const tableRegion=useRef<HTMLDivElement>(null);
  const drag=useRef<{position:string;target:string;startX:number;startY:number;moved:boolean}|null>(null);
  const load=async()=>{
    const [result,sharing]=await Promise.all([supabase.functions.invoke('external-assignments',{body:{action:'live_list',eventId}}),supabase.functions.invoke('live-visibility',{body:{action:'list',eventId}})]);
    if(result.error || !Array.isArray(result.data?.classes) || sharing.error || !Array.isArray(sharing.data?.classes)) { setError('No se pudieron cargar las pruebas. Verificá que tu acceso siga vigente.'); setLoading(false); return; }
    const visibility=new Map<string,boolean>(sharing.data.classes.map((c:{class_id:string;public_visible:boolean})=>[c.class_id,c.public_visible]));
    setClasses(result.data.classes.map((c:LiveClass)=>({...c,publicVisible:visibility.get(c.id)??false}))); setLoading(false);
  };
  useEffect(()=>{void load();},[eventId]);
  const chosen=classes.find(c=>c.id===classId);
  const [starting,setStarting]=useState(false);
  const [visibilityBusy,setVisibilityBusy]=useState(false);
  const toggleVisibility=async()=>{
    if(!chosen || visibilityBusy)return;
    const visible=!chosen.publicVisible;
    setVisibilityBusy(true);setError('');setMessage('');
    try {
      const {data,error}=await supabase.functions.invoke('live-visibility',{body:{action:'set',eventId,classId:chosen.id,visible}});
      if(error||!data?.success)throw new Error('visibility failed');
      await load();
      setMessage(visible?'Los resultados en vivo se están compartiendo.':'Los resultados en vivo dejaron de compartirse. Los datos siguen guardados.');
    } catch {setError('No se pudo cambiar la visibilidad. Verificá tu acceso e intentá nuevamente.');}
    finally {setVisibilityBusy(false);}
  };
  const startLive=async()=>{
    if(!chosen || starting)return;
    setStarting(true);setError('');setMessage('');
    try {
      const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_start',eventId,classId:chosen.id}});
      if(error || !data?.success) throw new Error('start failed');
      await load();
    } catch {setError('No se pudo iniciar la carga. Verificá tu acceso e intentá nuevamente.');}
    finally {setStarting(false);}
  };
  const setTracking=async(position:number,operation:'current'|'absent'|'restore')=>{
    if(!chosen)return;
    setBusy(position);setError('');setMessage('');
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'live_tracking',eventId,classId:chosen.id,startVersionId:chosen.versionId,position,operation}});
    if(error || !data?.success) setError('No se pudo actualizar el estado. Verificá tu acceso y actualizá el listado.');
    else {await load();setMessage('Estado actualizado.');}
    setBusy(null);
  };
  const setManualTracking=async(manualId:string,operation:'current'|'absent'|'restore')=>{
    if(!chosen)return;
    setBusy(-1);setError('');setMessage('');
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'manual_tracking',eventId,classId:chosen.id,manualId,operation}});
    if(error||!data?.success)setError('No se pudo actualizar el estado. Verificá tu acceso e intentá nuevamente.');
    else {await load();setMessage('Estado actualizado.');}
    setBusy(null);
  };
  const move=async(position:string,target:string)=>{
    if(!chosen)return;
    const order=combinedLiveKeys(orderLiveEntries(chosen.entries,chosen.tracking?.live_order).map(row=>row.position), (chosen.manual??[]).map(row=>row.id),chosen.combined?.entries);
    const changed=moveLivePosition(order,position,target);
    if(changed===order)return;
    setBusy(-1);setError('');setMessage('');
    const {data,error}=await supabase.functions.invoke('external-assignments',{body:{action:'combined_reorder',eventId,classId:chosen.id,startVersionId:chosen.versionId,revision:chosen.combined?.revision??0,order:changed}});
    if(error || !data?.success) {await load();setError('No se pudo cambiar el orden. Se actualizó el listado; revisalo e intentá nuevamente.');}
    else {await load();setMessage('Orden del vivo actualizado.');}
    setBusy(null);
  };
  const changeClass=(id:string)=>{setPreviewOrder(null);setClassId(id);setEditing(null);setDrafts({});setError('');setMessage('');};
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
  const ordered=chosen ? combinedLiveKeys(orderLiveEntries(chosen.entries,chosen.tracking?.live_order).map(x=>x.position),(chosen.manual??[]).map(x=>x.id),previewOrder ?? chosen.combined?.entries) : [];
  const dragButton=(key:string,rider:string,index:number)=><button type="button" disabled={busy!==null} aria-label={`Arrastrar a ${rider}; también podés usar las flechas arriba y abajo`} title="Arrastrar para cambiar el orden" className="min-w-11 min-h-11 inline-flex items-center justify-center text-[#123E59] cursor-grab active:cursor-grabbing touch-none select-none disabled:opacity-50"
    onPointerDown={e=>{if(busy!==null)return; tableRegion.current?.setPointerCapture(e.pointerId); drag.current={position:key,target:key,startX:e.clientX,startY:e.clientY,moved:false};}}
    onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const target=ordered[index+(e.key==='ArrowUp'?-1:1)];if(target)void move(key,target);}}}><GripVertical aria-hidden="true" size={20}/></button>;
  const twoPhases=!!chosen && hasTwoPhases(chosen.description);
  return <section className="max-w-6xl mx-auto px-4 py-8 space-y-5">
    <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-[#123E59] min-h-11"><ArrowLeft size={18}/>Volver al concurso</button>
    <h1 className="text-2xl font-display font-black text-[#123E59]">Resultados en vivo</h1>
    <p className="text-sm text-neutral-600">{eventName} · Las marcas se publican como provisorias.</p>
    {loading ? <p>Cargando pruebas…</p> : <>
      <label className="block text-sm font-bold max-w-xl">Prueba<select className={input+' mt-1'} value={classId} onChange={e=>changeClass(e.target.value)}><option value="">Elegí una prueba</option>{classes.map(c=><option key={c.id} value={c.id}>{c.event_date.split('-').reverse().join('/')} · Prueba {c.number} — {c.name}</option>)}</select></label>
      {!classes.length && <p className="text-sm text-neutral-600">No hay pruebas con orden de ingreso publicado.</p>}
      {chosen && !chosen.started && <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs"><button type="button" disabled={starting} onClick={()=>void startLive()} className="inline-flex items-center gap-2 bg-[#A61E4D] text-white px-4 min-h-11 rounded-lg font-bold disabled:opacity-50"><Play size={18}/>{starting?'Iniciando…':'Iniciar carga de resultados en vivo'}</button></div>}
      {chosen && chosen.started && <div className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex justify-end mb-4"><button type="button" className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-[#A61E4D] text-white text-sm font-bold hover:bg-[#85163c]" onClick={()=>setEditing(editing==='new'?null:'new')}><Plus size={18} aria-hidden="true"/>Agregar binomio</button></div>
        {editing&&<ManualEntryForm key={editing==='new'?'new':editing.id} classId={chosen.id} eventId={eventId} twoPhases={twoPhases} row={editing==='new'?undefined:editing} done={()=>{setEditing(null);void load();}}/>}
        <h2 className="font-bold text-[#123E59]">Orden de ingreso</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-4">Arrastrá el ícono para cambiar el orden del vivo. Las marcas sin categoría no se muestran públicamente.</p>
        <div className="overflow-auto max-h-[70vh] border border-neutral-200 rounded-xl" role="region" aria-label="Tabla de carga de resultados" tabIndex={0}
          onPointerMove={e=>{const d=drag.current;if(!d||!chosen)return;if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>5){d.moved=true;setDragging(d.position);} if(!d.moved)return;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-live-key]');const target=el?.getAttribute('data-live-key');if(target && target!==d.position && target!==d.target){d.target=target;setPreviewOrder(current=>moveLivePosition(current ?? ordered,d.position,target));}}}
          onPointerUp={e=>{const d=drag.current;drag.current=null;setDragging(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d?.moved && d.target!==d.position)void move(d.position,d.target).finally(()=>setPreviewOrder(null));else setPreviewOrder(null);}}
          onPointerCancel={()=>{drag.current=null;setDragging(null);setPreviewOrder(null);}} ref={tableRegion}>
          <table className="w-full min-w-[780px] text-sm text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-[#123E59] text-white">
              <tr><th rowSpan={2} scope="col" className="p-3">Orden / binomio</th><th colSpan={2} scope="colgroup" className="p-2 text-center border-l border-white/20">{twoPhases?'Fase 1':'Resultado'}</th>{twoPhases && <th colSpan={2} scope="colgroup" className="p-2 text-center border-l border-white/20">Fase 2</th>}<th rowSpan={2} scope="col" className="p-3">Acción</th></tr>
              <tr><th scope="col" className="px-3 pb-2 border-l border-white/20">Faltas</th><th scope="col" className="px-3 pb-2">Tiempo (seg.)</th>{twoPhases&&<><th scope="col" className="px-3 pb-2 border-l border-white/20">Faltas</th><th scope="col" className="px-3 pb-2">Tiempo (seg.)</th></>}</tr>
            </thead>
            <tbody>{ordered.map((key,index)=>{
              if(key.startsWith('m:')) {const row=(chosen.manual??[]).find(m=>`m:${m.id}`===key);return row ? <ManualLiveRow key={key} row={row} eventId={eventId} classId={chosen.id} versionId={chosen.versionId} twoPhases={twoPhases} dragHandle={dragButton(key,row.rider,index)} dragging={dragging===key} current={chosen.manualTracking?.current_manual_id===row.id} absent={chosen.manualTracking?.no_shows?.includes(row.id)??false} disabled={busy!==null} onTracking={action=>void setManualTracking(row.id,action)} onSaved={()=>{void load();setMessage('Marca guardada como provisoria.');}} /> : null;}
              const row=chosen.entries.find(item=>`p:${item.position}`===key); if(!row)return null;
              const mark=chosen.marks.find(m=>m.position===row.position);
              const draft=drafts[row.position]||{faults:mark?.obstacle_faults?.toString()||'0',seconds:mark?.time_seconds?.toString()||'',secondFaults:mark?.phase2_faults?.toString() ?? '',secondSeconds:mark?.phase2_seconds?.toString() ?? ''};
              const isCurrent=chosen.tracking?.current_position===row.position;
              const isAbsent=chosen.tracking?.no_shows?.includes(row.position);
              return <tr key={key} data-live-key={key} className={'transition-colors '+(isCurrent?'bg-rose-50 ':'bg-white ')+(dragging===key?'opacity-60 outline-2 outline-[#A61E4D]':'')}>
                <td className="p-2 border-t border-neutral-200 min-w-72"><div className="flex items-start gap-1">
                  {dragButton(key,row.rider,index)}
                  <div><span className="font-bold text-[#123E59]">{row.rider}</span><span className="block text-neutral-600">{row.horse}{row.category?' · '+row.category:' · Sin categoría'}</span><span className="block mt-1 text-xs font-bold text-[#A61E4D]">{isCurrent?'En pista':isAbsent?'No se presentó':mark?'Resultado cargado':'Pendiente'}</span><div className="flex flex-wrap gap-2 mt-1"><button disabled={busy!==null||isCurrent||isAbsent} onClick={()=>void setTracking(row.position,'current')} className="text-xs font-bold text-[#123E59] underline disabled:opacity-50 min-h-9">Marcar en pista</button>{!mark&&<button disabled={busy!==null} onClick={()=>void setTracking(row.position,isAbsent?'restore':'absent')} className="text-xs font-bold text-[#123E59] underline disabled:opacity-50 min-h-9">{isAbsent?'Volver a pendiente':'No se presentó'}</button>}</div></div>
                </div></td>
                <td className="p-2 border-t border-neutral-200 min-w-24"><input aria-label={`Faltas ${twoPhases?'fase 1 ':''}de ${row.rider}`} className={input} inputMode="numeric" value={draft.faults} onChange={e=>change(row.position,'faults',e.target.value,mark)}/></td>
                <td className="p-2 border-t border-neutral-200 min-w-28"><input aria-label={`Tiempo ${twoPhases?'fase 1 ':''}de ${row.rider}`} className={input} inputMode="decimal" value={draft.seconds} onChange={e=>change(row.position,'seconds',e.target.value,mark)}/></td>
                {twoPhases&&<><td className="p-2 border-t border-neutral-200 min-w-24"><input aria-label={`Faltas fase 2 de ${row.rider}`} className={input} inputMode="numeric" value={draft.secondFaults} onChange={e=>change(row.position,'secondFaults',e.target.value,mark)}/></td><td className="p-2 border-t border-neutral-200 min-w-28"><input aria-label={`Tiempo fase 2 de ${row.rider}`} className={input} inputMode="decimal" value={draft.secondSeconds} onChange={e=>change(row.position,'secondSeconds',e.target.value,mark)}/></td></>}
                <td className="p-2 border-t border-neutral-200"><button disabled={busy!==null||isAbsent} onClick={()=>void save(row,mark)} className="bg-[#123E59] text-white px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50">{busy===row.position?'Guardando…':mark?'Corregir':'Guardar'}</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">{chosen.publicVisible?'Los resultados en vivo son visibles en el sitio público.':'Los resultados en vivo no se comparten. Los datos siguen guardados.'}</p>
          <button type="button" disabled={visibilityBusy} onClick={()=>void toggleVisibility()} className="min-h-11 rounded-lg border border-[#A61E4D] px-4 py-2 text-sm font-bold text-[#A61E4D] hover:bg-rose-50 disabled:opacity-50">{visibilityBusy?'Guardando…':chosen.publicVisible?'Dejar de compartir resultados en vivo':'Volver a compartir resultados en vivo'}</button>
        </div>
      </div>}
    </>}
    {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}{message&&<p role="status" className="text-green-700 text-sm">{message}</p>}
  </section>;
};
