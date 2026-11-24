import { liveClassHeight, resolvePartTimes, timeGroup, totalLiveFaults, type LiveTimeLimits } from '../../utils/liveTimeLimits';
import type {ManualEntry} from '../../utils/liveMatches';
import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';
import type { StartEntry } from '../../utils/startLists';
import { liveParts } from '../../utils/livePhases';
import { liveCategoryName } from '../../utils/competitionCatalog';
import { combinedLiveKeys, orderLiveEntries } from '../../utils/liveOrder';
import { SponsorSection } from './SponsorSection';
type Mark = { position:number; obstacle_faults:number; time_seconds:number; phase2_faults:number|null; phase2_seconds:number|null; start_version_id:string };
export const LiveResultsView: React.FC<{classId:string;embedded?:boolean;onBack?:()=>void}> = ({classId,embedded=false,onBack}) => {
  const {classes,events,setSelectedEventId}=useEquestrian();
  const entry=classes.find(c=>c.id===classId);
  const [snapshot,setSnapshot]=useState<{classId:string; id:string|null; entries:StartEntry[]}|null>(null);
  const list=snapshot?.classId===classId?snapshot:null;
  const [tracking,setTracking]=useState<{start_version_id:string;current_position:number|null;no_shows:number[];live_order:number[]|null}|null>(null);
  const [manual,setManual]=useState<ManualEntry[]>([]);
  const [manualTracking,setManualTracking]=useState<{current_manual_id:string|null;no_shows:string[]}|null>(null);
  const [visibility,setVisibility]=useState<{classId:string; shared:boolean}|null>(null);
  const isShared=visibility?.classId===classId?visibility.shared:null;
  const [combined,setCombined]=useState<string[]|null>(null);
  const [timeLimits, setTimeLimits] = useState<LiveTimeLimits>({});
  const [roundQualifiers,setRoundQualifiers]=useState<string[]>([]);
  const [marks,setMarks]=useState<Mark[]>([]), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{const [result,state,extra,limits]=await Promise.all([supabase.from('provisional_live_results').select('position,obstacle_faults,time_seconds,phase2_faults,phase2_seconds,start_version_id').eq('class_id',classId),supabase.from('live_tracking').select('start_version_id,current_position,no_shows,live_order').eq('class_id',classId).eq('start_version_id',list?.id??'00000000-0000-0000-0000-000000000000').maybeSingle(),supabase.from('manual_live_entries').select('*').eq('class_id',classId).order('created_at'),supabase.from('live_time_limits').select('settings').eq('class_id',classId).maybeSingle()]);const {data,error}=result;if(!active)return;if(error||state.error||extra.error||limits.error)setError('No se pudieron cargar las marcas provisorias.');else {setError('');setManual(extra.data??[]);setMarks(data||[]);setTracking(state.data);setTimeLimits(limits.data?.settings??{});}setLoading(false);};
    const refreshOrder=async()=>{const [result,state,rounds]=await Promise.all([list?.id ? supabase.from('live_combined_order').select('entries').eq('class_id',classId).eq('start_version_id',list.id).maybeSingle() : supabase.from('live_manual_only_order').select('entries').eq('class_id',classId).maybeSingle(),supabase.from('manual_live_tracking').select('current_manual_id,no_shows').eq('class_id',classId).maybeSingle(),supabase.from('live_second_round_qualifiers').select('entry_key').eq('class_id',classId)]);if(active && !result.error)setCombined(result.data?.entries??null);if(active && !state.error)setManualTracking(state.data);if(active && !rounds.error)setRoundQualifiers((rounds.data??[]).map(q=>q.entry_key));};
    const refreshLive=async()=>{
      const {data,error}=await supabase.from('live_start_snapshots').select('version_id,entries').eq('class_id',classId).maybeSingle();
      if(!active)return;
      if(error||!data){
        setVisibility({classId,shared:false});
        setSnapshot(current=>current?.classId===classId?null:current);
      }else if(!list){
        setSnapshot({classId,id:data.version_id,entries:data.entries});
      }else{
        await Promise.all([refresh(),refreshOrder()]);
        if(active){
          setSnapshot({classId,id:data.version_id,entries:data.entries});
          setVisibility({classId,shared:true});
        }
      }
    };
    void refreshLive();
    const timer=window.setInterval(()=>void refreshLive(),15000);
    return()=>{active=false;window.clearInterval(timer);};
  },[classId,list?.classId,list?.id]);
  const { jumpOff, qualifiedSecond: isDouble, twoPhases } = liveParts(entry ?? {});
  const height = entry?.catalog?.heightCm ?? liveClassHeight(entry?.name, entry?.description);
  const secondHeight = entry?.catalog?.secondHeightCm ?? height;
  const recordedCategories = [...(list?.entries ?? []), ...manual].map(row => liveCategoryName(entry?.catalog, row.category));
  const allowances = (part: '1' | '2', partHeight?: number) => {
    const times = resolvePartTimes(timeLimits[part], partHeight);
    const groups = new Set(recordedCategories.map(category => timeGroup(category, partHeight)));
    if (times.sharedAllowed == null && groups.has('school') !== groups.has('third')) {
      times.sharedAllowed = groups.has('school') ? times.schoolAllowed : times.thirdAllowed;
    }
    return (category?: string) => times[`${timeGroup(liveCategoryName(entry?.catalog, category), partHeight)}Allowed`];
  };
  const firstAllowed = allowances('1', height);
  const secondAllowed = allowances('2', secondHeight);
  const rows=orderLiveEntries(list?.entries||[],tracking && list && tracking.start_version_id===list.id ? tracking.live_order : null).filter(row=>row.category?.trim()).map(row=>({row,mark:marks.find(m=>m.start_version_id===list?.id&&m.position===row.position)}));
  return <section className={embedded ? '@container bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-4 sm:p-6' : 'min-h-[calc(100vh-64px)] bg-[#f4f6f8] py-5 sm:py-6'}><div className={embedded ? '' : 'equidate-container'}><button onClick={()=>onBack?onBack():setSelectedEventId(entry?.eventId||null)} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18}/>{embedded?'Volver a las pruebas de la jornada':'Volver al concurso'}</button><div className={embedded ? 'mt-4' : 'mt-4 bg-white border border-neutral-200/80 rounded-2xl p-4 sm:p-6 shadow-xs'}><p className="text-xs font-bold uppercase tracking-wider text-[#A61E4D]">Prueba {entry?.number}</p><h1 className="font-display text-2xl font-bold text-[#123E59] break-words">{entry?.name || 'Resultados en vivo'}</h1><p className="mt-3 text-sm font-bold text-[#A61E4D]">Resultados provisorios · No oficiales</p><p className="text-sm text-neutral-600 mt-1">Orden del seguimiento en vivo; sin clasificación.</p>{isShared===null?<p className="py-6">Consultando resultados…</p>:!isShared?<p className="py-6 text-neutral-600">Los resultados en vivo no están disponibles para esta prueba.</p>:loading?<p className="py-6">Cargando marcas…</p>:error?<p role="alert" className="py-6 text-red-700">{error}</p>:<div className="mt-5 w-full min-w-0 overflow-x-auto"><table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"><colgroup><col className={twoPhases?'w-[42%]':'w-[56%]'} /><col /><col />{twoPhases&&<><col /><col /></>}</colgroup><thead className="bg-[#123E59] text-white text-[9px] sm:text-xs uppercase font-semibold"><tr><th rowSpan={2} scope="col" className="px-2 py-3 rounded-l-lg break-words">Jinete / Caballo / Categoría</th><th colSpan={2} scope="colgroup" className={twoPhases?'px-0.5 pt-3 text-center':'px-0.5 pt-3 text-center rounded-tr-lg'}>{jumpOff?'Recorrido':isDouble?'Recorrido 1':twoPhases?'Fase 1':'Resultado'}</th>{twoPhases&&<th colSpan={2} scope="colgroup" className="px-0.5 pt-3 text-center rounded-tr-lg">{jumpOff?'Desempate':isDouble?'Recorrido 2':'Fase 2'}</th>}</tr><tr><th scope="col" className="px-0.5 pb-3 text-center">Faltas</th><th scope="col" className={twoPhases?'px-0.5 pb-3 text-center':'px-0.5 pb-3 text-center rounded-br-lg'}>Tiempo</th>{twoPhases&&<><th scope="col" className="px-0.5 pb-3 text-center">Faltas</th><th scope="col" className="px-0.5 pb-3 text-center rounded-br-lg">Tiempo</th></>}</tr></thead><tbody className="divide-y divide-neutral-200">{combinedLiveKeys(rows.map(x=>x.row.position),manual.map(x=>x.id),combined).map(key=>{
    const published=key.startsWith('p:')?rows.find(x=>'p:'+x.row.position===key):undefined;
    const added=key.startsWith('m:')?manual.find(x=>'m:'+x.id===key):undefined;
    const row=published?.row??added, mark=published?.mark??added;
    if(!row || !row.category?.trim())return null;
    const pos=published?.row.position;
    const manualId=added?.id;
    const secondShown=!isDouble || (pos!=null && !!list?.id && roundQualifiers.includes(`p:${list.id}:${pos}`)) || (!!manualId && roundQualifiers.includes(`m:${manualId}`));
    const current=Boolean((manualId && manualTracking?.current_manual_id===manualId) || (pos!=null && tracking?.start_version_id===list?.id && tracking?.current_position===pos));
    return <tr key={key} className={current?'bg-rose-200':''}><td className="px-2 py-5 align-top text-sm sm:text-base leading-snug"><span className="block font-bold text-[#123E59] break-words [overflow-wrap:anywhere]">{row.rider}</span>{current && <span className="sr-only"> · En pista</span>}<span className="block mt-1 text-neutral-700 break-words [overflow-wrap:anywhere]">{row.horse}</span><span className="block mt-1 text-xs sm:text-sm text-neutral-500 break-words [overflow-wrap:anywhere]">{row.category}</span></td><td className="px-0.5 py-5 align-top text-center tabular-nums text-xs sm:text-sm break-all">{totalLiveFaults(mark?.obstacle_faults, mark?.time_seconds, firstAllowed(row.category))}</td><td className="px-0.5 py-5 align-top text-center tabular-nums text-xs sm:text-sm break-all">{mark?.time_seconds!=null?Number(mark.time_seconds).toFixed(2):''}</td>{twoPhases&&<><td className="px-0.5 py-5 align-top text-center tabular-nums text-xs sm:text-sm break-all">{secondShown ? totalLiveFaults(mark?.phase2_faults, mark?.phase2_seconds, secondAllowed(row.category)) : ''}</td><td className="px-0.5 py-5 align-top text-center tabular-nums text-xs sm:text-sm break-all">{secondShown&&mark?.phase2_seconds!=null?Number(mark.phase2_seconds).toFixed(2):''}</td></>}</tr>;
  })}</tbody></table></div>}</div>{!embedded && <SponsorSection slot="listings_footer" eventId={entry?.eventId} hideGlobalSponsors={events.find(e=>e.id===entry?.eventId)?.hideGlobalSponsors} />}</div></section>;
};
