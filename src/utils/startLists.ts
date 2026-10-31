import type { CompetitionClass, DocumentItem } from '../types/equestrian.ts';

export interface StartEntry { position: number; rider: string; horse: string; club?: string | null }
export interface StartVersion { id: string; class_id: string; entries: StartEntry[]; source_name: string; created_at: string }
export interface StartHead { class_id: string; version_id: string | null; revision: string }
export interface StartImport {
  id: string; classId: string; eventId: string; date: string; arenaId: string; number: string;
  expectedRevision: string | null; sourceName: string; reviewed: boolean; uncertainties: string[]; entries: StartEntry[];
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalized = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export function validateStartEntries(value: unknown): StartEntry[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('El listado debe contener hasta 10.000 filas.');
  const positions = new Set<number>(), pairs = new Set<string>();
  return value.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Fila ${index + 1} inválida.`);
    const { position, rider, horse, club } = row;
    if (!Number.isSafeInteger(position) || position < 1 || position > 2147483647 || positions.has(position)) throw new Error(`Orden inválido o repetido en fila ${index + 1}.`);
    if (typeof rider !== 'string' || !rider.trim() || rider.trim().length > 300 || typeof horse !== 'string' || horse.trim().length > 300) throw new Error(`Revisá jinete y caballo en fila ${index + 1}.`);
    if (club != null && (typeof club !== 'string' || club.length > 300)) throw new Error(`Club inválido en fila ${index + 1}.`);
    const pair = JSON.stringify([normalized(rider), normalized(horse)]);
    if (horse.trim() && pairs.has(pair)) throw new Error(`Binomio duplicado en fila ${index + 1}.`);
    positions.add(position); if (horse.trim()) pairs.add(pair);
    return { position, rider: rider.trim(), horse: horse.trim(), club: club?.trim() || null };
  }).sort((a, b) => a.position - b.position);
}
export function reviewStartImport(value: unknown, classes: CompetitionClass[], heads: StartHead[], eventId: string): StartImport[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new Error('Ingresá un lote de 1 a 100 pruebas.');
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== 'object' || !uuid.test(item.id || '') || !uuid.test(item.classId || '')) throw new Error('Faltan identificadores válidos de prueba o versión.');
    const entry = classes.find(c => c.id === item.classId && c.eventId === eventId);
    if (!entry || item.eventId !== eventId || item.date !== entry.date || item.arenaId !== entry.arenaId || item.number !== entry.number) throw new Error('No coincide concurso, fecha, pista o número de prueba.');
    if (seen.has(item.classId)) throw new Error('Una prueba aparece más de una vez en el lote.');
    seen.add(item.classId);
    const head = heads.find(h => h.class_id === item.classId);
    if (item.expectedRevision !== (head?.revision ?? null)) throw new Error(`Prueba ${entry.number}: el listado cambió. Actualizá el lote.`);
    if (typeof item.sourceName !== 'string' || !item.sourceName.trim() || item.sourceName.trim().length > 500) throw new Error('Indicá el nombre del PDF de origen.');
    if (!Array.isArray(item.uncertainties) || item.uncertainties.length || item.reviewed !== true) throw new Error('Revisá el PDF y resolvé todos los datos inciertos antes de importar.');
    return { ...item, sourceName: item.sourceName.trim(), entries: validateStartEntries(item.entries) };
  });
}
export function publishedStartList(classId: string, heads: StartHead[], versions: StartVersion[]) {
  const head = heads.find(h => h.class_id === classId);
  return versions.find(v => v.id === head?.version_id && v.class_id === classId);
}
export function startListAction(list: StartVersion | undefined, documents: DocumentItem[]) {
  if (list) return 'structured';
  return documents.some(d => d.type === 'START_LIST') ? 'document' : 'hidden';
}
export function startParticipantCount(list: StartVersion | undefined, manual?: number | null) {
  return list ? list.entries.length : manual;
}
export const startPdf = (documents: DocumentItem[], classId: string) => documents.find(d => d.classId === classId && d.type === 'START_LIST' && d.mimeType.toLowerCase() === 'application/pdf');
