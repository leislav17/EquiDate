import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ManualEntry } from '../../utils/liveMatches';

export function ManualLiveRow({ row, eventId, classId, twoPhases, onSaved, dragHandle, dragging }: {
  row: ManualEntry; eventId: string; classId: string; twoPhases: boolean; onSaved: () => void; dragHandle: React.ReactNode; dragging:boolean;
}) {
  const [faults, setFaults] = useState(row.obstacle_faults?.toString() ?? '0');
  const [seconds, setSeconds] = useState(row.time_seconds?.toString() ?? '');
  const [secondFaults, setSecondFaults] = useState(row.phase2_faults?.toString() ?? '');
  const [secondSeconds, setSecondSeconds] = useState(row.phase2_seconds?.toString() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = 'w-full h-10 px-2 border border-neutral-300 rounded-lg text-sm';
  const save = async () => {
    const time = seconds.trim().replace(',', '.');
    const secondTime = secondSeconds.trim().replace(',', '.');
    const validFaults = (v: string) => /^\d+$/.test(v) && Number(v) <= 999;
    const validTime = (v: string) => /^\d+(?:\.\d{1,2})?$/.test(v) && Number(v) <= 9999999;
    const hasSecond = twoPhases && (secondFaults.trim() !== '' || secondTime !== '');
    if (!validFaults(faults) || !validTime(time) ||
        (hasSecond && (!validFaults(secondFaults) || !validTime(secondTime)))) {
      setError('Complet� faltas enteras y tiempos v�lidos con hasta dos decimales.');
      return;
    }
    setBusy(true); setError('');
    const { data, error: saveError } = await supabase.functions.invoke('external-assignments', {
      body: { action: 'manual_save', eventId, classId, edit: true, row: {
        ...row, obstacle_faults: Number(faults), time_seconds: Number(time),
        phase2_faults: hasSecond ? Number(secondFaults) : null,
        phase2_seconds: hasSecond ? Number(secondTime) : null,
      } },
    });
    setBusy(false);
    if (saveError || !data?.success) setError('No se pudo guardar la marca. Revis� tu acceso e intent� nuevamente.');
    else onSaved();
  };
  return <tr data-live-key={`m:${row.id}`} className={'bg-white '+(dragging?'opacity-60 outline-2 outline-[#A61E4D]':'')}>
    <td className="p-2 border-t border-neutral-200 min-w-72">
      {dragHandle}<span className="font-bold text-[#123E59]">{row.rider}</span>
      
      <span className="block text-neutral-600">{row.horse} � {row.category || 'Sin categor�a'}</span>
      <span className="block text-xs font-bold text-[#A61E4D]">{row.time_seconds == null ? 'Pendiente' : 'Resultado cargado'}</span>
    </td>
    <td className="p-2 border-t"><input aria-label={`Faltas de ${row.rider}`} className={input} inputMode="numeric" value={faults} onChange={e=>setFaults(e.target.value)} /></td>
    <td className="p-2 border-t"><input aria-label={`Tiempo de ${row.rider}`} className={input} inputMode="decimal" value={seconds} onChange={e=>setSeconds(e.target.value)} /></td>
    {twoPhases && <><td className="p-2 border-t"><input aria-label={`Faltas fase 2 de ${row.rider}`} className={input} inputMode="numeric" value={secondFaults} onChange={e=>setSecondFaults(e.target.value)} /></td><td className="p-2 border-t"><input aria-label={`Tiempo fase 2 de ${row.rider}`} className={input} inputMode="decimal" value={secondSeconds} onChange={e=>setSecondSeconds(e.target.value)} /></td></>}
    <td className="p-2 border-t"><button disabled={busy} onClick={()=>void save()} className="bg-[#123E59] text-white px-4 h-10 rounded-lg font-bold disabled:opacity-50">{busy ? 'Guardando.' : row.time_seconds == null ? 'Guardar' : 'Corregir'}</button>{error && <p role="alert" className="text-red-700 text-xs mt-1">{error}</p>}</td>
  </tr>;
}

