import type { CompetitionClass, DocumentItem, DocumentType } from '../types/equestrian.ts';

export const GENERAL_DOCUMENT_TYPES: readonly DocumentType[] = ['PROGRAM', 'REGULATION', 'OTHER'] as const;

export function isGeneralDocumentType(type: DocumentType): boolean {
  return type === 'PROGRAM' || type === 'REGULATION' || type === 'OTHER';
}

export function documentTypeLabel(type: DocumentType): string {
  if (type === 'PROGRAM') return 'Anteprograma';
  if (type === 'REGULATION') return 'Reglamento';
  if (type === 'OTHER') return 'Otro documento';
  return type === 'START_LIST' ? 'Listado' : 'Resultados';
}

export function documentLabel(doc: Pick<DocumentItem, 'type' | 'classId'> & { name?: string }, classes: CompetitionClass[]): string {
  if (doc.type === 'OTHER') {
    const trimmed = (doc.name || '').trim();
    return trimmed || 'Otro documento';
  }
  const label = documentTypeLabel(doc.type);
  if (isGeneralDocumentType(doc.type)) return label;
  const entry = classes.find(item => item.id === doc.classId);
  return entry ? label + ' · Prueba ' + entry.number + ' · ' + entry.name : label + ' · Pendiente de asignar';
}

export function documentAssociation(type: DocumentType, classId: string | null | undefined, eventId: string, classes: CompetitionClass[]) {
  if (isGeneralDocumentType(type)) return { classId: null, eventDate: null };
  const entry = classes.find(item => item.id === classId && item.eventId === eventId);
  if (!entry) throw new Error('Seleccioná la prueba a la que pertenece el documento.');
  return { classId: entry.id, eventDate: entry.date };
}
