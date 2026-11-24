import { hasSecondPart, type ClassCatalog } from './competitionCatalog.ts';

export function liveParts(entry: {
  catalog?: ClassCatalog | null; liveFormat?: string | null; name?: string; description?: string;
}) {
  const behavior = entry.catalog?.definition.behavior;
  const jumpOff = behavior ? behavior === '1D' : isJumpOff(entry.liveFormat, entry.name, entry.description);
  const doubleRound = behavior ? behavior === 'DR' : isDoubleRound(entry.liveFormat, entry.name, entry.description);
  const qualifiedSecond = jumpOff || doubleRound;
  return { jumpOff, qualifiedSecond, twoPhases: behavior ? hasSecondPart(behavior) : qualifiedSecond || hasTwoPhases(entry.description) };
}

/** The schedule uses 2FE for two special phases. */
export function hasTwoPhases(description?: string): boolean {
  const text = (description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b2\s*f(?:e)?\b|\b(?:doble|dos)\s+(?:fase|fases|faz|fazes)\b|\b2\s+(?:fase|fases|faz|fazes)\b/.test(text);
}

/** Recognize a legacy double round from its name or description. */
export function isDoubleRound(format?: string|null, name?: string|null, description?: string|null): boolean {
  if(format==='double_round')return true;
  if(format)return false;
  const text=`${name ?? ''} ${description ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /(^|[^a-z0-9_])(?:dr|doble\s+recorrido)(?=$|[^a-z0-9_])/.test(text);
}

/** A single jump-off requires an explicit selection for its second result. */
export function isJumpOff(format?: string|null, name?: string|null, description?: string|null): boolean {
  if (format) return false;
  const text = `${name ?? ''} ${description ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /(^|[^a-z0-9_])(?:1\s*(?:d|desempate)|un\s+desempate)(?=$|[^a-z0-9_])/.test(text);
}
