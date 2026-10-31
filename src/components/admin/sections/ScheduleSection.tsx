import React, { useState } from 'react';
import { Plus, ArrowUp, ArrowDown, GripVertical, Copy, Pencil, Trash2, Calendar, MapPin } from 'lucide-react';
import { EquestrianEvent, CompetitionClass } from '../../../types/equestrian';
import { useEquestrian } from '../../../context/EquestrianContext';
import { getDaysBetween, formatDayHeader } from '../../../utils/dateUtils';
import { sortClasses, sortArenas, formatClassSchedule } from '../../../utils/schedule';
import { ArenaSettings, ClassForm } from '../ScheduleManager';

interface ScheduleSectionProps {
  event: EquestrianEvent;
}

export const ScheduleSection: React.FC<ScheduleSectionProps> = ({ event }) => {
  const {
    classes,
    arenas,
    documents,
    scheduleError,
    arenaError,
    saveClass,
    saveClasses,
    deleteClass,
    reorderClasses,
    reorderArenas,
  } = useEquestrian();

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingEntry, setEditingEntry] = useState<CompetitionClass | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draggedClassId, setDraggedClassId] = useState<string | null>(null);
  const [dragOverClassId, setDragOverClassId] = useState<string | null>(null);
  const [classToDelete, setClassToDelete] = useState<CompetitionClass | null>(null);

  const dates = getDaysBetween(event.startDate, event.endDate);
  const eventArenas = arenas.filter((arena) => arena.eventId === event.id);
  const sortedEventArenas = sortArenas(eventArenas);

  const entries = classes.filter(
    (item) => item.eventId === event.id && (!selectedDate || item.date === selectedDate)
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage((error as Error).message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  const handleMoveClass = async (
    dayDate: string,
    arenaId: string,
    sourceIndex: number,
    destinationIndex: number
  ) => {
    const arenaClasses = sortClasses(
      classes.filter(
        (item) =>
          item.eventId === event.id && item.date === dayDate && item.arenaId === arenaId
      )
    );
    if (
      destinationIndex < 0 ||
      destinationIndex >= arenaClasses.length ||
      sourceIndex === destinationIndex
    ) {
      return;
    }
    const reordered = [...arenaClasses];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, moved);

    const payload = reordered.map((item, idx) => ({
      id: item.id,
      order: idx + 1,
    }));

    await run(() => reorderClasses(payload));
  };

  const handleMoveArenaOrder = async (arenaIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? arenaIndex - 1 : arenaIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedEventArenas.length) return;
    const reordered = [...sortedEventArenas];
    const [removed] = reordered.splice(arenaIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    const payload = reordered.map((a, idx) => ({ id: a.id, order: idx + 1 }));
    await run(() => reorderArenas(payload));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Gestión de pistas */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <ArenaSettings eventId={event.id} />
      </div>

      {/* 2. Barra de acciones y filtro por jornada */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 sm:max-w-xs">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Ver Jornada
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs sm:text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#123E59] bg-white"
            >
              <option value="">Todas las jornadas ({dates.length} días)</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatDayHeader(d).fullFormatted}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-4">
            <button
              type="button"
              disabled={busy || !eventArenas.length}
              onClick={() => {
                setEditingEntry(null);
                setFormMode('create');
                setIsAdding(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#123E59] hover:bg-[#0e3247] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar prueba</span>
            </button>
          </div>
        </div>

        {message && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
            {message}
          </div>
        )}
        {(scheduleError || arenaError) && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl">
            {scheduleError || arenaError}
          </div>
        )}

        {/* Formulario desplegable para agregar o editar prueba */}
        {isAdding && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <div className="bg-neutral-50 border border-neutral-300 rounded-2xl p-4 sm:p-5">
              <h3 className="font-display text-sm font-black text-[#123E59] uppercase tracking-wider mb-3">
                {formMode === 'create'
                  ? 'Nueva Prueba'
                  : formMode === 'duplicate'
                  ? `Duplicar Prueba ${editingEntry?.number || ''}`
                  : `Editar Prueba ${editingEntry?.number || ''}`}
              </h3>

              <ClassForm
                key={formMode === 'create' ? 'new' : `${formMode}-${editingEntry?.id || 'entry'}`}
                event={event}
                initialDate={selectedDate || event.startDate}
                entry={editingEntry}
                mode={formMode}
                busy={busy}
                onCancel={() => setIsAdding(false)}
                onSaveSingle={(value) =>
                  run(async () => {
                    await saveClass(value);
                    setIsAdding(false);
                  })
                }
                onSaveBatch={(values) =>
                  run(async () => {
                    await saveClasses(values);
                    setIsAdding(false);
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Listado de pruebas por día y pista */}
      <div className="space-y-4">
        {entries.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white border border-neutral-200/90 rounded-2xl p-6 shadow-xs">
            <p className="text-sm font-semibold text-neutral-600 mb-1">
              Todavía no hay pruebas cargadas para esta selección.
            </p>
            <p className="text-xs text-neutral-400 mb-4">
              Podés agregar una prueba individual o configurar varias en lote para distintos días.
            </p>
            <button
              type="button"
              disabled={busy || !eventArenas.length}
              onClick={() => {
                setEditingEntry(null);
                setFormMode('create');
                setIsAdding(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#123E59] text-white text-xs font-bold rounded-xl hover:bg-[#0e3247] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar primera prueba</span>
            </button>
          </div>
        ) : (
          dates
            .filter((d) => entries.some((item) => item.date === d))
            .map((dayDate) => {
              const dayClasses = entries.filter((item) => item.date === dayDate);
              const dayArenas = sortedEventArenas.filter((arena) =>
                dayClasses.some((c) => c.arenaId === arena.id)
              );
              const unmappedClasses = dayClasses.filter(
                (c) => !sortedEventArenas.some((a) => a.id === c.arenaId)
              );

              return (
                <div
                  key={dayDate}
                  className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                    <h3 className="font-display text-sm sm:text-base font-black text-[#123E59] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#123E59]" />
                      <span>{formatDayHeader(dayDate).fullFormatted}</span>
                      <span className="text-xs font-semibold text-neutral-500">
                        · {dayClasses.length} {dayClasses.length === 1 ? 'prueba' : 'pruebas'}
                      </span>
                    </h3>
                  </div>

                  {/* Arenas del día */}
                  {dayArenas.map((arena) => {
                    const arenaIdx = sortedEventArenas.findIndex((item) => item.id === arena.id);
                    const arenaClasses = sortClasses(
                      dayClasses.filter((item) => item.arenaId === arena.id)
                    );
                    if (arenaClasses.length === 0) return null;

                    return (
                      <div
                        key={arena.id}
                        className="space-y-2.5 bg-neutral-50/80 p-3 sm:p-4 rounded-xl border border-neutral-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#123E59]" />
                            <span className="font-display font-black text-xs uppercase text-[#123E59] tracking-wider">
                              {arena.name}
                            </span>
                            <span className="text-xs text-neutral-500 font-medium">
                              · {arenaClasses.length}{' '}
                              {arenaClasses.length === 1 ? 'prueba' : 'pruebas'}
                            </span>
                          </div>

                          {sortedEventArenas.length > 1 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-neutral-400 mr-1">
                                Pista #{arenaIdx + 1}
                              </span>
                              <button
                                type="button"
                                disabled={busy || arenaIdx === 0}
                                onClick={() => handleMoveArenaOrder(arenaIdx, 'up')}
                                title="Mover pista arriba"
                                className="p-1 text-neutral-500 hover:text-[#123E59] disabled:opacity-25 rounded hover:bg-white cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy || arenaIdx === sortedEventArenas.length - 1}
                                onClick={() => handleMoveArenaOrder(arenaIdx, 'down')}
                                title="Mover pista abajo"
                                className="p-1 text-neutral-500 hover:text-[#123E59] disabled:opacity-25 rounded hover:bg-white cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Lista de pruebas de esta pista */}
                        <div className="space-y-2">
                          {arenaClasses.map((item, classIdx) => {
                            const scheduleLabel = formatClassSchedule(item);
                            const isDragging = draggedClassId === item.id;
                            const isDragOver = dragOverClassId === item.id;

                            return (
                              <div
                                key={item.id}
                                draggable={!busy}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', item.id);
                                  setDraggedClassId(item.id);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggedClassId && draggedClassId !== item.id) {
                                    setDragOverClassId(item.id);
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dragOverClassId === item.id) {
                                    setDragOverClassId(null);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const sourceId = e.dataTransfer.getData('text/plain');
                                  const sourceIdx = arenaClasses.findIndex((c) => c.id === sourceId);
                                  if (sourceIdx >= 0 && sourceIdx !== classIdx) {
                                    void handleMoveClass(dayDate, arena.id, sourceIdx, classIdx);
                                  }
                                  setDraggedClassId(null);
                                  setDragOverClassId(null);
                                }}
                                onDragEnd={() => {
                                  setDraggedClassId(null);
                                  setDragOverClassId(null);
                                }}
                                className={`border rounded-xl p-3 flex items-start justify-between gap-3 bg-white transition-all ${
                                  isDragging
                                    ? 'opacity-40 border-dashed border-[#123E59]'
                                    : isDragOver
                                    ? 'border-[#123E59] ring-2 ring-[#123E59]/20'
                                    : 'border-neutral-200 hover:border-neutral-300'
                                }`}
                              >
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                    <span
                                      className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-700 p-0.5"
                                      title="Arrastrar para reordenar"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                    <span
                                      className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-neutral-100 text-[10px] font-bold text-neutral-600"
                                      title={`Orden #${classIdx + 1}`}
                                    >
                                      #{classIdx + 1}
                                    </span>
                                    <div className="flex flex-col">
                                      <button
                                        type="button"
                                        disabled={busy || classIdx === 0}
                                        onClick={() =>
                                          handleMoveClass(dayDate, arena.id, classIdx, classIdx - 1)
                                        }
                                        title="Subir en el orden"
                                        className="text-neutral-400 hover:text-[#123E59] disabled:opacity-20 cursor-pointer p-0.5"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy || classIdx === arenaClasses.length - 1}
                                        onClick={() =>
                                          handleMoveClass(dayDate, arena.id, classIdx, classIdx + 1)
                                        }
                                        title="Bajar en el orden"
                                        className="text-neutral-400 hover:text-[#123E59] disabled:opacity-20 cursor-pointer p-0.5"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {scheduleLabel && (
                                        <span className="text-xs font-bold text-[#123E59]">
                                          {scheduleLabel} ·
                                        </span>
                                      )}
                                      <span className="text-xs font-bold text-[#A61E4D]">
                                        Prueba {item.number}
                                      </span>
                                      {typeof item.participantCount === 'number' &&
                                        item.participantCount !== null && (
                                          <span className="text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                                            Cantidad de participantes: {item.participantCount}
                                          </span>
                                        )}
                                    </div>

                                    <p className="font-bold text-sm sm:text-base text-neutral-900 break-words leading-tight">
                                      {item.name}
                                    </p>
                                    {item.description && (
                                      <p className="text-xs text-neutral-500">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    title="Duplicar prueba"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditingEntry(item);
                                      setFormMode('duplicate');
                                      setIsAdding(true);
                                    }}
                                    className="p-1.5 text-neutral-600 hover:text-[#123E59] hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                  >
                                    <Copy className="w-4 h-4" />
                                    <span className="hidden sm:inline">Duplicar</span>
                                  </button>

                                  <button
                                    type="button"
                                    title="Editar prueba"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditingEntry(item);
                                      setFormMode('edit');
                                      setIsAdding(true);
                                    }}
                                    className="p-1.5 text-[#123E59] hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    <span className="hidden sm:inline">Editar</span>
                                  </button>

                                  <button
                                    type="button"
                                    title="Eliminar prueba"
                                    disabled={busy}
                                    onClick={() => setClassToDelete(item)}
                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Pruebas sin pista asignada */}
                  {unmappedClasses.length > 0 && (
                    <div className="space-y-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                      <p className="text-xs font-bold text-amber-800">
                        Otras pruebas (sin pista válida asignada):
                      </p>
                      {unmappedClasses.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-neutral-200 text-xs"
                        >
                          <div>
                            <span className="font-bold">Prueba {item.number}</span> · {item.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEntry(item);
                              setFormMode('edit');
                              setIsAdding(true);
                            }}
                            className="text-[#123E59] font-bold underline"
                          >
                            Asignar pista
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Modal de confirmación para eliminar prueba */}
      {classToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 space-y-4">
            <h3 className="font-display font-black text-base text-neutral-900">
              ¿Eliminar Prueba {classToDelete.number}?
            </h3>
            <p className="text-xs text-neutral-600">
              Se eliminará <span className="font-bold">{classToDelete.name}</span>. Si tiene documentos asociados, quedarán desvinculados de esta prueba.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = classToDelete.id;
                  setClassToDelete(null);
                  await run(() => deleteClass(id));
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
