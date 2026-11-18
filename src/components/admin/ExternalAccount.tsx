import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';
import { ExternalStreams } from './ExternalStreams';
import { Clock } from 'lucide-react';
import { formatCardDate } from '../../utils/dateUtils';
import { navigate } from '../../utils/navigation';

type AssignedEvent = { id: string; name: string; start_date: string; end_date: string };
export const ExternalAccount: React.FC = () => {
  const { session, logoutAdmin, routeLocation } = useEquestrian();
  const [events, setEvents] = useState<AssignedEvent[] | null>(null);
  const [error, setError] = useState('');
  const selectedId = new URLSearchParams(routeLocation.search).get('externalEvent');
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
  if (selected) return <ExternalStreams eventId={selected.id} eventName={selected.name} onBack={() => navigate('/admin/mis-concursos')} />;
  return <section className="max-w-5xl mx-auto px-4 py-8">
    <h1 className="font-display text-2xl font-black text-[#123E59]">Mis concursos asignados</h1>
    {error ? <p role="alert" className="text-red-700 mt-5">{error}</p> : events === null ? <p className="mt-5 text-neutral-500">Cargando…</p> : events.length === 0 ? <p className="mt-5 text-sm text-neutral-600">Todavía no tenés concursos asignados.</p> : <ul className="mt-5 space-y-3">{events.map(event => <li key={event.id} className="bg-white border border-neutral-200/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all"><h2 className="font-display text-base sm:text-lg font-bold text-neutral-900 leading-snug">{event.name}</h2><p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 font-mono mt-1.5"><Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" /><span>{formatCardDate(event.start_date, event.end_date)}</span></p><button onClick={() => navigate('/admin/mis-concursos?externalEvent=' + encodeURIComponent(event.id))} className="mt-4 text-sm font-bold text-[#123E59] underline">Gestionar transmisiones</button></li>)}</ul>}
    <p className="mt-4 text-sm text-neutral-600">La carga de resultados en vivo estará disponible en una próxima etapa.</p>
    <button onClick={() => void logoutAdmin()} className="mt-6 px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold">Cerrar sesión</button>
  </section>;
};
