export const MONTHS_SHORT = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
];

export const MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DAYS_FULL = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

/**
 * Returns list of YYYY-MM-DD date strings between startDate and endDate inclusive.
 */
export function getDaysBetween(startDateStr: string, endDateStr: string): string[] {
  if (!startDateStr || !endDateStr) return [];
  
  const dates: string[] = [];
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  // Protect against inverted dates
  const cur = new Date(Math.min(start.getTime(), end.getTime()));
  const max = new Date(Math.max(start.getTime(), end.getTime()));

  while (cur <= max) {
    const year = cur.getFullYear();
    const month = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
}

/**
 * Formats a single date into full day string e.g. "VIERNES 9 OCTUBRE"
 */
export function formatDayHeader(dateStr: string): {
  dayOfWeek: string;
  dayNumber: number;
  monthName: string;
  fullFormatted: string;
} {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) {
    return {
      dayOfWeek: '',
      dayNumber: 0,
      monthName: '',
      fullFormatted: dateStr,
    };
  }

  const dayOfWeek = DAYS_FULL[d.getDay()].toUpperCase();
  const dayNumber = d.getDate();
  const monthName = MONTHS_FULL[d.getMonth()].toUpperCase();
  const fullFormatted = `${dayOfWeek} ${dayNumber} ${monthName}`;

  return {
    dayOfWeek,
    dayNumber,
    monthName,
    fullFormatted,
  };
}

/**
 * Formats date range for competition cards e.g.:
 * "10 — 12 OCT" or "04 OCT"
 */
export function formatDateRange(startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  const startDay = String(start.getDate()).padStart(2, '0');
  const endDay = String(end.getDate()).padStart(2, '0');
  const startMonth = MONTHS_SHORT[start.getMonth()];
  const endMonth = MONTHS_SHORT[end.getMonth()];

  if (startDateStr === endDateStr) {
    return `${startDay} ${startMonth}`;
  }

  if (startMonth === endMonth) {
    return `${startDay} — ${endDay} ${startMonth}`;
  }

  return `${startDay} ${startMonth} — ${endDay} ${endMonth}`;
}

/**
 * Formats full header date range e.g.:
 * "9 de Octubre — 11 de Octubre, 2026"
 */
export function formatFullDateRange(startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = MONTHS_FULL[start.getMonth()];
  const endMonth = MONTHS_FULL[end.getMonth()];
  const year = end.getFullYear();

  if (startDateStr === endDateStr) {
    return `${startDay} de ${startMonth}, ${year}`;
  }

  if (startMonth === endMonth) {
    return `${startDay} — ${endDay} de ${startMonth}, ${year}`;
  }

  return `${startDay} de ${startMonth} — ${endDay} de ${endMonth}, ${year}`;
}

/**
 * Calculates whether an event is ACTUAL, PROXIMO, or FINALIZADO
 * based on current date.
 */
export function getEventTemporalStatus(
  startDateStr: string,
  endDateStr: string,
  customTodayStr?: string
): 'ACTUAL' | 'PROXIMO' | 'FINALIZADO' {
  // Use current local date in YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = customTodayStr || `${year}-${month}-${day}`;

  if (todayStr >= startDateStr && todayStr <= endDateStr) {
    return 'ACTUAL';
  } else if (startDateStr > todayStr) {
    return 'PROXIMO';
  } else {
    return 'FINALIZADO';
  }
}

/**
 * Formats date for sports card e.g. "4 de octubre de 2026" or "16 — 18 de octubre de 2026"
 */
export function formatCardDate(startDateStr: string, endDateStr: string): string {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = MONTHS_FULL[start.getMonth()].toLowerCase();
  const endMonth = MONTHS_FULL[end.getMonth()].toLowerCase();
  const year = end.getFullYear();

  if (startDateStr === endDateStr) {
    return `${startDay} de ${startMonth} de ${year}`;
  }

  if (startMonth === endMonth) {
    return `${startDay} — ${endDay} de ${startMonth} de ${year}`;
  }

  return `${startDay} de ${startMonth} — ${endDay} de ${endMonth} de ${year}`;
}

