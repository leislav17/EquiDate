import {resolveManual,type ManualEntry} from '../../utils/liveMatches';
import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';
import { publishedStartList } from '../../utils/startLists';
import { hasTwoPhases } from '../../utils/livePhases';
import { combinedLiveKeys, orderLiveEntries } from '../../utils/liveOrder';
type Mark = { position:number; obstacle_faults:number; time_seconds:number; phase2_faults:number|null; phase2_seconds:number|null; start_version_id:string };
export const LiveResultsView: React.FC<{classId:string}> = ({classId}) => {
  const {classes,startHeads,startVersions,setSelectedEventId}=useEquestrian();
  const entry=classes.find(c=>c.id===classId);
  const list=publishedStartList(classId,startHeads,startVersions);
  const [tracking,setTracking]=useState<{start_version_id:string;current_position:number|null;no_shows:number[];live_order:number[]|null}|null>(null);
  const [manual,setManual]=useState<ManualEntry[]>([]);
  const [manualTracking,setManualTracking]=useState<{current_manual_id:string|null;no_shows:string[]}|null>(null);
  const [combined,setCombined]=useState<string[]|null>(null);
  const [marks,setMarks]=useState<Mark[]>([]), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{const [result,state,extra]=await Promise.all([supabase.from('provisional_live_results').select('position,obstacle_faults,time_seconds,phase2_faults,phase2_seconds,start_version_id').eq('class_id',classId),supabase.from('live_tracking').select('start_version_id,current_position,no_shows,live_order').eq('class_id',classId).eq('start_version_id',list?.id??'00000000-0000-0000-0000-000000000000').maybeSingle(),supabase.from('manual_live_entries').select('*').eq('class_id',classId).order('created_at')]);const {data,error}=result;if(!active)return;if(error||state.error||extra.error)setError('No se pudieron cargar las marcas provisorias.');else {setError('');setManual(extra.data??[]);setMarks(data||[]);setTracking(state.data);}setLoading(false);};
    const refreshOrder=async()=>{const [result,state]=await Promise.all([list?.id ? supabase.from('live_combined_order').select('entries').eq('class_id',classId).eq('start_version_id',list.id).maybeSingle() : supabase.from('live_manual_only_order').select('entries').eq('class_id',classId).maybeSingle(),supabase.from('manual_live_tracking').select('current_manual_id,no_shows').eq('class_id',classId).maybeSingle()]);if(active && !result.error)setCombined(result.data?.entries??null);if(active && !state.error)setManualTracking(state.data);};
    void refresh();void refreshOrder();const timer=window.setInterval(()=>{void refresh();void refreshOrder();},15000);return()=>{active=false;window.clearInterval(timer);};
  },[classId,list?.id]);
  const resolved=resolveManual(manual,list?.entries??[]);
  const rows=orderLiveEntries(list?.entries||[],tracking && list && tracking.start_version_id===list.id ? tracking.live_order : null).filter(row=>row.category?.trim()).map(row=>({row,mark:marks.find(m=>m.start_version_id===list?.id&&m.position===row.position)??resolved.find(m=>m.target===row.position&&m.time_seconds!=null)}));
  return <section className="min-h-[calc(100vh-64px)] bg-[#f4f6f8] px-4 py-6"><div className="max-w-5xl mx-auto"><button onClick={()=>setSelectedEventId(entry?.eventId||null)} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18}/>Volver al concurso</button><div className="mt-4 bg-white border border-neutral-200/80 rounded-2xl p-4 sm:p-6 shadow-xs"><p className="text-xs font-bold uppercase tracking-wider text-[#A61E4D]">Prueba {entry?.number}</p><h1 className="font-display text-2xl font-bold text-[#123E59]">{entry?.name || 'Resultados en vivo'}</h1><p className="mt-3 text-sm font-bold text-[#A61E4D]">Resultados provisorios · No oficiales</p><p className="text-sm text-neutral-600 mt-1">Orden del seguimiento en vivo; sin clasificación.</p>{loading?<p className="py-6">Cargando marcas…</p>:error?<p role="alert" className="py-6 text-red-700">{error}</p>:<div className="overflow-x-auto mt-5"><table className="w-full text-left text-sm"><thead className="bg-[#123E59] text-white"><tr><th rowSpan={2} scope="col" className="p-3">Jinete / Caballo / Categoría</th><th colSpan={2} scope="colgroup" className="p-2 text-center border-l border-white/20">{hasTwoPhases(entry?.description)?'Fase 1':'Resultado'}</th>{hasTwoPhases(entry?.description)&&<th colSpan={2} scope="colgroup" className="p-2 text-center border-l border-white/20">Fase 2</th>}</tr><tr><th scope="col" className="px-3 pb-3 border-l border-white/20">Faltas</th><th scope="col" className="px-3 pb-3">Tiempo</th>{hasTwoPhases(entry?.description)&&<><th scope="col" className="px-3 pb-3 border-l border-white/20">Faltas</th><th scope="col" className="px-3 pb-3">Tiempo</th></>}</tr></thead><tbody className="divide-y divide-neutral-200">{combinedLiveKeys(rows.map(x=>x.row.position),resolved.map(x=>x.id),combined).map(key=>{
    const published=key.startsWith('p:')?rows.find(x=>'p:'+x.row.position===key):undefined;
    const added=key.startsWith('m:')?resolved.find(x=>'m:'+x.id===key):undefined;
    if(added?.target!=null && rows.some(x=>x.row.position===added.target))return null;
    const row=published?.row??added, mark=published?.mark??added;
    if(!row || !row.category?.trim())return null;
    const pos=published?.row.position;
    const manualId=added?.id ?? resolved.find(m=>m.target===pos)?.id;
    const current=Boolean((manualId && manualTracking?.current_manual_id===manualId) || (pos!=null && tracking?.start_version_id===list?.id && tracking?.current_position===pos));
    return <tr key={key} className={current?'bg-rose-200':''}><td className="p-3"><span className="font-bold text-[#123E59]">{row.rider}</span>{current && <span className="sr-only"> · En pista</span>}<span className="block text-neutral-600">{row.horse} · {row.category}</span></td><td className="p-3">{mark?.obstacle_faults??'-'}</td><td className="p-3">{mark?.time_seconds!=null?Number(mark.time_seconds).toFixed(2)+' s':'-'}</td>{hasTwoPhases(entry?.description)&&<><td className="p-3">{mark?.phase2_faults??'-'}</td><td className="p-3">{mark?.phase2_seconds!=null?Number(mark.phase2_seconds).toFixed(2)+' s':'-'}</td></>}</tr>;
  })}</tbody></table></div>}</div></div></section>;
};
