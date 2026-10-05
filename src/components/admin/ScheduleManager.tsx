import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { EquestrianEvent, CompetitionClass, CompetitionDay } from '../../types/equestrian';
import { useEquestrian } from '../../context/EquestrianContext';
import { getDaysBetween, formatDayHeader } from '../../utils/dateUtils';
import { DEFAULT_TIME_ZONE, getYouTubeId, sortClasses } from '../../utils/schedule';

const field = 'block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mt-1 bg-white min-h-11';
const button = 'min-h-11 px-4 py-2 rounded-lg bg-[#123E59] text-white text-sm font-bold disabled:opacity-50';

function DayEditor({ event, date, day }: { event: EquestrianEvent; date: string; day?: CompetitionDay }) {
  const { classes, documents, saveDay, saveClass, deleteClass, updateDocument } = useEquestrian();
  const [youtubeUrl, setYoutubeUrl] = useState(day?.youtubeUrl || '');
  const [timeZone, setTimeZone] = useState(day?.timeZone || DEFAULT_TIME_ZONE);
  const [entry, setEntry] = useState<CompetitionClass | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const entries = sortClasses(classes.filter(item => item.eventId === event.id && item.date === date));
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); setMessage('Cambios guardados.'); }
    catch (error) { setMessage((error as Error).message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <form onSubmit={eventForm => {
      eventForm.preventDefault();
      void run(async () => {
        if (youtubeUrl && !getYouTubeId(youtubeUrl)) throw new Error('Usá una URL de YouTube de tipo watch, youtu.be, live o embed.');
        await saveDay({ eventId: event.id, date, youtubeUrl: youtubeUrl.trim(), timeZone });
      });
    }} className="bg-neutral-50 rounded-xl p-4 space-y-3">
      <h3 className="font-bold text-[#123E59]">Transmisión de la jornada</h3>
      <label className="block text-sm">Enlace de YouTube
        <input className={field} type="url" value={youtubeUrl} onChange={eventForm => setYoutubeUrl(eventForm.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
      </label>
      <p className="text-xs text-neutral-500">Podés repetir el mismo enlace en varios días. Dejalo vacío si no hay transmisión.</p>
      <label className="block text-sm">Zona horaria
        <select className={field} value={timeZone} onChange={eventForm => setTimeZone(eventForm.target.value)}>
          {[...new Set([DEFAULT_TIME_ZONE, 'America/Montevideo', 'America/Santiago', 'America/Sao_Paulo', 'Europe/Madrid', timeZone])].map(zone => <option key={zone}>{zone}</option>)}
        </select>
      </label>
      <button className={button} disabled={busy}>Guardar jornada</button>
    </form>
    {message && <p role="status" className="text-sm p-3 bg-blue-50 rounded-lg">{message}</p>}
    <div className="flex justify-between items-center gap-3">
      <h3 className="font-bold text-[#123E59]">Pruebas</h3>
      <button className={button} disabled={!day || busy} onClick={() => { setEntry(null); setAdding(true); }}><Plus className="inline w-4 h-4 mr-1" />Agregar prueba</button>
    </div>
    {!day && <p className="text-sm text-neutral-500">Guardá la jornada para comenzar a cargar sus pruebas.</p>}
    {adding && day && <ClassForm key={entry?.id || 'new'} day={day} entry={entry} busy={busy} onCancel={() => setAdding(false)}
      onSave={value => run(async () => { await saveClass(value); setAdding(false); })} />}
    {entries.map(item => <div key={item.id} className="border rounded-xl p-3 flex items-start justify-between gap-2">
      <div className="min-w-0"><p className="text-xs text-neutral-500">{item.time || 'Horario a confirmar'} · Prueba {item.number}</p><p className="font-bold text-sm break-words">{item.name}</p></div>
      <div className="flex shrink-0">
        <button aria-label={'Editar prueba ' + item.number} disabled={busy} className="p-3" onClick={() => { setEntry(item); setAdding(true); }}><Pencil className="w-4 h-4" /></button>
        <button aria-label={'Eliminar prueba ' + item.number} disabled={busy} className="p-3 text-red-700" onClick={() => {
          if (window.confirm('¿Eliminar esta prueba? Si tiene documentos vinculados, primero desvinculalos.')) void run(() => deleteClass(item.id));
        }}><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>)}
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-bold text-[#123E59]">Asignar listados y resultados</h3>
      <p className="text-xs text-neutral-500">Elegí la prueba correspondiente. Los documentos sin asignar siguen visibles en la jornada.</p>
      {documents.filter(doc => doc.eventId === event.id && doc.type !== 'PROGRAM').map(doc => <label key={doc.id} className="block text-sm">
        {doc.name} <span className="text-xs text-neutral-500">· {doc.eventDate || 'General'}</span>
        <select aria-label={'Prueba para ' + doc.name} className={field} disabled={busy}
          value={entries.some(item => item.id === doc.classId) ? doc.classId || '' : ''}
          onChange={eventForm => {
            const classId = eventForm.target.value;
            void run(() => updateDocument(doc.id, { classId: classId || null, eventDate: classId ? date : doc.eventDate }));
          }}>
          <option value="">{doc.classId && !entries.some(item => item.id === doc.classId) ? 'Asignado a otra jornada' : 'Sin prueba asignada'}</option>
          {entries.map(item => <option key={item.id} value={item.id}>Prueba {item.number} · {item.name}</option>)}
        </select>
      </label>)}
    </section>
  </div>;
}

function ClassForm({ day, entry, busy, onSave, onCancel }: {
  day: CompetitionDay; entry: CompetitionClass | null; busy: boolean;
  onSave: (entry: Omit<CompetitionClass, 'id'> & { id?: string }) => Promise<void>; onCancel: () => void;
}) {
  const [number, setNumber] = useState(entry?.number || '');
  const [name, setName] = useState(entry?.name || '');
  const [time, setTime] = useState(entry?.time || '');
  const [description, setDescription] = useState(entry?.description || '');
  const [order, setOrder] = useState(entry?.order || 1);
  return <form className="p-4 border rounded-xl space-y-3" onSubmit={event => {
    event.preventDefault();
    void onSave({ id: entry?.id, dayId: day.id, eventId: day.eventId, date: day.date, number, name, time, description, order });
  }}>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Número<input required className={field} value={number} onChange={event => setNumber(event.target.value)} /></label>
      <label className="text-sm">Horario<input type="time" className={field} value={time} onChange={event => setTime(event.target.value)} /></label>
    </div>
    <label className="block text-sm">Nombre<input required className={field} value={name} onChange={event => setName(event.target.value)} placeholder="CSN Libre 1.30" /></label>
    <label className="block text-sm">Descripción<input className={field} value={description} onChange={event => setDescription(event.target.value)} placeholder="Dos fases especial" /></label>
    <label className="block text-sm">Orden para horarios iguales<input type="number" min="0" required className={field} value={order} onChange={event => setOrder(Number(event.target.value))} /></label>
    <div className="flex gap-2"><button disabled={busy} className={button}>Guardar prueba</button><button type="button" onClick={onCancel} className="px-3 min-h-11 text-sm">Cancelar</button></div>
  </form>;
}

export function ScheduleManager({ event, onClose }: { event: EquestrianEvent; onClose: () => void }) {
  const { days, scheduleError } = useEquestrian();
  const [date, setDate] = useState(event.startDate);
  const dates = getDaysBetween(event.startDate, event.endDate);
  const day = days.find(item => item.eventId === event.id && item.date === date);
  return <div className="fixed inset-0 z-50 bg-black/60 p-3 sm:p-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6">
      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 id="schedule-title" className="font-display text-lg font-bold text-[#123E59]">Pruebas y transmisión · {event.name}</h2>
        <button onClick={onClose} aria-label="Cerrar" className="p-3"><X className="w-5 h-5" /></button>
      </div>
      <div className="overflow-y-auto space-y-4">
        {scheduleError ? <p role="alert">{scheduleError} Aplicá la migración de jornadas antes de editar.</p> : <>
          <label className="block text-sm font-bold">Jornada<select className={field} value={date} onChange={eventForm => setDate(eventForm.target.value)}>
            {dates.map(value => <option key={value} value={value}>{formatDayHeader(value).fullFormatted}</option>)}
          </select></label>
          <DayEditor key={date + (day?.id || '')} event={event} date={date} day={day} />
        </>}
      </div>
    </div>
  </div>;
}
