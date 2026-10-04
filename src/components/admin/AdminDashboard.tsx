import React, { useState } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { formatDateRange } from '../../utils/dateUtils';
import { EquestrianEvent } from '../../types/equestrian';
import { CompetitionFormModal } from './CompetitionFormModal';
import { DocumentManagerModal } from './DocumentManagerModal';
import {
  Plus,
  Edit,
  Files,
  Trash2,
  Eye,
  CheckCircle,
  EyeOff,
  ExternalLink,
  MapPin,
  Calendar
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    toggleEventStatus,
    getDocumentsForEvent,
    setSelectedEventId,
    setActiveView,
    session,
    logoutAdmin,
    isBackendConnected,
    isLoading,
    refreshData,
    seedDemoDataToSupabase
  } = useEquestrian();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EquestrianEvent | null>(null);
  const [docManagerEvent, setDocManagerEvent] = useState<EquestrianEvent | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (evt: EquestrianEvent) => {
    setEditingEvent(evt);
    setIsFormOpen(true);
  };

  const handleSaveEvent = (data: {
    name: string;
    venue: string;
    startDate: string;
    endDate: string;
    status: 'published' | 'draft';
  }) => {
    if (editingEvent) {
      updateEvent(editingEvent.id, data);
    } else {
      addEvent(data);
    }
  };

  const handlePreviewInPublic = (evtId: string) => {
    setSelectedEventId(evtId);
    setActiveView('public');
  };

  const handleSeedSupabase = async () => {
    if (!window.confirm('¿Deseás subir y sincronizar todos los concursos y documentos iniciales a tu base de datos y Storage de Supabase?')) {
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    const res = await seedDemoDataToSupabase();
    setIsSyncing(false);
    setSyncStatus(res.message);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Top Header & Connection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              Gestión de Concursos
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                isBackendConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isBackendConnected ? 'Supabase Conectado' : 'Modo Demo / Local'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Crear concursos, actualizar estados y administrar anteprogramas, listados y resultados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isBackendConnected && (
            <button
              type="button"
              onClick={handleSeedSupabase}
              disabled={isSyncing || isLoading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-[#123E59] border border-blue-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              title="Subir concursos y documentos iniciales a Supabase"
            >
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar a Supabase'}</span>
            </button>
          )}

          {session && (
            <button
              type="button"
              onClick={logoutAdmin}
              className="px-3 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ NUEVO CONCURSO</span>
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900 flex items-center justify-between">
          <span>{syncStatus}</span>
          <button
            type="button"
            onClick={() => setSyncStatus(null)}
            className="text-blue-700 hover:text-blue-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* List of competitions */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-16 bg-white border border-neutral-200 rounded-xl p-6">
            <p className="text-sm font-medium text-neutral-600 mb-2">
              No hay concursos registrados.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="text-xs font-bold text-neutral-900 underline cursor-pointer"
            >
              Creá tu primer concurso
            </button>
          </div>
        ) : (
          events.map((evt) => {
            const dateRangeText = formatDateRange(evt.startDate, evt.endDate);
            const docs = getDocumentsForEvent(evt.id);
            const isPublished = evt.status === 'published';

            return (
              <div
                key={evt.id}
                className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                {/* Left: Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-900 tracking-wide">
                      {dateRangeText}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isPublished
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {isPublished ? 'PUBLICADO' : 'BORRADOR'}
                    </span>
                  </div>

                  <h3 className="font-display text-base sm:text-lg font-bold text-neutral-900 truncate">
                    {evt.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-neutral-500 font-medium">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{evt.venue}</span>
                    </div>
                    <span aria-hidden="true" className="text-neutral-300">·</span>
                    <div className="flex items-center gap-1">
                      <Files className="w-3.5 h-3.5 text-neutral-400" />
                      <span>
                        {docs.length}{' '}
                        {docs.length === 1 ? 'documento' : 'documentos'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-neutral-100">
                  {/* Public Preview */}
                  <button
                    type="button"
                    onClick={() => handlePreviewInPublic(evt.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                    title="Ver página pública del concurso"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver público</span>
                  </button>

                  {/* Manage Documents */}
                  <button
                    type="button"
                    onClick={() => setDocManagerEvent(evt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-xs"
                    title="Administrar anteprogramas, listados y resultados"
                  >
                    <Files className="w-3.5 h-3.5" />
                    <span>Documentos ({docs.length})</span>
                  </button>

                  {/* Publish/Unpublish toggle */}
                  <button
                    type="button"
                    onClick={() => toggleEventStatus(evt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      isPublished
                        ? 'text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        : 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                    title={isPublished ? 'Pasar a borrador' : 'Publicar concurso'}
                  >
                    {isPublished ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Despublicar</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Publicar</span>
                      </>
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(evt)}
                    className="p-2 text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                    title="Editar concurso"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar el concurso "${evt.name}" y todos sus documentos?`
                        )
                      ) {
                        deleteEvent(evt.id);
                      }
                    }}
                    className="p-2 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    title="Eliminar concurso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Competition Form Modal (Create / Edit) */}
      <CompetitionFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEvent}
        initialData={editingEvent}
      />

      {/* Document Manager Modal */}
      {docManagerEvent && (
        <DocumentManagerModal
          isOpen={!!docManagerEvent}
          onClose={() => setDocManagerEvent(null)}
          event={docManagerEvent}
        />
      )}
    </div>
  );
};
