import React from 'react';
import { Bell, Award } from 'lucide-react';
import { useEquestrian } from '../../context/EquestrianContext';
import { sortClasses } from '../../utils/schedule';
import { DocumentItem } from '../../types/equestrian';

export function DayProgram({ eventId, date }: { eventId: string; date: string }) {
  const { classes, documents, setViewingDocumentId } = useEquestrian();
  const entries = sortClasses(classes.filter(entry => entry.eventId === eventId && entry.date === date));
  const dayDocuments = documents.filter(doc => doc.eventId === eventId && doc.eventDate === date && doc.type !== 'PROGRAM');
  const unassigned = dayDocuments.filter(doc => !entries.some(entry => entry.id === doc.classId));
  const action = (doc: DocumentItem) => <button key={doc.id} onClick={() => setViewingDocumentId(doc.id)}
    className="inline-flex items-center gap-2 min-h-11 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-bold text-[#123E59] text-left">
    {doc.type === 'RESULT' ? <Award className="w-4 h-4 shrink-0" /> : <Bell className="w-4 h-4 shrink-0" />}
    <span>{doc.type === 'RESULT' ? 'Resultados' : 'Listado'} · {doc.name}</span>
  </button>;
  return <div className="space-y-3">
    {entries.length === 0 && <p className="text-sm text-neutral-500 py-3">Pruebas aún no publicadas.</p>}
    {entries.map(entry => {
      const attached = dayDocuments.filter(doc => doc.classId === entry.id);
      return <article key={entry.id} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="flex gap-3 sm:gap-5">
          <div className="text-[#123E59] text-sm font-bold shrink-0 pt-0.5">{entry.time || 'A confirmar'}</div>
          <div className="min-w-0">
            <p className="text-xs uppercase font-bold tracking-wider text-[#A61E4D]">Prueba {entry.number}</p>
            <h3 className="font-display font-bold text-lg text-[#123E59] break-words">{entry.name}</h3>
            {entry.description && <p className="text-sm text-neutral-500 mt-1">{entry.description}</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {attached.map(action)}
          {!attached.some(doc => doc.type === 'START_LIST') && <span className="inline-flex items-center gap-2 text-xs text-neutral-500 min-h-11 px-3"><Bell className="w-4 h-4" />Listado pendiente</span>}
          {!attached.some(doc => doc.type === 'RESULT') && <span className="inline-flex items-center gap-2 text-xs text-neutral-500 min-h-11 px-3"><Award className="w-4 h-4" />Resultados pendientes</span>}
        </div>
      </article>;
    })}
    {unassigned.length > 0 && <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-600">Documentos de la jornada</h3>
      <div className="flex flex-col gap-2">{unassigned.map(action)}</div>
    </section>}
  </div>;
}
