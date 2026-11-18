import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEquestrian } from '../../context/EquestrianContext';

type AssignedEvent = { id: string; name: string; start_date: string; end_date: string };
export const ExternalAccount: React.FC = () => {
  const { session, logoutAdmin } = useEquestrian();
  const [events, setEvents] = useState<AssignedEvent[] | null>(null);
  const [error, setError] = useState('');
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
  return <section className="max-w-xl mx-auto px-4 py-10">
    <h1 className="text-2xl font-black text-[#123E59]">Mi cuenta</h1>
    <p className="mt-4 text-sm text-neutral-600">Sesión iniciada como {session?.user?.email}.</p>
    <h2 className="mt-6 font-bold">Mis concursos asignados</h2>
    {error ? <p role="alert" className="text-red-700 mt-2">{error}</p> : events === null ? <p className="mt-2">Cargando…</p> : events.length === 0 ? <p className="mt-2 text-sm text-neutral-600">Todavía no tenés concursos asignados.</p> : <ul className="mt-2 space-y-2">{events.map(event => <li key={event.id} className="border rounded-xl p-4"><strong>{event.name}</strong><p className="text-sm text-neutral-600">{event.start_date} — {event.end_date}</p></li>)}</ul>}
    <p className="mt-4 text-sm text-neutral-600">Las funciones para gestionar transmisiones y resultados estarán disponibles en una próxima etapa.</p>
    <button onClick={() => void logoutAdmin()} className="mt-6 px-5 py-3 bg-[#123E59] text-white rounded-xl font-bold">Cerrar sesión</button>
  </section>;
};
