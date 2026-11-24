import React from 'react';
import { Award, CalendarDays, Users, Link } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { AdminCompetitionList } from './AdminCompetitionList';
import { AdminEventEditor } from './AdminEventEditor';
import { navigate } from '../../utils/navigation';
import { AdminCompetitionCard } from './AdminCompetitionCard';
import { AdminUsers } from './AdminUsers';
import { CompetitionCatalogManager } from './CompetitionCatalogManager';
import { SponsorManager } from './SponsorManager';

export const AdminDashboard: React.FC = () => {
  const { events, routeLocation } = useEquestrian();
  const queryEvent = new URLSearchParams(routeLocation.search).get('event');
  const legacyQuery = routeLocation.hash.split('?')[1] || routeLocation.hash.replace(/^#/, '');
  const currentEventId = queryEvent || new URLSearchParams(legacyQuery).get('event');
  const selectEvent = (id: string, replace = false) => navigate(`/admin/concursos?event=${encodeURIComponent(id)}`, replace);
  const currentPath = routeLocation.pathname.replace(/\/+$/, '');
  if (currentPath === '/admin/usuarios') return <AdminUsers />;
  if (currentPath === '/admin/catalogos') return <CompetitionCatalogManager onBack={() => navigate('/admin')} />;
  if (currentPath === '/admin/sponsors') return <SponsorManager scope="global" onBack={() => navigate('/admin')} />;
  if (currentEventId) return <AdminEventEditor key={currentEventId} eventId={currentEventId}
    onBack={() => navigate('/admin/concursos')} onSelectEvent={id => selectEvent(id, true)} />;
  if (currentPath === '/admin/concursos') return <AdminCompetitionList
    onSelectEvent={selectEvent} onNewEvent={() => selectEvent('new')} />;
  const recent = [...events].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const links = [
    { title: 'Usuarios externos', url: '/admin/usuarios', icon: Users },
    { title: 'Gestionar concursos', url: '/admin/concursos', icon: CalendarDays },
    { title: 'Asociaciones de jinetes', url: '/admin/jinetes', icon: Users },
    { title: 'Gestionar información útil', url: '/admin/informacion-util', icon: Link },
    { title: 'Catálogos de pruebas', url: '/admin/catalogos', icon: Award },
    { title: 'Gestionar sponsors', url: '/admin/sponsors', icon: Award },
  ];
  return <div className="equidate-container py-5 sm:py-6 space-y-6">
    <h1 className="font-display text-2xl font-black text-[#123E59]">Panel de administración</h1>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{links.map(({ title, url, icon: Icon }) =>
      <button key={url} onClick={() => navigate(url)} className="bg-white border border-neutral-200 rounded-xl p-5 text-left flex items-center gap-3 hover:border-[#123E59] min-h-24 text-[#123E59] font-bold">
        <Icon className="w-6 h-6 shrink-0" /><span className="min-w-0 break-words">{title}</span>
      </button>)}</div>
    {!!recent.length && <section aria-labelledby="recent-contests-title">
      <h2 id="recent-contests-title" className="font-bold text-[#123E59] mb-3">Concursos recientes</h2>
      <div className="space-y-3">{recent.map(event =>
        <AdminCompetitionCard key={event.id} event={event} onSelect={selectEvent} />
      )}</div>
    </section>}
  </div>;
};
