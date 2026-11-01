import type { CompetitionClass, EquestrianEvent } from '../types/equestrian.ts';
import { publishedStartList, type StartHead, type StartVersion, type StartEntry } from './startLists.ts';
import { publishedResults, type ResultVersion, type ResultEntry } from './results.ts';

export const normalizeRider = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
export interface RiderAssociation { source: string; identity: string }
export interface RiderRecord { source: string; classId: string; row: StartEntry; kind: 'start' | 'result'; version: StartVersion | ResultVersion; identity: string }
export interface RiderCandidate { id: string; name: string; horses: string[]; clubs: string[]; records: RiderRecord[] }
export interface Participation { id: string; classId: string; start?: RiderRecord; result?: RiderRecord }
const pair = (row: StartEntry) => JSON.stringify([normalizeRider(row.rider), normalizeRider(row.horse)]);
const knownHorse = (horse: string) => !!normalizeRider(horse) && !/^(?:[-–—?.]+|s\/?d|sin (?:caballo|datos)|no informado)$/i.test(normalizeRider(horse));

/** Only current published pointers and public events enter the public directory, even in an admin session. */
export function riderDirectory(events: EquestrianEvent[], classes: CompetitionClass[], startHeads: StartHead[], startVersions: StartVersion[], resultHeads: StartHead[], resultVersions: ResultVersion[], associations: RiderAssociation[] = []): RiderCandidate[] {
  const overrides = new Map(associations.map(a => [a.source, a.identity]));
  const groups = new Map<string, RiderCandidate>();
  for (const entry of classes) {
    if (!events.some(e => e.id === entry.eventId && e.status === 'published')) continue;
    const versions = [publishedStartList(entry.id, startHeads, startVersions), publishedResults(entry.id, resultHeads, resultVersions)];
    versions.forEach((version, index) => {
      if (!version) return;
      const kind = index === 0 ? 'start' : 'result';
      for (const row of version.entries) {
        const source = `${kind}:${version.id}:${row.position}`;
        const identity = overrides.has(source) ? 'manual:' + overrides.get(source) : knownHorse(row.horse) ? 'pair:' + pair(row) : 'unknown:' + source;
        const group = groups.get(identity) || { id: identity, name: row.rider, horses: [], clubs: [], records: [] };
        if (row.horse && !group.horses.includes(row.horse)) group.horses.push(row.horse);
        if (row.club && !group.clubs.includes(row.club)) group.clubs.push(row.club);
        group.records.push({ source, classId: entry.id, row, kind, version, identity });
        groups.set(identity, group);
      }
    });
  }
  return [...groups.values()].sort((a,b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
}

export function searchRiders(directory: RiderCandidate[], query: string): RiderCandidate[] {
  const words = normalizeRider(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return directory.filter(candidate => candidate.records.some(r => words.every(word => normalizeRider(r.row.rider).includes(word))));
}

/** A manual identity association never implies that two entries are the same performance. */
export function riderParticipations(candidate: RiderCandidate): Participation[] {
  const starts = candidate.records.filter(r => r.kind === 'start');
  const results = candidate.records.filter(r => r.kind === 'result');
  const used = new Set<string>();
  const samePair = (a: RiderRecord, b: RiderRecord) => a.classId === b.classId && knownHorse(a.row.horse) && pair(a.row) === pair(b.row);
  const rows: Participation[] = starts.map(start => {
    const matching = results.filter(r => samePair(start, r));
    const unique = matching.length === 1 && starts.filter(s => samePair(s, matching[0])).length === 1;
    const result = unique && (!start.row.category || !matching[0].row.category || normalizeRider(start.row.category) === normalizeRider(matching[0].row.category)) ? matching[0] : undefined;
    if (result) used.add(result.source);
    return { id: start.source, classId: start.classId, start, result };
  });
  for (const result of results) if (!used.has(result.source)) rows.push({ id: result.source, classId: result.classId, result });
  return rows;
}
