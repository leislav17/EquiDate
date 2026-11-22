import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ManualEntry } from '../../utils/liveMatches';

export function ManualLiveRow({ row, eventId, classId, versionId, twoPhases, doubleRound, jumpOff, secondEnabled, qualifierControl, onSaved, onEdit, removeControl, dragHandle, dragging, current, absent, disabled, onTracking }: {
  row: ManualEntry; eventId: string; classId: string; versionId:string; twoPhases: boolean; doubleRound:boolean; jumpOff:boolean; secondEnabled:boolean; qualifierControl:React.ReactNode; onSaved: () => void; onEdit: () => void; removeControl: React.ReactNode; dragHandle: React.ReactNode; dragging:boolean; current:boolean; absent:boolean; disabled:boolean; onTracking:(action:'current'|'absent'|'restore')=>void;
}) {
  const [faults, setFaults] = useState(row.obstacle_faults?.toString() ?? '0');
  const [seconds, setSeconds] = useState(row.time_seconds?.toString() ?? '');
  const [secondFaults, setSecondFaults] = useState(row.phase2_faults?.toString() ?? '');
  const [secondSeconds, setSecondSeconds] = useState(row.phase2_seconds?.toString() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = 'w-full h-10 px-2 border border-neutral-300 rounded-lg text-sm bg-white';
  const save = async () => {
    const time = seconds.trim().replace(',', '.');
    const secondTime = secondSeconds.trim().replace(',', '.');
    const validFaults = (v: string) => /^\d+$/.test(v) && Number(v) <= 999;
    const validTime = (v: string) => /^\d+(?:\.\d{1,2})?$/.test(v) && Number(v) <= 9999999;
    const hasSecond = twoPhases && secondEnabled && (secondFaults.trim() !== '' || secondTime !== '');
    if (!validFaults(faults) || !validTime(time) ||
        (hasSecond && (!validFaults(secondFaults) || !validTime(secondTime)))) {
      setError('Completá faltas enteras y tiempos válidos con hasta dos decimales.');
      return;
    }
    setBusy(true); setError('');
    const { data, error: saveError } = await supabase.functions.invoke('external-assignments', {
      body: { action:'manual_result_save', eventId, classId, startVersionId:versionId, manualId:row.id, faults:Number(faults), seconds:Number(time), secondFaults:hasSecond?Number(secondFaults):doubleRound&&!secondEnabled?row.phase2_faults??null:null, secondSeconds:hasSecond?Number(secondTime):doubleRound&&!secondEnabled?row.phase2_seconds??null:null },
    });
    setBusy(false);
    if (saveError || !data?.success) setError('No se pudo guardar la marca. Revisá tu acceso e intentá nuevamente.');
    else onSaved();
  };
  return <tr data-live-key={`m:${row.id}`} className={'grid grid-cols-2 gap-x-2.5 gap-y-2.5 p-3 md:table-row md:p-0 transition-colors '+(current?'bg-rose-50 ':'bg-white ')+(dragging?'opacity-60 outline-2 outline-[#A61E4D]':'')}>
    <td className="col-span-2 block p-0 md:table-cell md:p-2 md:border-t md:border-neutral-200 md:min-w-72 min-w-0">
      <div className="flex items-start gap-1">{dragHandle}{removeControl}<div className="min-w-0 flex-1"><span className="font-bold text-[#123E59] break-words">{row.rider}</span><button type="button" disabled={disabled} onClick={onEdit} aria-label={`Editar binomio de ${row.rider}`} title="Editar binomio" className="ml-2 p-2 text-[#123E59] disabled:opacity-50"><Pencil size={17}/></button>
      <span className="block text-neutral-600 break-words">{row.horse} · {row.category || 'Sin categoría'}</span>
      <span className="block mt-1 text-xs font-bold text-[#A61E4D]">{current?'En pista':absent?'No se presentó':row.time_seconds == null ? 'Pendiente' : 'Resultado cargado'}</span>
      <div className="flex flex-wrap gap-3 mt-1"><button type="button" disabled={disabled||current||absent} onClick={()=>onTracking('current')} className="text-xs font-bold text-[#123E59] underline disabled:opacity-50 min-h-9">Marcar en pista</button>{row.time_seconds==null&&<button type="button" disabled={disabled} onClick={()=>onTracking(absent?'restore':'absent')} className="text-xs font-bold text-[#123E59] underline disabled:opacity-50 min-h-9">{absent?'Volver a pendiente':'No se presentó'}</button>}</div>{qualifierControl}</div></div>
    </td>
    <td className="block p-0 md:table-cell md:p-2 md:border-t md:border-neutral-200 md:min-w-24 min-w-0"><span aria-hidden="true" className="block text-xs font-bold text-neutral-700 mb-1 md:hidden">{jumpOff ? 'Recorrido · Faltas' : doubleRound ? 'Recorrido 1 · Faltas' : twoPhases ? 'Fase 1 · Faltas' : 'Faltas'}</span><input aria-label={`Faltas de ${row.rider}`} className={input} inputMode="numeric" value={faults} onChange={e=>setFaults(e.target.value)} /></td>
    <td className="block p-0 md:table-cell md:p-2 md:border-t md:border-neutral-200 md:min-w-28 min-w-0"><span aria-hidden="true" className="block text-xs font-bold text-neutral-700 mb-1 md:hidden">{jumpOff ? 'Recorrido · Tiempo (seg.)' : doubleRound ? 'Recorrido 1 · Tiempo (seg.)' : twoPhases ? 'Fase 1 · Tiempo (seg.)' : 'Tiempo (seg.)'}</span><input aria-label={`Tiempo de ${row.rider}`} className={input} inputMode="decimal" value={seconds} onChange={e=>setSeconds(e.target.value)} /></td>
    {twoPhases && (secondEnabled ? <><td className="block p-0 md:table-cell md:p-2 md:border-t md:border-neutral-200 md:min-w-24 min-w-0"><span aria-hidden="true" className="block text-xs font-bold text-neutral-700 mb-1 md:hidden">{jumpOff?'Desempate · Faltas':doubleRound?'Recorrido 2 · Faltas':'Fase 2 · Faltas'}</span><input aria-label={`Faltas fase 2 de ${row.rider}`} className={input} inputMode="numeric" value={secondFaults} onChange={e=>setSecondFaults(e.target.value)} /></td><td className="block p-0 md:table-cell md:p-2 md:border-t md:border-neutral-200 md:min-w-28 min-w-0"><span aria-hidden="true" className="block text-xs font-bold text-neutral-700 mb-1 md:hidden">{jumpOff?'Desempate · Tiempo (seg.)':doubleRound?'Recorrido 2 · Tiempo (seg.)':'Fase 2 · Tiempo (seg.)'}</span><input aria-label={`Tiempo fase 2 de ${row.rider}`} className={input} inputMode="decimal" value={secondSeconds} onChange={e=>setSecondSeconds(e.target.value)} /></td></> : <><td className="hidden md:table-cell md:border-t md:border-neutral-200"/><td className="hidden md:table-cell md:border-t md:border-neutral-200"/></>)}
    <td className="col-span-2 block p-0 md:table-cell md:p-2 md:border-t md:border-neutral-200"><button disabled={busy||disabled||absent} onClick={()=>void save()} className="w-full md:w-auto bg-[#123E59] text-white px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50">{busy ? 'Guardando…' : row.time_seconds == null ? 'Guardar' : 'Corregir'}</button>{error && <p role="alert" className="text-red-700 text-xs mt-1">{error}</p>}</td>
  </tr>;
}
