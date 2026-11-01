import test from 'node:test';
import assert from 'node:assert/strict';
import { riderDirectory, searchRiders, riderParticipations, suggestRiderAssociations } from '../src/utils/riders.ts';
import type { CompetitionClass, EquestrianEvent } from '../src/types/equestrian.ts';
import type { StartEntry, StartVersion } from '../src/utils/startLists.ts';
const events = [{ id: 'e', status: 'published' }, { id: 'draft', status: 'draft' }] as EquestrianEvent[];
const classes = [{ id: 'a', eventId: 'e' }, { id: 'b', eventId: 'e' }, { id: 'private', eventId: 'draft' }] as CompetitionClass[];
const row = (horse = 'Relámpago', rider = 'Martína Fernández', position = 1): StartEntry => ({ rider, horse, position, club: 'Club A' });
function directory(startRows = [row()], resultRows = [row()], secondRows: StartEntry[] = []) {
  const starts = [{ id: 's', class_id: 'a', entries: startRows }, { id: 's2', class_id: 'b', entries: secondRows }, { id: 'secret', class_id: 'private', entries: [row()] }] as StartVersion[];
  const results = [{ id: 'r', class_id: 'a', entries: resultRows, columns: [] }];
  return riderDirectory(events, classes, starts.map(v => ({ class_id: v.class_id, version_id: v.id, revision: '' })), starts, [{ class_id: 'a', version_id: 'r', revision: '' }], results as any);
}
test('Empty search, accents, surname, homonyms, different horse, club changes and draft isolation', () => {
  const groups = directory([row(), row('Centauro', 'Martina Fernández', 2)], [row()], [{ ...row(), club: 'Club B' }]);
  assert.equal(searchRiders(groups, '').length, 0);
  assert.equal(searchRiders(groups, 'FERNANDEZ martina').length, 2);
  assert.equal(groups.find(g => g.horses.includes('Relámpago'))?.records.length, 3);
  assert.deepEqual(groups.find(g => g.horses.includes('Relámpago'))?.clubs, ['Club A', 'Club B']);
  assert.equal(groups.flatMap(g => g.records).some(r => r.classId === 'private'), false);
});
test('Missing horse remains separate; never attach results by name alone', () => {
  const groups = directory([row(''), row('', 'Martína Fernández', 2)], [row('')]);
  assert.equal(groups.length, 3);
  assert.ok(groups.every(g => riderParticipations(g).every(p => !(p.start && p.result))));
});
test('Exact class and binomial join, historical result without start, categories and ambiguous duplicates', () => {
  assert.equal(riderParticipations(directory()[0]).filter(p => p.start && p.result).length, 1);
  assert.equal(riderParticipations(directory([], [row()])[0])[0].start, undefined);
  const ambiguous = directory([row()], [{ ...row(), category: 'A' }, { ...row(), position: 2, category: 'B' }]);
  assert.equal(riderParticipations(ambiguous[0]).length, 3);
  assert.equal(riderParticipations(ambiguous[0]).filter(p => p.start && p.result).length, 0);
  const conflict = directory([{ ...row(), category: 'A' }], [{ ...row(), category: 'B' }]);
  assert.equal(riderParticipations(conflict[0]).length, 2);
  const crossClass = directory([], [row()], [row()]);
  assert.equal(riderParticipations(crossClass[0]).length, 2);
});
test('Manual identity overrides can split rows without changing source and do not imply performance matches', () => {
  const starts = [{ id: 's', class_id: 'a', entries: [row()] }] as StartVersion[];
  const results = [{ id: 'r', class_id: 'a', entries: [row('Other')], columns: [] }] as any;
  const build = (associations: any[]) => riderDirectory(events, classes, [{ class_id: 'a', version_id: 's', revision: '' }], starts, [{ class_id: 'a', version_id: 'r', revision: '' }], results, associations);
  const merged = build([{ source: 'start:s:1', identity: 'person' }, { source: 'result:r:1', identity: 'person' }]);
  assert.equal(merged.length, 1); assert.equal(riderParticipations(merged[0]).length, 2);
  assert.equal(build([{ source: 'start:s:1', identity: 'person' }]).length, 2);
  assert.equal(starts[0].entries[0].horse, 'Relámpago');
});

test('Admin suggests matching full names with different horses, ranks shared club first, and never merges', () => {
  const groups = directory([row(), row('Centauro', 'MARTINA FERNANDEZ', 2), { ...row('Dama', 'Martina Fernandez', 3), club: 'Club C' }], []);
  const suggestions = suggestRiderAssociations(groups);
  assert.equal(suggestions.length, 3);
  assert.ok(suggestions[0].reasons.includes('Club coincidente'));
  assert.ok(suggestions.every(s => s.reasons.includes('Mismo nombre completo')));
  assert.equal(groups.length, 3);
  assert.equal(searchRiders(groups, 'Martina').length, 3);
});

test('Suggestions handle a small spelling difference but reject first-name or surname-only matches', () => {
  const groups = directory([row(), row('Centauro', 'Martina Fernande', 2), row('Dama', 'Martina Lopez', 3), row('Sol', 'Ana Fernandez', 4), row('Luna', 'Martina', 5)], []);
  const suggestions = suggestRiderAssociations(groups);
  assert.equal(suggestions.length, 1);
  assert.ok(suggestions[0].reasons.includes('Nombre completo con una diferencia de escritura'));
});

test('Confirmed identities are not suggested against each other; adding another horse preserves all existing rows', () => {
  const groups = directory([row(), row('Centauro', 'Martina Fernandez', 2), row('Sol', 'Martina Fernandez', 3)], []);
  groups[0].id = 'manual:one'; groups[1].id = 'manual:two';
  const suggestions = suggestRiderAssociations(groups);
  assert.equal(suggestions.length, 2);
  assert.ok(suggestions.every(s => s.candidates.some(c => c.id.startsWith('pair:'))));
  assert.equal(suggestRiderAssociations([groups[0]]).length, 0);
});
