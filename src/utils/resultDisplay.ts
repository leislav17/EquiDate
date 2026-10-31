import { resultColumnGroups, type ResultColumn, type ResultEntry } from './results.ts';

interface FaultParts { obstacleKey?: string; timeKey?: string; totalKey?: string }
export interface ResultDisplayColumn extends ResultColumn { faultParts?: FaultParts; finalRounds?: (FaultParts | null)[]; finalSourceKey?: string }
const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const raw = (row: ResultEntry, key?: string) => key && Object.hasOwn(row.values || {}, key) ? row.values![key] : '';
const number = (value: string) => /^\d+(?:[.,]\d+)?$/.test(value.trim());
function sum(values: string[]): string {
  if (!values.length || !values.every(number)) return '';
  const parts = values.map(v => v.trim().split(/[.,]/));
  const scale = Math.max(...parts.map(p => p[1]?.length || 0));
  const total = parts.reduce((n,p) => n + BigInt(p[0] + (p[1] || '').padEnd(scale, '0')), 0n).toString().padStart(scale + 1, '0');
  if (!scale) return total;
  const decimals = total.slice(-scale).replace(/0+$/, '');
  return total.slice(0, -scale) + (decimals ? (values.some(v => v.includes(',')) ? ',' : '.') + decimals : '');
}
function roundTotal(row: ResultEntry, parts: FaultParts | null): string {
  if (!parts) return '';
  const published = raw(row, parts.totalKey);
  if (published !== '') return published;
  return sum([raw(row, parts.obstacleKey), raw(row, parts.timeKey)]);
}
const overall = (col: ResultColumn) => col.key === 'total_faults' || normalized(col.label) === 'total faltas de la prueba';

/** Compact presentation only: all source components remain stored unchanged. */
export function resultDisplayColumns(source: ResultColumn[]): ResultDisplayColumn[] {
  const result: ResultDisplayColumn[] = [], rounds: (FaultParts | null)[] = [];
  const final = source.find(overall);
  let combined = false;
  for (const [index, group] of resultColumnGroups(source).entries()) {
    const obstacle = group.columns.find(c => normalized(c.label) === 'faltas obstaculos' || c.key.endsWith('obstacle_faults'));
    const time = group.columns.find(c => normalized(c.label) === 'faltas tiempo' || c.key.endsWith('time_faults'));
    const total = group.columns.find(c => !overall(c) && c !== obstacle && c !== time && (['faltas','total faltas'].includes(normalized(c.label)) || /(?:^|_)faults$/.test(c.key)));
    const parts: FaultParts | null = obstacle || time || total ? { obstacleKey: obstacle?.key, timeKey: time?.key, totalKey: total?.key } : null;
    if (parts || group.label) rounds.push(parts);
    let inserted = false;
    for (const col of group.columns) {
      if (overall(col)) continue;
      if ((obstacle || time) && (col === obstacle || col === time || col === total)) {
        if (!inserted) result.push({ key: `__faults_${index}`, label: 'Faltas', ...(group.label ? { group: group.label } : {}), faultParts: parts! });
        inserted = true; combined = true;
      } else result.push({ ...col, ...(group.label ? { group: group.label } : {}) });
    }
  }
  if (final || (rounds.length && (rounds.length > 1 || combined))) result.push({ key: '__final_faults', label: 'Total faltas de la prueba', finalSourceKey: final?.key, finalRounds: rounds });
  return result;
}
export function resultDisplayValue(row: ResultEntry, col: ResultDisplayColumn): string {
  if (col.finalRounds) {
    const official = raw(row, col.finalSourceKey);
    if (official !== '') return official;
    return sum(col.finalRounds.map(parts => roundTotal(row, parts)));
  }
  if (col.faultParts) {
    const obstacle = raw(row, col.faultParts.obstacleKey), time = raw(row, col.faultParts.timeKey);
    if (number(obstacle) && number(time)) return `(${obstacle}+${time})`;
    return raw(row, col.faultParts.totalKey) || obstacle || time;
  }
  return raw(row, col.key);
}
