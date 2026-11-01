import React, { useEffect } from 'react';
import { TransmissionPage } from './components/public/Transmission';
import { EquestrianProvider, useEquestrian } from './context/EquestrianContext';
import { Header } from './components/common/Header';
import { CompetitionList } from './components/public/CompetitionList';
import { CompetitionDetail } from './components/public/CompetitionDetail';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { DedicatedDocumentView } from './components/viewer/DedicatedDocumentView';
import { StartListView } from './components/public/StartListView';
import { ResultsView } from './components/public/ResultsView';
import { trackPage } from './lib/analytics';
import { eventPath, resourceHash, resourceSuffix } from './utils/navigation';

const AppContent: React.FC = () => {
  const {
    activeView,
    events,
    documents,
    classes,
    days,
    routeNotFound,
    routeLocation,
    setSelectedEventId,
    selectedEventId,
    viewingDocumentId,
    isAdmin,
    isAuthLoading,
    isLoading,
    dataError,
    refreshData
  } = useEquestrian();

  const hash = resourceHash(routeLocation);
  const transmissionId = hash.startsWith('#transmission/') ? hash.slice(14) : null;
  const startListId = hash.startsWith('#start-list/') ? hash.slice(12) : null;
  const resultsId = hash.startsWith('#results/') ? hash.slice(9) : null;

  useEffect(() => {
    // Wait for the route to resolve; loading/auth refreshes are not pageviews.
    if (isLoading || dataError || isAuthLoading || activeView === 'admin') return;
    const entry = classes.find(entry => entry.id === (startListId || resultsId));
    const doc = documents.find(doc => doc.id === viewingDocumentId);
    const day = days.find(day => day.id === transmissionId?.split('/')[0]);
    const event = events.find(event => event.id === (entry?.eventId || doc?.eventId || day?.eventId || selectedEventId));
    if (event?.slug && (routeLocation.pathname !== eventPath(event) + resourceSuffix(hash) ||
      routeLocation.hash || new URLSearchParams(routeLocation.search).has('event'))) return;
    const screen = viewingDocumentId ? doc?.name || 'Documento no encontrado'
      : resultsId ? 'Resultados' : startListId ? 'Orden de ingreso'
      : transmissionId ? 'Transmisión' : routeNotFound ? 'Concurso no encontrado' : 'Concursos';
    const title = event ? `${screen === 'Concursos' ? '' : screen + ' · '}${event.name} · EquiDate` : `${screen} · EquiDate`;
    document.title = title;
    trackPage(window.location.href);
  }, [routeLocation, isLoading, isAuthLoading, dataError, activeView, events, documents, classes, days, viewingDocumentId, startListId, resultsId, transmissionId, selectedEventId, routeNotFound, hash]);

  // If a document is selected to be viewed, render ONLY the dedicated document view:
  // - No header "SALTO ECUESTRE / Concursos / Administración"
  // - No competition detail card
  // - No accordions
  // - 100% viewport space dedicated to the document
  if (viewingDocumentId && !isLoading && !dataError) {
    return <DedicatedDocumentView documentId={viewingDocumentId} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white pb-12">
      {/* Top Navigation Bar */}
      <Header />

      {/* Main Content Router */}
      <main className="flex-1 w-full">
        {dataError && <div role="alert" className="max-w-4xl mx-auto m-4 p-4 bg-red-50 rounded-xl text-sm text-red-800">{dataError}<button onClick={() => void refreshData()} className="ml-3 underline min-h-11">Reintentar</button></div>}
        {resultsId ? (
          isLoading ? <p role="status" className="p-8 text-center">Cargando resultados…</p>
            : dataError ? null : <ResultsView key={resultsId} classId={resultsId} />
        ) : startListId ? (
          isLoading ? <p role="status" className="p-8 text-center">Cargando listado…</p>
            : dataError ? null : <StartListView key={startListId} classId={startListId} />
        ) : transmissionId ? (
          <TransmissionPage dayId={transmissionId} />
        ) : activeView === 'admin' ? (
          isAuthLoading ? (
            <div className="w-full min-h-[calc(100vh-64px)] flex items-center justify-center p-8 text-neutral-500 font-medium text-sm">
              <div className="w-5 h-5 border-2 border-[#123E59] border-t-transparent rounded-full animate-spin mr-3" />
              <span>Verificando acceso…</span>
            </div>
          ) : isAdmin ? (
            <AdminDashboard />
          ) : (
            <AdminLogin />
          )
        ) : isLoading ? (
          <p role="status" className="p-8 text-center">Cargando concursos…</p>
        ) : dataError ? null : selectedEventId ? (
          <CompetitionDetail key={selectedEventId} />
        ) : routeNotFound ? (
          <section className="max-w-4xl mx-auto px-4 py-12 text-center">
            <h1 className="text-xl font-bold text-[#123E59]">Concurso no encontrado</h1>
            <p className="my-4 text-neutral-600">Este enlace no corresponde a un concurso disponible.</p>
            <button onClick={() => setSelectedEventId(null)} className="min-h-11 px-4 bg-[#123E59] text-white rounded-lg">Volver a Concursos</button>
          </section>
        ) : (
          <CompetitionList />
        )}
      </main>

      {/* Discreet Minimal Footer */}
      <footer className="mt-auto py-6 border-t border-neutral-200/80 text-center text-xs text-neutral-400">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-center">
          <p className="font-semibold text-neutral-600">
            EquiDate · Calendario de eventos hípicos
          </p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <EquestrianProvider>
      <AppContent />
    </EquestrianProvider>
  );
}
