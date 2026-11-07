import test from 'node:test';
import assert from 'node:assert/strict';
import type { CompetitionClass } from '../src/types/equestrian.ts';
import { eventDiscipline, listDiscipline } from '../src/utils/disciplines.ts';
import { eventReference, resolveEvent } from '../src/utils/navigation.ts';
import { reviewStartImport } from '../src/utils/startLists.ts';
import { resultColumnsForFormat, reviewResultImport } from '../src/utils/results.ts';
import { resultDisplayColumns, resultDisplayValue } from '../src/utils/resultDisplay.ts';

const route = (pathname: string, search = '') => ({ pathname, search, hash: '' });
const eventId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const classId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const versionId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const classes: CompetitionClass[] = [{
  id: classId, eventId, dayId: 'day', arenaId: 'arena', date: '2026-11-14',
  number: '1', time: '09:00', name: 'Preliminar', description: '', order: 1,
}];
const batchItem = {
  id: versionId, classId, eventId, date: '2026-11-14', arenaId: 'arena', number: '1',
  expectedRevision: null, sourceName: 'Planilla.pdf', reviewed: true, uncertainties: [],
};
const first = { position: 1, rider: 'Ana Ríos', horse: 'Lunero' };
const second = { position: 2, rider: 'Lucía Paz', horse: 'Olivo' };

test('Discipline landing pages are separate from event links and legacy events still belong to jumping', () => {
  const event = { id: eventId, slug: 'san-jorge', status: 'published' };
  assert.equal(eventDiscipline({}), 'jumping');
  assert.equal(eventDiscipline({ discipline: 'training' }), 'training');
  for (const [path, section] of [['/', 'jumping'], ['/jumping', 'jumping'], ['/dressage/', 'dressage'], ['/training', 'training']]) {
    assert.equal(listDiscipline(path), section);
    assert.equal(eventReference(route(path)), null);
  }
  assert.equal(resolveEvent(route('/san-jorge'), [event]), event);
  assert.equal(resolveEvent(route('/', '?event=' + eventId), [event]), event);
  assert.equal(eventReference(route('/san-jorge/results/' + classId)), 'san-jorge');
});

test('Timed start orders preserve position independently of scheduled time and accept missing time', () => {
  const items = [{ ...batchItem, entries: [{ ...second, scheduledTime: '09:15' }, { ...first, scheduledTime: '09:24' }] }];
  const [list] = reviewStartImport(items, classes, [], eventId);
  assert.deepEqual(list.entries.map(row => [row.position, row.scheduledTime]), [[1, '09:24'], [2, '09:15']]);
  const [untimed] = reviewStartImport([{ ...batchItem, entries: [first] }], classes, [], eventId);
  assert.equal(untimed.entries[0].scheduledTime, undefined);
  for (const scheduledTime of ['24:00', '09:60', 924, '9 pm']) {
    assert.throws(() => reviewStartImport([{ ...batchItem, entries: [{ ...first, scheduledTime }] }], classes, [], eventId), /Horario de binomio inválido/);
  }
});

test('Dressage results keep published ties and percentage precision without jumping metrics', () => {
  const columns = resultColumnsForFormat('dressage');
  const entries = [first, second].map(row => ({ ...row, rank: '1', category: 'Mayores', values: { total_percentage: '68,540' } }));
  const [results] = reviewResultImport([{ ...batchItem, columns, entries }], classes, [], eventId, 'dressage');
  const [column] = resultDisplayColumns(results.columns);
  assert.equal(column.label, 'Porcentaje total');
  assert.deepEqual(results.entries.map(row => row.rank), ['1', '1']);
  assert.equal(resultDisplayValue(results.entries[0], column), '68,540 %');
  assert.throws(() => reviewResultImport([{ ...batchItem, columns, entries: [{ ...entries[0], values: { total_percentage: '101' } }] }], classes, [], eventId, 'dressage'), /Porcentaje inválido/);
  assert.throws(() => reviewResultImport([{ ...batchItem, columns: resultColumnsForFormat('single'), entries: [] }], classes, [], eventId, 'dressage'), /total_percentage/);
});
