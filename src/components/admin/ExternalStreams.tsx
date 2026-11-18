import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getYouTubeId } from '../../utils/schedule';

type Day = { id: string; event_date: string };
type Arena = { id: string; name: string };
type Stream = { day_id: string; arena_id: string; youtube_url: string };
export const ExternalStreams: React.FC<{ eventId: string; eventName: string; onBack: () => void }> = ({ eventId, eventName, onBack }) => {
  const [days, setDays] = useState<Day[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [dayId, setDayId] = useState('');
  const [arenaId, setArenaId] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    const { data, error } = await supabase.functions.invoke('external-assignments', { body: { action: 'streams_list', eventId } });
    if (error || !Array.isArray(data?.days) || !Array.isArray(data?.arenas) || !Array.isArray(data?.streams)) { setError('No se pudieron cargar las transmisiones. Verificá que tu acceso siga vigente.'); setLoading(false); return; }
    setDays(data.days); setArenas(data.arenas); setStreams(data.streams); setError(''); setLoading(false);
  };
  useEffect(() => { void load(); }, [eventId]);
  useEffect(() => { setUrl(streams.find(s => s.day_id === dayId && s.arena_id === arenaId)?.youtube_url || ''); }, [dayId, arenaId, streams]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (url.trim() && !getYouTubeId(url.trim())) { setError('Ingresá un enlace válido de un video de YouTube.'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('external-assignments', { body: { action: 'streams_save', eventId, dayId, arenaId, url: url.trim() } });
    if (error || !data?.success) setError('No se pudo guardar. Verificá que tu acceso siga habilitado y volvé a intentarlo.');
    else { await load(); setMessage('Transmisión actualizada.'); }
    setBusy(false);
  };
  const field = 'block w-full mt-1 h-11 px-3 border border-neutral-300 rounded-xl font-normal';
  return <section className="max-w-xl mx-auto px-4 py-8 space-y-5"><button onClick={onBack} className="text-sm underline text-[#123E59]">Volver a mis concursos</button><h1 className="text-2xl font-black text-[#123E59]">Transmisiones</h1><p className="font-bold">{eventName}</p>{loading ? <p role="status">Cargando…</p> : <form onSubmit={save} className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
    <label className="block text-sm font-bold">Jornada<select required className={field} value={dayId} onChange={e => setDayId(e.target.value)}><option value="">Elegí una jornada</option>{days.map(day => <option key={day.id} value={day.id}>{day.event_date.split('-').reverse().join('/')}</option>)}</select></label>
    <label className="block text-sm font-bold">Pista<select required className={field} value={arenaId} onChange={e => setArenaId(e.target.value)}><option value="">Elegí una pista</option>{arenas.map(arena => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>
    <label className="block text-sm font-bold">Enlace de YouTube<input className={field} type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label><p className="text-xs text-neutral-500">Para quitar una transmisión, dejá el enlace vacío y guardá.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <button disabled={busy || !dayId || !arenaId} className="px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar transmisión'}</button>
  </form>}</section>;
};
