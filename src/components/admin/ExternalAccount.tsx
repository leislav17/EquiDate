import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';
import { ExternalStreams } from './ExternalStreams';
import { ExternalLiveResults } from './ExternalLiveResults';
import { ArrowLeft, ArrowRight, Clock, Radio, ClipboardList } from 'lucide-react';
import { formatCardDate } from '../../utils/dateUtils';
import { navigate } from '../../utils/navigation';

type AssignedEvent = { id: string; name: string; start_date: string; end_date: string; discipline?: string | null };
export const ExternalAccount: React.FC = () => {
  const { session, logoutAdmin, routeLocation } = useEquestrian();
  const [events, setEvents] = useState<AssignedEvent[] | null>(null);
  const [error, setError] = useState('');
  const params = new URLSearchParams(routeLocation.search);
  const selectedId = params.get('externalEvent');
  const section = params.get('section');
  const selected = events?.find(event => event.id === selectedId);
  useEffect(() => {
    let active = true;
    const refresh = () => void supabase.functions.invoke('external-assignments', { body: { action: 'mine' } }).then(({ data, error }) => {
      if (!active) return;
      if (error || !Array.isArray(data?.events)) setError('No se pudieron cargar tus concursos.');
      else { setError(''); setEvents(data.events); }
    });
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [session?.user?.id]);
  if (selected && section === 'resultados' && (!selected.discipline || selected.discipline === 'jumping')) return <ExternalLiveResults eventId={selected.id} eventName={selected.name} onBack={() => navigate('/admin/mis-concursos?externalEvent=' + encodeURIComponent(selected.id))} />;
  if (selected && section === 'transmisiones') return <ExternalStreams eventId={selected.id} eventName={selected.name} onBack={() => navigate('/admin/mis-concursos?externalEvent=' + encodeURIComponent(selected.id))} />;
  if (selected) return <section className="equidate-container py-6 sm:py-8 space-y-5">
    <button onClick={() => navigate('/admin/mis-concursos')} className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold text-[#123E59]"><ArrowLeft size={18} />Volver a mis concursos</button>
    <h1 className="font-display text-2xl sm:text-3xl font-black text-[#123E59] break-words">{selected.name}</h1>
    <p className="text-xs font-semibold text-neutral-500 font-mono">{formatCardDate(selected.start_date, selected.end_date)}</p>
    <button onClick={() => navigate('/admin/mis-concursos?externalEvent=' + encodeURIComponent(selected.id) + '&section=transmisiones')} className="w-full bg-white border border-neutral-200/80 hover:border-[#123E59] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all text-left flex items-center gap-4 text-[#123E59]"><Radio size={22} className="shrink-0" /><span className="font-display font-bold flex-1 min-w-0 break-words">Gestionar transmisiones</span><ArrowRight size={20} className="shrink-0" /></button>
    {(!selected.discipline || selected.discipline === 'jumping') && <button onClick={() => navigate('/admin/mis-concursos?externalEvent=' + encodeURIComponent(selected.id) + '&section=resultados')} className="w-full bg-white border border-neutral-200/80 hover:border-[#123E59] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all text-left flex items-center gap-4 text-[#123E59]"><ClipboardList size={22} className="shrink-0" /><span className="font-display font-bold flex-1 min-w-0 break-words">Cargar resultados en vivo</span><ArrowRight size={20} className="shrink-0" /></button>}
  </section>;
  return <section className="equidate-container py-6 sm:py-8">
    <h1 className="font-display text-2xl font-black text-[#123E59]">Mis concursos asignados</h1>
    {error ? <p role="alert" className="text-red-700 mt-5">{error}</p> : events === null ? <p className="mt-5 text-neutral-500">Cargando…</p> : events.length === 0 ? <p className="mt-5 text-sm text-neutral-600">Todavía no tenés concursos asignados.</p> : <ul className="mt-5 space-y-3">{events.map(event => <li key={event.id}><button onClick={() => navigate('/admin/mis-concursos?externalEvent=' + encodeURIComponent(event.id))} className="w-full bg-white border border-neutral-200/80 hover:border-[#123E59] rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all text-left flex items-center gap-4 group"><span className="flex-1 min-w-0"><span className="block font-display text-base sm:text-lg font-bold text-neutral-900 leading-snug group-hover:text-[#123E59] break-words">{event.name}</span><span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 font-mono mt-1.5"><Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />{formatCardDate(event.start_date, event.end_date)}</span></span><ArrowRight className="w-4 h-4 text-neutral-500 shrink-0" /></button></li>)}</ul>}
    <button onClick={() => void logoutAdmin()} className="mt-6 px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold">Cerrar sesión</button>
  </section>;
};
