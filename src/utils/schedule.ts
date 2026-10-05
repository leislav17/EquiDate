import type { CompetitionClass } from '../types/equestrian.ts';

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

export function sortClasses(entries: CompetitionClass[]): CompetitionClass[] {
  return [...entries].sort((first, second) =>
    (first.time || '99:99').localeCompare(second.time || '99:99') ||
    first.order - second.order || first.number.localeCompare(second.number, 'es', { numeric: true }) ||
    first.id.localeCompare(second.id));
}
