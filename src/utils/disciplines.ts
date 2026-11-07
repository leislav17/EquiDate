import type { EquestrianEvent, EventDiscipline } from '../types/equestrian.ts';

export const disciplineLabels: Record<EventDiscipline, string> = {
  jumping: 'Salto',
  dressage: 'Adiestramiento',
  training: 'Pasadas',
};

export function eventDiscipline(event?: Pick<EquestrianEvent, 'discipline'>): EventDiscipline {
  return event?.discipline ?? 'jumping';
}

export function listDiscipline(pathname: string): EventDiscipline | undefined {
  switch (pathname.replace(/\/+$/, '')) {
    case '':
    case '/jumping':
      return 'jumping';
    case '/dressage':
      return 'dressage';
    case '/training':
      return 'training';
    default:
      return undefined;
  }
}
