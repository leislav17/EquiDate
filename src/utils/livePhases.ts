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
