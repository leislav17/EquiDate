import test from 'node:test';
import assert from 'node:assert/strict';
import { documentAssociation, documentLabel } from '../src/utils/documents.ts';
import type { CompetitionClass } from '../src/types/equestrian.ts';

const entry: CompetitionClass = {
  id: 'class-a', dayId: 'day-a', eventId: 'event-a', arenaId: 'arena-a',
  date: '2026-10-05', time: '08:00', number: '54', name: 'Libre 1.30', description: '', order: 1,
};

test('List and result labels follow their class without manual document names', () => {
  assert.equal(documentLabel({ type: 'START_LIST', classId: entry.id }, [entry]), 'Listado · Prueba 54 · Libre 1.30');
  assert.equal(documentLabel({ type: 'RESULT', classId: entry.id }, [{ ...entry, name: 'Libre 1.40' }]), 'Resultados · Prueba 54 · Libre 1.40');
  assert.equal(documentLabel({ type: 'PROGRAM' }, [entry]), 'Anteprograma');
});

test('Program is general; lists and results require a class from the same contest', () => {
  assert.deepEqual(documentAssociation('PROGRAM', entry.id, entry.eventId, [entry]), { classId: null, eventDate: null });
  assert.deepEqual(documentAssociation('RESULT', entry.id, entry.eventId, [entry]), { classId: entry.id, eventDate: entry.date });
  assert.throws(() => documentAssociation('START_LIST', null, entry.eventId, [entry]));
  assert.throws(() => documentAssociation('RESULT', entry.id, 'other-event', [entry]));
  assert.equal(documentLabel({ type: 'RESULT', classId: null }, [entry]), 'Resultados · Pendiente de asignar');
});
