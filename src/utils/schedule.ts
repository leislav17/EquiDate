import type { CompetitionClass, CompetitionArena } from '../types/equestrian.ts';

export const DEFAULT_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function getYouTubeId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let videoId: string | null = null;
    if (host === 'youtu.be') videoId = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v');
      else {
        const match = url.pathname.match(/^\/(?:embed|live|shorts)\/([A-Za-z0-9_-]{11})\/?$/);
        videoId = match?.[1] || null;
      }
    }
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
  } catch { return null; }
}

export function transmissionLabel(date: string, timeZone = DEFAULT_TIME_ZONE, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  const today = part('year') + '-' + part('month') + '-' + part('day');
  return date === today ? 'VER EN VIVO' : date < today ? 'VER TRANSMISIÓN' : 'VER PRÓXIMA TRANSMISIÓN';
}

export function formatClassSchedule(item?: {
  time?: string | null;
  isApproximate?: boolean;
  isContinuous?: boolean;
}): string {
  if (!item) return '';
  if (item.isContinuous) {
    return 'Continuado';
  }
  const clean = (item.time || '').trim().slice(0, 5);
  if (!clean) return '';
  return item.isApproximate ? `${clean} hs (aprox.)` : `${clean} hs`;
}

export function sortClasses(entries: CompetitionClass[]): CompetitionClass[] {
  const ordersWithoutTime = new Set(entries
    .filter(entry => !(entry.time || '').trim())
    .map(entry => typeof entry.order === 'number' ? entry.order : 0));
  return [...entries].sort((first, second) => {
    // 1. Prioridad principal: Orden de visualización configurado
    const orderA = typeof first.order === 'number' ? first.order : 0;
    const orderB = typeof second.order === 'number' ? second.order : 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 2. Si el orden relativo es igual: los horarios ayudan al orden inicial si ambos tienen horario
    const timeA = (first.time || '').trim().slice(0, 5);
    const timeB = (second.time || '').trim().slice(0, 5);
    if (!ordersWithoutTime.has(orderA) && timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    // 3. Identificación: números (1, 2, 3...) o letras (A, B, C...)
    // Las pruebas sin horario mantienen su posición según su identificación y no van al final automáticamente
    const numA = (first.number || '').trim();
    const numB = (second.number || '').trim();
    const numComparison = numA.localeCompare(numB, 'es', { numeric: true, sensitivity: 'base' });
    if (numComparison !== 0) {
      return numComparison;
    }

    // 4. Si tienen el mismo número o ambos están vacíos, el que tiene horario definido precede
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;

    // 5. Desempate estable por ID
    return (first.id || '').localeCompare(second.id || '');
  });
}

export function sortArenas(arenas: CompetitionArena[]): CompetitionArena[] {
  return [...arenas].sort((first, second) => {
    const orderA = typeof first.order === 'number' ? first.order : (first.isPrimary ? 0 : 100);
    const orderB = typeof second.order === 'number' ? second.order : (second.isPrimary ? 0 : 100);
    if (orderA !== orderB) return orderA - orderB;
    if (first.isPrimary !== second.isPrimary) return first.isPrimary ? -1 : 1;
    return first.name.localeCompare(second.name, 'es', { sensitivity: 'base' });
  });
}
