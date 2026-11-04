import React, { useState, useEffect, useCallback } from 'react';
import { EquestrianEvent } from '../../types/equestrian';
import { useEquestrian } from '../../context/EquestrianContext';
import { formatDateRange } from '../../utils/dateUtils';
import { GeneralInfoSection } from './sections/GeneralInfoSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { DocumentWorkspace } from './DocumentWorkspace';
import { TransmissionSection } from './sections/TransmissionSection';
import { ImportantInfoSection } from './sections/ImportantInfoSection';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

export type AdminTab = 'general' | 'schedule' | 'documents' | 'transmission' | 'info';

interface AdminEventEditorProps {
  eventId: string | 'new';
  onBack: () => void;
  onSelectEvent: (id: string) => void;
}

export const AdminEventEditor: React.FC<AdminEventEditorProps> = ({
  eventId,
  onBack,
  onSelectEvent,
}) => {
  const {
    getEventById,
    toggleEventStatus,
    deleteEvent,
    setSelectedEventId,
    setActiveView,
    isLoading
  } = useEquestrian();

  const isNew = eventId === 'new';
  const event = !isNew ? getEventById(eventId) || null : null;

  // Active Tab: read from URL if available, default to 'general'
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (eventId === 'new') return 'general';
      const legacy = params.get('tab');
      const tabParam = (legacy === 'start-lists' || legacy === 'results' ? 'documents' : legacy) as AdminTab | null;
      if (tabParam && ['general', 'schedule', 'documents', 'transmission', 'info'].includes(tabParam)) {
        return tabParam;
      }
    }
    return 'general';
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [toggleStatusBusy, setToggleStatusBusy] = useState(false);

  // Set active tab with URL sync
  const setActiveTab = useCallback(
    (tab: AdminTab) => {
      const doSwitch = () => {
        setActiveTabState(tab);
        setIsDirty(false);
        if (typeof window !== 'undefined' && eventId !== 'new') {
          const params = new URLSearchParams(window.location.search);
          params.set('tab', tab);
          window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        }
      };

      if (isDirty) {
        setPendingAction(() => doSwitch);
        setShowUnsavedPrompt(true);
      } else {
        doSwitch();
      }
    },
    [isDirty, eventId]
  );

  const handleBack = useCallback(() => {
    if (isDirty) {
      setPendingAction(() => onBack);
      setShowUnsavedPrompt(true);
    } else {
      onBack();
    }
  }, [isDirty, onBack]);

  const handlePreviewPublic = () => {
    if (!event) return;
    setSelectedEventId(event.id);
    setActiveView('public');
  };

  const handleTogglePublish = async () => {
    if (!event) return;
    setToggleStatusBusy(true);
    try {
      await toggleEventStatus(event.id);
    } catch (err) {
      window.alert((err as Error).message || 'No se pudo cambiar el estado.');
    } finally {
      setToggleStatusBusy(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
    onBack();
  };

  const handleSavedEvent = (savedId: string) => {
    setIsDirty(false);
    if (isNew) {
      onSelectEvent(savedId);
    }
  };

  if (!isNew && !event && isLoading) return <p role="status" className="p-6">Cargando concurso…</p>;

  if (!isNew && !event && !isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-neutral-600 font-semibold mb-4">
          Concurso no encontrado o eliminado.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-[#123E59] text-white rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
        >
          ← Volver al listado
        </button>
      </div>
    );
  }

  const isPublished = event?.status === 'published';

  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'general', label: 'Información general' },
    { id: 'info', label: 'Información importante' },
    { id: 'schedule', label: 'Jornadas y pruebas' },
    { id: 'documents', label: 'Documentos' },
    { id: 'transmission', label: 'Transmisión' },
  ];

  return (
    <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-64px)] pb-16">
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* ======================================================== */}
        {/* ENCABEZADO DEDICADO DEL CONCURSO                         */}
        {/* ======================================================== */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={isWorking} onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#123E59] hover:underline cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Volver a concursos</span>
            </button>

            {event && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isWorking || toggleStatusBusy || isDirty} onClick={handlePreviewPublic}
                  className="inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-bold text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                  title="Ver en la vista pública"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver público</span>
                </button>

                <button
                  type="button"
                  disabled={toggleStatusBusy || isDirty || isWorking}
                  onClick={handleTogglePublish}
                  className={`inline-flex items-center gap-1.5 px-3 min-h-11 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    isPublished
                      ? 'text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      : 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                  title={isDirty ? 'Guardá los cambios antes de cambiar la publicación' : isPublished ? 'Pasar a borrador' : 'Publicar concurso'}
                >
                  {isPublished ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Despublicar</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Publicar concurso</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                  isPublished
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {isNew ? 'NUEVO' : isPublished ? 'PUBLICADO' : 'BORRADOR'}
              </span>
            </div>

            <h1 className="font-display text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-tight">
              {event ? event.name : 'Crear Nuevo Concurso'}
            </h1>

            <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-1">
              {event
                ? `${formatDateRange(event.startDate, event.endDate)} · ${event.venue}${
                    event.city ? ` · ${event.city}` : ''
                  }`
                : 'Completá los datos principales para crear el concurso y luego podrás cargar pruebas, documentos y transmisión.'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {!isNew && <>
            <label className="block text-sm font-semibold text-[#123E59]">Sección del concurso
              <select disabled={isWorking} aria-label="Sección del concurso" value={activeTab} onChange={e => setActiveTab(e.target.value as AdminTab)} className="mt-2 w-full min-h-11 p-3 bg-white border border-neutral-300 rounded-xl">
                {tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
              </select>
            </label>

          </>}
          <div className="min-w-0">
          {activeTab === 'general' && (
            <GeneralInfoSection
              event={event}
              onSaved={handleSavedEvent}
              onDeleteEvent={event ? handleDeleteEvent : undefined}
              onDirtyChange={setIsDirty}
            />
          )}

          {activeTab === 'schedule' && event && (
            <ScheduleSection event={event} />
          )}

          {activeTab === 'documents' && event && (
            <DocumentWorkspace key={event.id} event={event} onDirtyChange={setIsDirty} onBusyChange={setIsWorking} />
          )}

          {activeTab === 'transmission' && event && (
            <TransmissionSection event={event} />
          )}

          {activeTab === 'info' && event && (
            <ImportantInfoSection event={event} onDirtyChange={setIsDirty} />
          )}

          </div>
        </div>
      </div>

      {/* Modal para advertir sobre cambios sin guardar */}
      {showUnsavedPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-display font-black text-base text-neutral-900">
                Cambios sin guardar
              </h3>
            </div>
            <p className="text-xs text-neutral-600">
              Tenés modificaciones sin guardar en esta sección. ¿Querés descartar los cambios y continuar?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedPrompt(false);
                  setPendingAction(null);
                }}
                className="px-3 min-h-11 text-xs font-bold text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedPrompt(false);
                  setIsDirty(false);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
