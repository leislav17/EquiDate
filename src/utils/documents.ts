import type { CompetitionClass, DocumentItem, DocumentType } from '../types/equestrian.ts';

export function documentTypeLabel(type: DocumentType): string {
  return type === 'PROGRAM' ? 'Anteprograma' : type === 'START_LIST' ? 'Listado' : 'Resultados';
}

export function documentLabel(doc: Pick<DocumentItem, 'type' | 'classId'>, classes: CompetitionClass[]): string {
  const label = documentTypeLabel(doc.type);
  if (doc.type === 'PROGRAM') return label;
  const entry = classes.find(item => item.id === doc.classId);
  return entry ? label + ' · Prueba ' + entry.number + ' · ' + entry.name : label + ' · Pendiente de asignar';
}

export function documentAssociation(type: DocumentType, classId: string | null | undefined, eventId: string, classes: CompetitionClass[]) {
  if (type === 'PROGRAM') return { classId: null, eventDate: null };
  const entry = classes.find(item => item.id === classId && item.eventId === eventId);
  if (!entry) throw new Error('Seleccioná la prueba a la que pertenece el documento.');
  return { classId: entry.id, eventDate: entry.date };
}
