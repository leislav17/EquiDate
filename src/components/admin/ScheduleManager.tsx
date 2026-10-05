import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
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
  const { classes, arenas, documents, scheduleError, arenaError, saveClass, deleteClass } = useEquestrian();
  const [date, setDate] = useState('');
  const [entry, setEntry] = useState<CompetitionClass | null>(null);
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
        <button className={button} disabled={busy || !eventArenas.length} onClick={() => { setEntry(null); setAdding(true); }}><Plus className="inline w-4 h-4 mr-1" />Agregar prueba</button>
      </div>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {adding && <ClassForm key={entry?.id || 'new'} event={event} initialDate={date || event.startDate} entry={entry} busy={busy}
        onCancel={() => setAdding(false)} onSave={value => run(async () => { await saveClass(value); setAdding(false); })} />}
      {!entries.length && <p className="text-sm text-neutral-500">Todavía no hay pruebas cargadas para esta selección.</p>}
      {dates.filter(value => entries.some(item => item.date === value)).map(value => <section key={value} className="space-y-2">
        <h3 className="text-xs font-bold text-[#123E59]">{formatDayHeader(value).fullFormatted}</h3>
        {sortClasses(entries.filter(item => item.date === value)).map(item => <div key={item.id} className="border rounded-xl p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{item.time || 'Horario a confirmar'} · Prueba {item.number}{eventArenas.length > 1 && ' · ' + (eventArenas.find(arena => arena.id === item.arenaId)?.name || 'Sin pista')}</p>
            <p className="font-bold text-sm break-words">{item.name}</p>
          </div>
          <div className="flex shrink-0">
            <button aria-label={'Editar prueba ' + item.number} disabled={busy} className="p-3" onClick={() => { setEntry(item); setAdding(true); }}><Pencil className="w-4 h-4" /></button>
            <button aria-label={'Eliminar prueba ' + item.number} disabled={busy || documents.some(doc => doc.classId === item.id)} title="Las pruebas con documentos asociados no se pueden eliminar" className="p-3 text-red-700 disabled:opacity-40" onClick={() => {
              if (window.confirm('¿Eliminar esta prueba?')) void run(() => deleteClass(item.id));
            }}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>)}
      </section>)}
    </>}
  </ManagerDialog>;
}

function ClassForm({ event, initialDate, entry, busy, onSave, onCancel }: {
  event: EquestrianEvent; initialDate: string; entry: CompetitionClass | null; busy: boolean;
  onSave: (entry: Omit<CompetitionClass, 'id'> & { id?: string }) => Promise<void>; onCancel: () => void;
}) {
  const { arenas, documents } = useEquestrian();
  const eventArenas = arenas.filter(arena => arena.eventId === event.id);
  const [date, setDate] = useState(entry?.date || initialDate);
  const [arenaId, setArenaId] = useState(entry?.arenaId || eventArenas.find(arena => arena.isPrimary)?.id || '');
  const [number, setNumber] = useState(entry?.number || '');
  const [name, setName] = useState(entry?.name || '');
  const [time, setTime] = useState(entry?.time || '');
  const [description, setDescription] = useState(entry?.description || '');
  const [order, setOrder] = useState(entry?.order ?? 1);
  const hasDocuments = !!entry && documents.some(doc => doc.classId === entry.id);
  return <form className="p-4 border rounded-xl space-y-3" onSubmit={form => {
    form.preventDefault();
    void onSave({ id: entry?.id, dayId: entry?.dayId || '', eventId: event.id, date, arenaId, number, name, time, description, order });
  }}>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">Jornada de la prueba<select className={field} value={date} disabled={hasDocuments} onChange={form => setDate(form.target.value)}>
        {getDaysBetween(event.startDate, event.endDate).map(value => <option key={value} value={value}>{formatDayHeader(value).fullFormatted}</option>)}
      </select></label>
      {hasDocuments && <p className="text-xs text-neutral-500">La jornada se conserva porque esta prueba tiene documentos asociados.</p>}
      {eventArenas.length > 1 && <label className="block text-sm">Pista de la prueba<select required className={field} value={arenaId} onChange={form => setArenaId(form.target.value)}>
        <option value="" disabled>Elegí una pista</option>{eventArenas.map(arena => <option key={arena.id} value={arena.id}>{arena.name}</option>)}
      </select></label>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Número<input required className={field} value={number} onChange={form => setNumber(form.target.value)} /></label>
        <label className="text-sm">Horario<input type="time" className={field} value={time} onChange={form => setTime(form.target.value)} /></label>
      </div>
      <label className="block text-sm">Nombre de la prueba<input required className={field} value={name} onChange={form => setName(form.target.value)} placeholder="CSN Libre 1.30" /></label>
      <label className="block text-sm">Descripción<input className={field} value={description} onChange={form => setDescription(form.target.value)} placeholder="Dos fases especial" /></label>
      <label className="block text-sm">Orden para horarios iguales<input type="number" min="0" required className={field} value={order} onChange={form => setOrder(Number(form.target.value))} /></label>
      <div className="flex gap-2"><button className={button}>Guardar prueba</button><button type="button" onClick={onCancel} className="px-3 min-h-11 text-sm">Cancelar</button></div>
    </fieldset>
  </form>;
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
