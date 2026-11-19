/** The schedule uses 2FE for two special phases. */
export function hasTwoPhases(description?: string): boolean {
  const text = (description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b2\s*f(?:e)?\b|\b(?:doble|dos)\s+(?:fase|fases|faz|fazes)\b|\b2\s+(?:fase|fases|faz|fazes)\b/.test(text);
}
