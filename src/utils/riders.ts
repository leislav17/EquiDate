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
  const parents = new Map<string, string>();
  const root = (key: string): string => {
    const parent = parents.get(key);
    if (!parent || parent === key) return key;
    const result = root(parent); parents.set(key, result); return result;
  };
  // Existing corrections can join spelling variants, but never split an exact full name.
  for (const entry of classes) {
    if (!events.some(e => e.id === entry.eventId && e.status === 'published')) continue;
    [publishedStartList(entry.id, startHeads, startVersions), publishedResults(entry.id, resultHeads, resultVersions)].forEach((version, index) => {
      for (const row of version?.entries || []) {
        const manual = overrides.get(`${index === 0 ? 'start' : 'result'}:${version!.id}:${row.position}`);
        if (manual) parents.set(root('name:' + normalizeRider(row.rider)), root('manual:' + manual));
      }
    });
  }
  const groups = new Map<string, RiderCandidate>();
  for (const entry of classes) {
    if (!events.some(e => e.id === entry.eventId && e.status === 'published')) continue;
    const versions = [publishedStartList(entry.id, startHeads, startVersions), publishedResults(entry.id, resultHeads, resultVersions)];
    versions.forEach((version, index) => {
      if (!version) return;
      const kind = index === 0 ? 'start' : 'result';
      for (const row of version.entries) {
        const source = `${kind}:${version.id}:${row.position}`;
        const identity = root('name:' + normalizeRider(row.rider));
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

export interface RiderSuggestion { id: string; candidates: RiderCandidate[]; reasons: string[]; priority: number }
const nameWords = (name: string) => normalizeRider(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).sort();
function oneEdit(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
/** Review hints only. Never change identity or infer a numerical probability from PDF names. */
export function suggestRiderAssociations(directory: RiderCandidate[]): RiderSuggestion[] {
  const suggestions: RiderSuggestion[] = [];
  const names = new Map(directory.map(c => [c.id, [...new Set(c.records.map(r => r.row.rider))].map(nameWords)]));
  for (let i = 0; i < directory.length; i++) for (let j = i + 1; j < directory.length; j++) {
    const a = directory[i], b = directory[j];
    // Explicitly separated people must not be proposed for automatic re-merging.
    if (a.id.startsWith('manual:') && b.id.startsWith('manual:')) continue;
    let exact = false, similar = false;
    for (const aw of names.get(a.id)!) for (const bw of names.get(b.id)!) {
      if (aw.length < 2 || aw.length !== bw.length) continue;
      const differences = aw.map((word, index) => [word, bw[index]]).filter(([x,y]) => x !== y);
      if (!differences.length) exact = true;
      else if (differences.length === 1 && oneEdit(differences[0][0], differences[0][1])) similar = true;
    }
    if (!exact && !similar) continue;
    const shared = (xs: string[], ys: string[]) => xs.some(x => normalizeRider(x) && ys.some(y => normalizeRider(x) === normalizeRider(y)));
    const sameClub = shared(a.clubs, b.clubs);
    const sameHorse = shared(a.horses.filter(knownHorse), b.horses.filter(knownHorse));
    suggestions.push({ id: JSON.stringify([a.id,b.id]), candidates: [a,b], priority: (exact ? 4 : 0) + (sameClub ? 2 : 0) + (sameHorse ? 1 : 0), reasons: [exact ? 'Mismo nombre completo' : 'Nombre completo con una diferencia de escritura', ...(sameClub ? ['Club coincidente'] : []), ...(sameHorse ? ['Caballo coincidente'] : [])] });
  }
  return suggestions.sort((a,b) => b.priority - a.priority || a.candidates[0].name.localeCompare(b.candidates[0].name, 'es') || a.id.localeCompare(b.id));
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
    const result = unique ? matching[0] : undefined;
    if (result) used.add(result.source);
    return { id: start.source, classId: start.classId, start, result };
  });
  for (const result of results) if (!used.has(result.source)) rows.push({ id: result.source, classId: result.classId, result });
  return rows;
}
