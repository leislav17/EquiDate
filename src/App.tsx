import React from 'react';
import { EquestrianProvider, useEquestrian } from './context/EquestrianContext';
import { Header } from './components/common/Header';
import { CompetitionList } from './components/public/CompetitionList';
import { CompetitionDetail } from './components/public/CompetitionDetail';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { DedicatedDocumentView } from './components/viewer/DedicatedDocumentView';

const AppContent: React.FC = () => {
  const {
    activeView,
    selectedEventId,
    viewingDocumentId,
    isAdmin
  } = useEquestrian();

  // If a document is selected to be viewed, render ONLY the dedicated document view:
  // - No header "SALTO ECUESTRE / Concursos / Administración"
  // - No competition detail card
  // - No accordions
  // - 100% viewport space dedicated to the document
  if (viewingDocumentId) {
    return <DedicatedDocumentView documentId={viewingDocumentId} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white pb-12">
      {/* Top Navigation Bar */}
      <Header />

      {/* Main Content Router */}
      <main className="flex-1 w-full">
        {activeView === 'admin' ? (
          isAdmin ? <AdminDashboard /> : <AdminLogin />
        ) : selectedEventId ? (
          <CompetitionDetail />
        ) : (
          <CompetitionList />
        )}
      </main>

      {/* Discreet Minimal Footer */}
      <footer className="mt-auto py-6 border-t border-neutral-200/80 text-center text-xs text-neutral-400">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-semibold text-neutral-600">
            Salto Ecuestre · Plataforma de Concursos de Salto
          </p>
          <p className="text-[11px] text-neutral-400">
            Temporada 2026 · Información oficial integrada
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
