import type { CompetitionClass, DocumentItem, DocumentType } from '../types/equestrian.ts';
import type { StartHead } from './startLists.ts';

export interface DocumentFilters { search: string; type: DocumentType | ''; date: string; classId: string }
export interface StructuredDocument { classId: string; type: 'START_LIST' | 'RESULT'; published: boolean }
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

/** A head with no current version still represents recoverable history, not an empty class. */
export function filterAdminDocuments(eventId: string, documents: DocumentItem[], classes: CompetitionClass[], startHeads: StartHead[], resultHeads: StartHead[], filters: DocumentFilters) {
  const eventClasses = classes.filter(c => c.eventId === eventId);
  const matches = (type: DocumentType, date: string | null, classId: string | null | undefined, name: string) => {
    const entry = eventClasses.find(c => c.id === classId);
    const haystack = normalize([name, date, entry?.number, entry?.name].filter(Boolean).join(' '));
    return (!filters.type || type === filters.type) && (!filters.date || date === filters.date)
      && (!filters.classId || classId === filters.classId) && haystack.includes(normalize(filters.search.trim()));
  };
  const files = documents.filter(doc => doc.eventId === eventId && matches(doc.type, doc.eventDate, doc.classId, doc.name));
  const structured: StructuredDocument[] = [];
  for (const entry of eventClasses) {
    for (const type of ['START_LIST', 'RESULT'] as const) {
      const head = (type === 'START_LIST' ? startHeads : resultHeads).find(h => h.class_id === entry.id);
      if (head && matches(type, entry.date, entry.id, type === 'START_LIST' ? 'Órdenes de ingreso' : 'Resultados')) {
        structured.push({ classId: entry.id, type, published: Boolean(head.version_id) });
      }
    }
  }
  return { files, structured };
}
