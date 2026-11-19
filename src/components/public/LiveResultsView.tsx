import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';
import { publishedStartList } from '../../utils/startLists';
import { hasTwoPhases } from '../../utils/livePhases';
type Mark = { position:number; obstacle_faults:number; time_seconds:number; phase2_faults:number|null; phase2_seconds:number|null; start_version_id:string };
export const LiveResultsView: React.FC<{classId:string}> = ({classId}) => {
  const {classes,startHeads,startVersions,setSelectedEventId}=useEquestrian();
  const entry=classes.find(c=>c.id===classId);
  const list=publishedStartList(classId,startHeads,startVersions);
  const [marks,setMarks]=useState<Mark[]>([]), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{const {data,error}=await supabase.from('provisional_live_results').select('position,obstacle_faults,time_seconds,phase2_faults,phase2_seconds,start_version_id').eq('class_id',classId);if(!active)return;if(error)setError('No se pudieron cargar las marcas provisorias.');else {setError('');setMarks(data||[]);}setLoading(false);};
    void refresh();const timer=window.setInterval(()=>void refresh(),15000);return()=>{active=false;window.clearInterval(timer);};
  },[classId]);
  const rows=(list?.entries||[]).filter(row=>row.category?.trim()).map(row=>({row,mark:marks.find(m=>m.start_version_id===list?.id&&m.position===row.position)}));
  return <section className="min-h-[calc(100vh-64px)] bg-[#f4f6f8] px-4 py-6"><div className="max-w-5xl mx-auto"><button onClick={()=>setSelectedEventId(entry?.eventId||null)} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18}/>Volver al concurso</button><div className="mt-4 bg-white border border-neutral-200/80 rounded-2xl p-4 sm:p-6 shadow-xs"><p className="text-xs font-bold uppercase tracking-wider text-[#A61E4D]">Prueba {entry?.number}</p><h1 className="font-display text-2xl font-bold text-[#123E59]">{entry?.name || 'Resultados en vivo'}</h1><p className="mt-3 text-sm font-bold text-[#A61E4D]">Resultados provisorios · No oficiales</p><p className="text-sm text-neutral-600 mt-1">Orden de ingreso; sin clasificación.</p>{loading?<p className="py-6">Cargando marcas…</p>:error?<p role="alert" className="py-6 text-red-700">{error}</p>:!list?<p className="py-6">El orden de ingreso no está disponible.</p>:!marks.length?<p className="py-6 text-neutral-500">Todavía no hay marcas publicadas.</p>:<div className="overflow-x-auto mt-5"><table className="w-full text-left text-sm"><thead className="bg-[#123E59] text-white"><tr><th className="p-3">Orden</th><th className="p-3">Jinete / Caballo</th><th className="p-3">{hasTwoPhases(entry?.description) ? 'Fase 1 · Faltas' : 'Faltas'}</th><th className="p-3">{hasTwoPhases(entry?.description) ? 'Fase 1 · Tiempo' : 'Tiempo'}</th>{hasTwoPhases(entry?.description) && <><th className="p-3">Fase 2 · Faltas</th><th className="p-3">Fase 2 · Tiempo</th></>}</tr></thead><tbody className="divide-y divide-neutral-200">{rows.map(({row,mark})=><tr key={row.position}><td className="p-3">{row.position}</td><td className="p-3"><span className="font-bold text-[#123E59]">{row.rider}</span><span className="block text-neutral-600">{row.horse} · {row.category}</span></td><td className="p-3">{mark?.obstacle_faults ?? '—'}</td><td className="p-3">{mark ? `${Number(mark.time_seconds).toFixed(2)} s` : '—'}</td>{hasTwoPhases(entry?.description)&&<><td className="p-3">{mark?.phase2_faults ?? '—'}</td><td className="p-3">{mark?.phase2_seconds != null ? `${Number(mark.phase2_seconds).toFixed(2)} s` : '—'}</td></>}</tr>)}</tbody></table></div>}</div></div></section>;
};
