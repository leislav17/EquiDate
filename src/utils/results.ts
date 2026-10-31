import { validateStartEntries, reviewStartImport, publishedStartList, type StartEntry, type StartImport, type StartHead, type StartVersion } from './startLists.ts';
import type { CompetitionClass, DocumentItem } from '../types/equestrian.ts';

export interface ResultColumn { key: string; label: string; group?: string; scope?: 'class' }
export interface ResultEntry extends StartEntry { rank?: string; category?: string; qualified?: boolean; values?: Record<string, string> }
export interface ResultRound { label: string; allowedTime?: string; optimalTime?: string }
export interface ResultDetails { definition?: string; height?: string; allowedTime?: string; optimalTime?: string; rounds?: ResultRound[] }
export interface ResultVersion extends StartVersion { columns: ResultColumn[]; entries: ResultEntry[]; details?: ResultDetails }
export interface ResultImport extends StartImport { columns: ResultColumn[]; entries: ResultEntry[]; details?: ResultDetails }
export type ResultFormat = 'single' | 'optimum' | 'two_phases' | 'jump_off' | 'two_rounds';
export function resultColumnsForFormat(format: ResultFormat, detailedFaults = true): ResultColumn[] {
  const round = (prefix = '', group?: string): ResultColumn[] => [
    { key: prefix + 'obstacle_faults', label: 'Faltas obstáculos' }, { key: prefix + 'time_faults', label: 'Faltas tiempo' },
    { key: prefix + 'faults', label: 'Total faltas' }, { key: prefix + 'time', label: 'Tiempo' },
  ].filter(c => detailedFaults || (!c.key.endsWith('obstacle_faults') && !c.key.endsWith('time_faults')))
    .map(c => ({ ...c, ...(c.key.endsWith('faults') && !detailedFaults ? { label: 'Faltas' } : {}), ...(group ? { group } : {}) }));
  if (format === 'single') return round();
  if (format === 'optimum') return [...round(), { key: 'time_difference', label: 'Diferencia al óptimo' }];
  const labels = format === 'jump_off' ? ['Recorrido', 'Desempate'] : format === 'two_rounds' ? ['Recorrido 1', 'Recorrido 2'] : ['Fase 1', 'Fase 2'];
  return [...round('round1_', labels[0]), ...round('round2_', labels[1]), ...(format === 'jump_off' ? [] : [{ key: 'total_faults', label: 'Total faltas de la prueba' }])];
}
export function resultColumnsForPhases(phases: 1 | 2): ResultColumn[] {
  return phases === 1 ? [{ key: 'faults', label: 'Faltas' }, { key: 'time', label: 'Tiempo' }]
    : [1, 2].flatMap(phase => [{ key: `phase${phase}_faults`, label: 'Faltas' }, { key: `phase${phase}_time`, label: 'Tiempo' }]);
}
export function resultColumnGroups(columns: ResultColumn[]): { label: string; columns: ResultColumn[] }[] {
  if (columns.some(c => c.group)) {
    const groups: { label: string; columns: ResultColumn[] }[] = [];
    for (const col of columns) {
      const label = col.group || '';
      const last = groups.at(-1);
      if (last?.label === label) last.columns.push(col); else groups.push({ label, columns: [col] });
    }
    return groups;
  }
  const keys = resultColumnsForPhases(2).map(c => c.key);
  if (columns.length === 4 && columns.every((c, i) => c.key === keys[i])) {
    return [{ label: 'Fase 1', columns: columns.slice(0, 2) }, { label: 'Fase 2', columns: columns.slice(2) }];
  }
  return [{ label: '', columns }];
}
export function validateResultColumns(value: unknown): ResultColumn[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Se permiten hasta 12 columnas de resultados.');
  const keys = new Set<string>();
  return value.map(c => {
    if (!c || typeof c.key !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(c.key) || keys.has(c.key) || typeof c.label !== 'string' || !c.label.trim() || c.label.trim().length > 80) throw new Error('Columna de resultados inválida o repetida.');
    if (c.scope != null && c.scope !== 'class') throw new Error('Las columnas del campeonato quedan fuera de los resultados de la prueba.');
    if (c.group != null && (typeof c.group !== 'string' || c.group.trim().length > 80)) throw new Error('Grupo de columnas inválido.');
    keys.add(c.key); return { key: c.key, label: c.label.trim(), ...(c.group?.trim() ? { group: c.group.trim() } : {}), ...(c.scope ? { scope: c.scope } : {}) };
  });
}
export function validateResultDetails(value: unknown): ResultDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos de la prueba inválidos.');
  const details = value as Record<string, unknown>, result: Record<string, unknown> = {};
  const fields = ['definition', 'height', 'allowedTime', 'optimalTime'];
  for (const key of Object.keys(details)) if (![...fields, 'rounds'].includes(key)) throw new Error('Dato de prueba desconocido.');
  for (const key of fields) if (details[key] != null) {
    if (typeof details[key] !== 'string' || (details[key] as string).length > 300) throw new Error('Datos de la prueba inválidos.');
    result[key] = (details[key] as string).trim();
  }
  if (details.rounds != null) {
    if (!Array.isArray(details.rounds) || details.rounds.length > 4) throw new Error('Recorridos inválidos.');
    result.rounds = details.rounds.map(r => {
      if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.label !== 'string' || !r.label.trim() || r.label.length > 80 || Object.keys(r).some(k => !['label','allowedTime','optimalTime'].includes(k))) throw new Error('Recorrido inválido.');
      const ref: ResultRound = { label: r.label.trim() };
      for (const key of ['allowedTime','optimalTime'] as const) if (r[key] != null) {
        if (typeof r[key] !== 'string' || r[key].length > 300) throw new Error('Tiempo de referencia inválido.');
        ref[key] = r[key].trim();
      }
      return ref;
    });
  }
  return result as ResultDetails;
}
export function validateResultEntries(value: unknown, columns: ResultColumn[]): ResultEntry[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Resultados inválidos.');
  const positions = new Set<number>(), pairs = new Set<string>();
  const keys = new Set(columns.map(c => c.key));
  return value.map(original => {
    const row = validateStartEntries([original])[0];
    if (positions.has(row.position)) throw new Error('Orden repetido.');
    positions.add(row.position);
    if (original.category != null && (typeof original.category !== 'string' || original.category.length > 100)) throw new Error('Categoría inválida.');
    if ('qualified' in original && typeof original.qualified !== 'boolean') throw new Error('Clasificación inválida.');
    const category = original.category?.trim();
    const pair = JSON.stringify([row.rider, row.horse, category || ''].map(s => s.toLowerCase().replace(/\s+/g, ' ')));
    if (row.horse && pairs.has(pair)) throw new Error('Binomio duplicado en la misma categoría.');
    if (row.horse) pairs.add(pair);
    if (original.rank != null && (typeof original.rank !== 'string' || original.rank.length > 60)) throw new Error('Puesto inválido.');
    const values = original.values ?? {};
    if (typeof values !== 'object' || Array.isArray(values)) throw new Error('Valores de resultados inválidos.');
    for (const [key, val] of Object.entries(values)) if (!keys.has(key) || typeof val !== 'string' || val.length > 300) throw new Error('Columna desconocida o valor inválido.');
    return { ...row, rank: original.rank?.trim() || '', values: { ...values }, ...(category != null ? { category } : {}), ...('qualified' in original ? { qualified: original.qualified } : {}) };
  }).sort((a,b) => a.position - b.position);
}
export function reviewResultImport(value: unknown, classes: CompetitionClass[], heads: StartHead[], eventId: string): ResultImport[] {
  const base = reviewStartImport(Array.isArray(value) ? value.map(item => ({ ...item, entries: [] })) : value, classes, heads, eventId);
  return base.map((item, i) => {
    const original = (value as ResultImport[])[i];
    const columns = validateResultColumns(original.columns);
    return { ...item, columns, entries: validateResultEntries(original.entries, columns), details: validateResultDetails(original.details ?? {}) };
  });
}
export const publishedResults = (classId: string, heads: StartHead[], versions: ResultVersion[]) => publishedStartList(classId, heads, versions) as ResultVersion | undefined;
export const resultPdf = (docs: DocumentItem[], classId: string) => docs.find(d => d.classId === classId && d.type === 'RESULT' && d.mimeType.toLowerCase() === 'application/pdf');
