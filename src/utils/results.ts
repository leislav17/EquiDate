import { validateStartEntries, reviewStartImport, publishedStartList, type StartEntry, type StartImport, type StartHead, type StartVersion } from './startLists.ts';
import type { CompetitionClass, DocumentItem } from '../types/equestrian.ts';

export interface ResultColumn { key: string; label: string }
export interface ResultEntry extends StartEntry { rank?: string; values?: Record<string, string> }
export interface ResultVersion extends StartVersion { columns: ResultColumn[]; entries: ResultEntry[] }
export interface ResultImport extends StartImport { columns: ResultColumn[]; entries: ResultEntry[] }
export function validateResultColumns(value: unknown): ResultColumn[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Se permiten hasta 12 columnas de resultados.');
  const keys = new Set<string>();
  return value.map(c => {
    if (!c || typeof c.key !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(c.key) || keys.has(c.key) || typeof c.label !== 'string' || !c.label.trim() || c.label.trim().length > 80) throw new Error('Columna de resultados inválida o repetida.');
    keys.add(c.key); return { key: c.key, label: c.label.trim() };
  });
}
export function validateResultEntries(value: unknown, columns: ResultColumn[]): ResultEntry[] {
  const base = validateStartEntries(value);
  const originals = new Map((value as ResultEntry[]).map(r => [r.position, r]));
  const keys = new Set(columns.map(c => c.key));
  return base.map(row => {
    const original = originals.get(row.position)!;
    if (original.rank != null && (typeof original.rank !== 'string' || original.rank.length > 60)) throw new Error('Puesto inválido.');
    const values = original.values ?? {};
    if (typeof values !== 'object' || Array.isArray(values)) throw new Error('Valores de resultados inválidos.');
    for (const [key, val] of Object.entries(values)) if (!keys.has(key) || typeof val !== 'string' || val.length > 300) throw new Error('Columna desconocida o valor inválido.');
    return { ...row, rank: original.rank?.trim() || '', values: { ...values } };
  });
}
export function reviewResultImport(value: unknown, classes: CompetitionClass[], heads: StartHead[], eventId: string): ResultImport[] {
  const base = reviewStartImport(value, classes, heads, eventId);
  return base.map((item, i) => {
    const original = (value as ResultImport[])[i];
    const columns = validateResultColumns(original.columns);
    return { ...item, columns, entries: validateResultEntries(original.entries, columns) };
  });
}
export const publishedResults = (classId: string, heads: StartHead[], versions: ResultVersion[]) => publishedStartList(classId, heads, versions) as ResultVersion | undefined;
export const resultPdf = (docs: DocumentItem[], classId: string) => docs.find(d => d.classId === classId && d.type === 'RESULT' && d.mimeType.toLowerCase() === 'application/pdf');
