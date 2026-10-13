import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Copy } from 'lucide-react';
import { EquestrianEvent, CompetitionClass } from '../../types/equestrian';
import { useEquestrian } from '../../context/EquestrianContext';
import { getDaysBetween, formatDayHeader } from '../../utils/dateUtils';
import { DEFAULT_TIME_ZONE, sortClasses } from '../../utils/schedule';
import { DayProgram } from '../public/DayProgram';

const field = 'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mt-1 bg-white min-h-11';
const button = 'min-h-11 px-4 py-2 rounded-lg bg-[#123E59] text-white text-sm font-bold disabled:opacity-50';

function ManagerDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 bg-black/60 p-3 sm:p-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6">
      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 className="font-display text-lg font-bold text-[#123E59]">{title}</h2>
        <button onClick={onClose} aria-label="Cerrar" className="p-3"><X className="w-5 h-5" /></button>
      </div>
      <div className="overflow-y-auto space-y-4">{children}</div>
    </div>
  </div>;
}

function ArenaSettings({ eventId }: { eventId: string }) {
  const { arenas, classes, streams, saveArena, deleteArena } = useEquestrian();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const eventArenas = arenas.filter(arena => arena.eventId === eventId);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  return <details className="border rounded-xl p-3">
    <summary className="font-bold text-sm text-[#123E59] cursor-pointer min-h-8">Pistas del concurso · {eventArenas.length === 1 ? 'Una pista' : eventArenas.length + ' pistas'}</summary>
    <div className="space-y-3 mt-3">
      <p className="text-xs text-neutral-500">Si el concurso usa más de una pista, agregalas aquí y asigná cada prueba a la que corresponde.</p>
      {eventArenas.map(arena => {
        const used = classes.some(entry => entry.arenaId === arena.id) || streams.some(stream => stream.arenaId === arena.id);
        return <form key={arena.id} className="flex flex-wrap gap-2 items-end" onSubmit={event => {
          event.preventDefault();
          const input = new FormData(event.currentTarget).get('arenaName') as string;
          void run(() => saveArena(eventId, input, arena.id));
        }}>
          <label className="text-xs flex-1 min-w-32">Nombre de pista<input aria-label={'Nombre de ' + arena.name} name="arenaName" required defaultValue={arena.name} className={field} /></label>
          <button disabled={busy} className={button}>Guardar</button>
          {!arena.isPrimary && <button type="button" disabled={busy || used} title={used ? 'Tiene pruebas o transmisiones asignadas' : 'Eliminar pista'} aria-label={'Eliminar ' + arena.name} className="p-3 text-red-700 disabled:opacity-40"
            onClick={() => { if (window.confirm('¿Eliminar esta pista sin asignaciones?')) void run(() => deleteArena(arena.id)); }}><Trash2 className="w-4 h-4" /></button>}
        </form>;
      })}
      <form className="flex flex-wrap gap-2 items-end" onSubmit={event => {
        event.preventDefault();
        void run(async () => { await saveArena(eventId, name); setName(''); });
      }}>
        <label className="text-xs flex-1 min-w-32">Nueva pista<input required className={field} value={name} onChange={event => setName(event.target.value)} placeholder="Pista de arena" /></label>
        <button disabled={busy} className={button}>Agregar otra pista</button>
      </form>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </div>
  </details>;
}

export function TestsManager({ event, onClose }: { event: EquestrianEvent; onClose: () => void }) {
  const { classes, arenas, documents, scheduleError, arenaError, saveClass, saveClasses, deleteClass } = useEquestrian();
  const [date, setDate] = useState('');
  const [entry, setEntry] = useState<CompetitionClass | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const entries = classes.filter(item => item.eventId === event.id && (!date || item.date === date));
  const dates = getDaysBetween(event.startDate, event.endDate);
  const eventArenas = arenas.filter(arena => arena.eventId === event.id);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage((error as Error).message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  return <ManagerDialog title={'Pruebas · ' + event.name} onClose={onClose}>
    {scheduleError || arenaError ? <p role="alert">{scheduleError || arenaError}</p> : <>
      <ArenaSettings eventId={event.id} />
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <label className="text-sm flex-1">Ver jornada<select className={field} value={date} onChange={event => setDate(event.target.value)}>
          <option value="">Todas las jornadas</option>
          {dates.map(value => <option key={value} value={value}>{formatDayHeader(value).fullFormatted}</option>)}
        </select></label>
        <button
          className={button}
          disabled={busy || !eventArenas.length}
          onClick={() => {
            setEntry(null);
            setFormMode('create');
            setAdding(true);
          }}
        >
          <Plus className="inline w-4 h-4 mr-1" />Agregar prueba
        </button>
      </div>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {adding && (
        <ClassForm
          key={formMode === 'create' ? 'new' : `${formMode}-${entry?.id || 'entry'}`}
          event={event}
          initialDate={date || event.startDate}
          entry={entry}
          mode={formMode}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSaveSingle={value => run(async () => { await saveClass(value); setAdding(false); })}
          onSaveBatch={values => run(async () => { await saveClasses(values); setAdding(false); })}
        />
      )}
      {!entries.length && <p className="text-sm text-neutral-500">Todavía no hay pruebas cargadas para esta selección.</p>}
      {dates.filter(value => entries.some(item => item.date === value)).map(value => <section key={value} className="space-y-2">
        <h3 className="text-xs font-bold text-[#123E59]">{formatDayHeader(value).fullFormatted}</h3>
        {sortClasses(entries.filter(item => item.date === value)).map(item => <div key={item.id} className="border rounded-xl p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{item.time || 'Horario a confirmar'} · Prueba {item.number}{eventArenas.length > 1 && ' · ' + (eventArenas.find(arena => arena.id === item.arenaId)?.name || 'Sin pista')}</p>
            <p className="font-bold text-sm break-words">{item.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label={'Duplicar prueba ' + item.number}
              title="Duplicar prueba"
              disabled={busy}
              className="p-2 sm:p-2.5 text-neutral-600 hover:text-[#123E59] hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
              onClick={() => {
                setEntry(item);
                setFormMode('duplicate');
                setAdding(true);
              }}
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Duplicar</span>
            </button>
            <button
              aria-label={'Editar prueba ' + item.number}
              title="Editar prueba"
              disabled={busy}
              className="p-2 sm:p-2.5 text-neutral-600 hover:text-[#123E59] hover:bg-neutral-100 rounded-lg transition-colors"
              onClick={() => {
                setEntry(item);
                setFormMode('edit');
                setAdding(true);
              }}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              aria-label={'Eliminar prueba ' + item.number}
              disabled={busy || documents.some(doc => doc.classId === item.id)}
              title={documents.some(doc => doc.classId === item.id) ? 'Las pruebas con documentos asociados no se pueden eliminar' : 'Eliminar prueba'}
              className="p-2 sm:p-2.5 text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
              onClick={() => {
                if (window.confirm('¿Eliminar esta prueba?')) void run(() => deleteClass(item.id));
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>)}
      </section>)}
    </>}
  </ManagerDialog>;
}

interface DayOverride {
  date: string;
  number: string;
  time: string;
  arenaId: string;
}

function ClassForm({
  event,
  initialDate,
  entry,
  mode,
  busy,
  onSaveSingle,
  onSaveBatch,
  onCancel,
}: {
  event: EquestrianEvent;
  initialDate: string;
  entry: CompetitionClass | null;
  mode: 'create' | 'edit' | 'duplicate';
  busy: boolean;
  onSaveSingle: (entry: Omit<CompetitionClass, 'id'> & { id?: string }) => Promise<void>;
  onSaveBatch: (entries: Array<Omit<CompetitionClass, 'id'>>) => Promise<void>;
  onCancel: () => void;
}) {
  const { arenas, documents } = useEquestrian();
  const eventArenas = arenas.filter(arena => arena.eventId === event.id);
  const primaryArenaId = eventArenas.find(arena => arena.isPrimary)?.id || (eventArenas[0]?.id ?? '');
  const allContestDates = getDaysBetween(event.startDate, event.endDate);

  // Common data
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    if (mode === 'edit') return [entry?.date || initialDate];
    if (mode === 'duplicate') return [entry?.date || initialDate];
    return [initialDate];
  });
  const [commonArenaId, setCommonArenaId] = useState(entry?.arenaId || primaryArenaId);
  const [commonNumber, setCommonNumber] = useState(entry?.number || '');
  const [commonTime, setCommonTime] = useState(entry?.time || '');
  const [name, setName] = useState(entry?.name || '');
  const [description, setDescription] = useState(entry?.description || '');
  const [order, setOrder] = useState(entry?.order ?? 1);

  // Overrides per day when creating across multiple days
  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});

  const hasDocuments = mode === 'edit' && !!entry && documents.some(doc => doc.classId === entry.id);
  const isEditingExisting = mode === 'edit';

  const toggleDate = (day: string) => {
    setSelectedDates(prev => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        const next = prev.filter(d => d !== day);
        return next;
      } else {
        return [...prev, day].sort();
      }
    });
  };

  const updateOverride = (day: string, fieldName: keyof DayOverride, val: string) => {
    setOverrides(prev => {
      const current = prev[day] || {
        date: day,
        number: commonNumber,
        time: commonTime,
        arenaId: commonArenaId,
      };
      return {
        ...prev,
        [day]: {
          ...current,
          [fieldName]: val,
        },
      };
    });
  };

  const getEffectiveField = (day: string, fieldName: 'number' | 'time' | 'arenaId'): string => {
    const o = overrides[day];
    if (o && o[fieldName] !== undefined) return o[fieldName];
    if (fieldName === 'number') return commonNumber;
    if (fieldName === 'time') return commonTime;
    return commonArenaId;
  };

  const handleSubmit = (form: React.FormEvent) => {
    form.preventDefault();
    if (isEditingExisting) {
      // Editing existing single class
      const singleDate = selectedDates[0] || entry?.date || initialDate;
      const targetArena = eventArenas.length === 1 ? primaryArenaId : commonArenaId;
      void onSaveSingle({
        id: entry?.id,
        dayId: entry?.dayId || '',
        eventId: event.id,
        date: singleDate,
        arenaId: targetArena,
        number: commonNumber,
        name,
        time: commonTime,
        description,
        order,
      });
      return;
    }

    // Creating new class(es): either from duplicate (1 date) or create (1 or more dates)
    const itemsToCreate = selectedDates.map(day => {
      const effNumber = getEffectiveField(day, 'number');
      const effTime = getEffectiveField(day, 'time');
      const effArena = eventArenas.length === 1 ? primaryArenaId : getEffectiveField(day, 'arenaId');
      return {
        dayId: '',
        eventId: event.id,
        date: day,
        arenaId: effArena,
        number: effNumber,
        name,
        time: effTime,
        description,
        order,
      };
    });

    if (itemsToCreate.length === 1) {
      void onSaveSingle(itemsToCreate[0]);
    } else {
      void onSaveBatch(itemsToCreate);
    }
  };

  const submitButtonText = () => {
    if (isEditingExisting) return 'Guardar cambios';
    if (mode === 'duplicate') return 'Crear prueba duplicada';
    if (selectedDates.length > 1) return `Crear ${selectedDates.length} pruebas`;
    return 'Crear prueba';
  };

  return (
    <form className="p-4 border rounded-xl space-y-4 bg-neutral-50/70" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <div>
          <h3 className="font-bold text-sm text-[#123E59]">
            {mode === 'edit'
              ? `Editar prueba ${entry?.number || ''}`
              : mode === 'duplicate'
              ? `Duplicar prueba ${entry?.number || ''}`
              : 'Nueva prueba'}
          </h3>
          <p className="text-xs text-neutral-500">
            {mode === 'duplicate'
              ? 'Se creará una prueba nueva e independiente con los datos precargados. No se duplicarán documentos ni transmisiones.'
              : mode === 'create'
              ? 'Podés seleccionar una o varias jornadas para crear pruebas independientes con los mismos datos.'
              : 'Modificar los datos de esta prueba.'}
          </p>
        </div>
      </div>

      <fieldset disabled={busy} className="space-y-3">
        {/* Date selection */}
        {isEditingExisting ? (
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Jornada de la prueba</label>
            <select
              className={field}
              value={selectedDates[0] || initialDate}
              disabled={hasDocuments}
              onChange={form => setSelectedDates([form.target.value])}
            >
              {allContestDates.map(value => (
                <option key={value} value={value}>
                  {formatDayHeader(value).fullFormatted}
                </option>
              ))}
            </select>
            {hasDocuments && (
              <p className="text-xs text-amber-700 mt-1">
                La jornada se conserva porque esta prueba tiene documentos asociados.
              </p>
            )}
          </div>
        ) : mode === 'duplicate' ? (
          <div>
            <label className="block text-xs font-semibold text-neutral-700">Jornada para la nueva prueba</label>
            <select
              className={field}
              value={selectedDates[0] || initialDate}
              onChange={form => setSelectedDates([form.target.value])}
            >
              {allContestDates.map(value => (
                <option key={value} value={value}>
                  {formatDayHeader(value).fullFormatted}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Podés conservar el mismo día o elegir cualquier otra jornada del concurso.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-neutral-700">
                Jornadas del concurso ({selectedDates.length} seleccionada{selectedDates.length > 1 ? 's' : ''})
              </label>
              {allContestDates.length > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDates([...allContestDates])}
                    className="text-[11px] font-bold text-[#123E59] hover:underline"
                  >
                    Todas
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDates([allContestDates[0]])}
                    className="text-[11px] font-bold text-neutral-500 hover:underline"
                  >
                    Solo una
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {allContestDates.map(value => {
                const checked = selectedDates.includes(value);
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'border-[#123E59] bg-[#123E59]/5 text-[#123E59] font-bold'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDate(value)}
                      className="rounded text-[#123E59] focus:ring-[#123E59] w-4 h-4"
                    />
                    <span>{formatDayHeader(value).fullFormatted}</span>
                  </label>
                );
              })}
            </div>
            {selectedDates.length > 1 && (
              <p className="text-xs text-emerald-700 mt-1.5 font-medium">
                Se creará una prueba independiente en cada jornada seleccionada.
              </p>
            )}
          </div>
        )}

        {/* Arenas (only if more than 1 arena) */}
        {eventArenas.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-neutral-700">
              {selectedDates.length > 1 ? 'Pista general' : 'Pista de la prueba'}
            </label>
            <select
              required
              className={field}
              value={commonArenaId}
              onChange={form => setCommonArenaId(form.target.value)}
            >
              <option value="" disabled>Elegí una pista</option>
              {eventArenas.map(arena => (
                <option key={arena.id} value={arena.id}>
                  {arena.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Number & Time */}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-neutral-700">
            {selectedDates.length > 1 ? 'Número general' : 'Número'}
            <input
              required
              className={field}
              value={commonNumber}
              onChange={form => setCommonNumber(form.target.value)}
              placeholder="Ej. 1"
            />
          </label>
          <label className="text-xs font-semibold text-neutral-700">
            {selectedDates.length > 1 ? 'Horario general' : 'Horario'}
            <input
              type="time"
              className={field}
              value={commonTime}
              onChange={form => setCommonTime(form.target.value)}
            />
          </label>
        </div>

        {/* Name */}
        <label className="block text-xs font-semibold text-neutral-700">
          Nombre de la prueba
          <input
            required
            className={field}
            value={name}
            onChange={form => setName(form.target.value)}
            placeholder="CSN Libre 1.30 / 1 m"
          />
        </label>

        {/* Description */}
        <label className="block text-xs font-semibold text-neutral-700">
          Descripción (opcional)
          <input
            className={field}
            value={description}
            onChange={form => setDescription(form.target.value)}
            placeholder="Dos fases especial / Tabla A sin cronómetro"
          />
        </label>

        {/* Sort order */}
        <label className="block text-xs font-semibold text-neutral-700">
          Orden para horarios iguales
          <input
            type="number"
            min="0"
            required
            className={field}
            value={order}
            onChange={form => setOrder(Number(form.target.value))}
          />
        </label>

        {/* Editable summary table per day if multiple days selected */}
        {!isEditingExisting && selectedDates.length > 1 && (
          <div className="pt-2 border-t border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#123E59]">
                Resumen por jornada ({selectedDates.length} pruebas a crear)
              </h4>
              <span className="text-[11px] text-neutral-500">Podés ajustar número, horario o pista por día</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedDates.map(day => (
                <div key={day} className="p-2.5 rounded-lg border border-neutral-200 bg-white space-y-2 text-xs">
                  <div className="font-bold text-neutral-800 flex items-center justify-between">
                    <span>{formatDayHeader(day).fullFormatted}</span>
                    <span className="text-[11px] font-normal text-neutral-500">Prueba independiente</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className="text-[11px] text-neutral-600">
                      Número
                      <input
                        required
                        className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-xs mt-0.5 bg-white"
                        value={getEffectiveField(day, 'number')}
                        onChange={e => updateOverride(day, 'number', e.target.value)}
                      />
                    </label>
                    <label className="text-[11px] text-neutral-600">
                      Horario
                      <input
                        type="time"
                        className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-xs mt-0.5 bg-white"
                        value={getEffectiveField(day, 'time')}
                        onChange={e => updateOverride(day, 'time', e.target.value)}
                      />
                    </label>
                    {eventArenas.length > 1 && (
                      <label className="text-[11px] text-neutral-600 col-span-2 sm:col-span-1">
                        Pista
                        <select
                          className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-xs mt-0.5 bg-white"
                          value={getEffectiveField(day, 'arenaId')}
                          onChange={e => updateOverride(day, 'arenaId', e.target.value)}
                        >
                          {eventArenas.map(arena => (
                            <option key={arena.id} value={arena.id}>{arena.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" className={button} disabled={busy || (mode === 'create' && !selectedDates.length)}>
            {submitButtonText()}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 min-h-11 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function StreamEditor({ eventId, date, arenaId }: { eventId: string; date: string; arenaId: string }) {
  const { days, streams, saveStream } = useEquestrian();
  const day = days.find(item => item.eventId === eventId && item.date === date);
  const stream = streams.find(item => item.dayId === day?.id && item.arenaId === arenaId);
  const [youtubeUrl, setYoutubeUrl] = useState(stream?.youtubeUrl || '');
  const [timeZone, setTimeZone] = useState(day?.timeZone || DEFAULT_TIME_ZONE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="space-y-4">
    <form className="bg-neutral-50 rounded-xl p-4 space-y-3" onSubmit={async form => {
      form.preventDefault(); setBusy(true); setMessage('');
      try { await saveStream(eventId, date, arenaId, youtubeUrl, timeZone); setMessage('Transmisión guardada.'); }
      catch (error) { setMessage((error as Error).message); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm">Enlace de YouTube<input className={field} type="url" value={youtubeUrl} onChange={form => setYoutubeUrl(form.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label>
      <p className="text-xs text-neutral-500">Podés reutilizar el mismo enlace en otros días o pistas. Dejalo vacío para quitar la transmisión de esta selección.</p>
      <label className="block text-sm">Zona horaria de la jornada<select className={field} value={timeZone} onChange={form => setTimeZone(form.target.value)}>
        {[...new Set([DEFAULT_TIME_ZONE, 'America/Montevideo', 'America/Santiago', 'America/Sao_Paulo', 'Europe/Madrid', timeZone])].map(zone => <option key={zone}>{zone}</option>)}
      </select></label>
      <button disabled={busy} className={button}>Guardar transmisión</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
    <h3 className="font-bold text-[#123E59]">Pruebas de esta transmisión</h3>
    <p className="text-xs text-neutral-500">Se incluyen automáticamente las pruebas de la jornada y pista seleccionadas.</p>
    <DayProgram eventId={eventId} date={date} arenaId={arenaId} />
  </div>;
}

export function TransmissionManager({ event, onClose }: { event: EquestrianEvent; onClose: () => void }) {
  const { arenas, arenaError, scheduleError } = useEquestrian();
  const eventArenas = arenas.filter(arena => arena.eventId === event.id);
  const [date, setDate] = useState(event.startDate);
  const [selectedArena, setSelectedArena] = useState('');
  const arenaId = selectedArena || eventArenas.find(arena => arena.isPrimary)?.id || '';
  return <ManagerDialog title={'Transmisión · ' + event.name} onClose={onClose}>
    {arenaError || scheduleError ? <p role="alert">{arenaError || scheduleError}</p> : <>
      <label className="block text-sm">Jornada<select aria-label="Jornada" className={field} value={date} onChange={form => setDate(form.target.value)}>
        {getDaysBetween(event.startDate, event.endDate).map(value => <option key={value} value={value}>{formatDayHeader(value).fullFormatted}</option>)}
      </select></label>
      {eventArenas.length > 1 && <label className="block text-sm">Pista de la transmisión<select className={field} value={arenaId} onChange={form => setSelectedArena(form.target.value)}>
        {eventArenas.map(arena => <option key={arena.id} value={arena.id}>{arena.name}</option>)}
      </select></label>}
      {arenaId && <StreamEditor key={date + arenaId} eventId={event.id} date={date} arenaId={arenaId} />}
    </>}
  </ManagerDialog>;
}
