export type TimeGroup = 'shared' | 'school' | 'third';
export type Part = '1' | '2';
export type TimeField = 'distance' | 'sharedAllowed' | 'sharedOptimal' | 'schoolAllowed' | 'thirdAllowed' | 'schoolOptimal' | 'thirdOptimal';
export type PartTimes = Partial<Record<TimeField, number>>;
export type LiveTimeLimits = Partial<Record<Part, PartTimes>>;

export function liveClassHeight(name?: string, description?: string): number | undefined {
  const text = [name, description].filter(Boolean).join(' ');
  const metres = /\b([01][.,]\d{1,2})\s*m(?![a-z])/i.exec(text);
  if (metres) return Math.round(Number(metres[1].replace(',', '.')) * 100);
  const cm = /\b(40|50|60|70|80|90)\s*cm\b/i.exec(text);
  return cm ? Number(cm[1]) : undefined;
}

export function timeGroup(category: string | undefined, height?: number): TimeGroup {
  const words = (category ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if ([40, 50, 60, 70, 80, 90].includes(height ?? 0) && /\b(?:escuela|esc)\b/.test(words)) return 'school';
  if (height === 90 && /\b(?:tercera|3ra|3era|3[°ºª]|3\s*ra)(?!\w)/.test(words)) return 'third';
  return 'shared';
}

const schoolSpeeds: Record<number, readonly [number, number]> = {
  40: [275, 325], 50: [275, 325], 60: [300, 350],
  70: [300, 350], 80: [325, 375], 90: [325, 375],
};
const roundUp = (numerator: number, denominator: number) => Math.ceil(numerator / denominator);

export function resolvePartTimes(settings: PartTimes = {}, height?: number): PartTimes {
  const resolved = { ...settings };
  const school = schoolSpeeds[height ?? 0];
  if (!school) return resolved;

  const [schoolAllowedSpeed, schoolOptimalSpeed] = school;
  const [thirdAllowedSpeed, thirdOptimalSpeed] = [350, 400];
  const distance = settings.distance;
  resolved.schoolAllowed ??= distance
    ? roundUp(distance * 60, schoolAllowedSpeed)
    : height === 90 && settings.thirdAllowed
      ? roundUp(settings.thirdAllowed * thirdAllowedSpeed, schoolAllowedSpeed)
      : undefined;
  if (height === 90) {
    resolved.thirdAllowed ??= distance
      ? roundUp(distance * 60, thirdAllowedSpeed)
      : settings.schoolAllowed
        ? roundUp(settings.schoolAllowed * schoolAllowedSpeed, thirdAllowedSpeed)
        : undefined;
    resolved.thirdOptimal ??= distance
      ? roundUp(distance * 60, thirdOptimalSpeed)
      : settings.thirdAllowed
        ? roundUp(settings.thirdAllowed * thirdAllowedSpeed, thirdOptimalSpeed)
        : settings.schoolAllowed
          ? roundUp(settings.schoolAllowed * schoolAllowedSpeed, thirdOptimalSpeed)
          : undefined;
  }

  resolved.schoolOptimal ??= distance
    ? roundUp(distance * 60, schoolOptimalSpeed)
    : settings.schoolAllowed
      ? roundUp(settings.schoolAllowed * schoolAllowedSpeed, schoolOptimalSpeed)
      : height === 90 && settings.thirdAllowed
        ? roundUp(settings.thirdAllowed * thirdAllowedSpeed, schoolOptimalSpeed)
        : undefined;
  return resolved;
}

export function totalLiveFaults(
  obstacles: number | null | undefined, seconds: number | null | undefined, allowed: number | undefined,
): number | '' {
  if (obstacles == null) return '';
  if (seconds == null || allowed == null) return obstacles;
  return obstacles + Math.max(0, Math.ceil(Number(seconds) - allowed));
}
