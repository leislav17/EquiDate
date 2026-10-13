import test from 'node:test';
import assert from 'node:assert/strict';
import { documentAssociation, documentLabel, isGeneralDocumentType } from '../src/utils/documents.ts';
import type { CompetitionClass } from '../src/types/equestrian.ts';

const entry: CompetitionClass = {
  id: 'class-a', dayId: 'day-a', eventId: 'event-a', arenaId: 'arena-a',
  date: '2026-10-05', time: '08:00', number: '54', name: 'Libre 1.30', description: '', order: 1,
};

test('List and result labels follow their class without manual document names', () => {
  assert.equal(documentLabel({ type: 'START_LIST', classId: entry.id }, [entry]), 'Listado · Prueba 54 · Libre 1.30');
  assert.equal(documentLabel({ type: 'RESULT', classId: entry.id }, [{ ...entry, name: 'Libre 1.40' }]), 'Resultados · Prueba 54 · Libre 1.40');
  assert.equal(documentLabel({ type: 'PROGRAM' }, [entry]), 'Anteprograma');
  assert.equal(documentLabel({ type: 'REGULATION' }, [entry]), 'Reglamento');
  assert.equal(documentLabel({ type: 'OTHER', name: 'Información para participantes' }, [entry]), 'Información para participantes');
  assert.equal(documentLabel({ type: 'OTHER', name: '  Estabulación y Boxes  ' }, [entry]), 'Estabulación y Boxes');
});

test('Program, regulation, and other are general; lists and results require a class from the same contest', () => {
  assert.deepEqual(documentAssociation('PROGRAM', entry.id, entry.eventId, [entry]), { classId: null, eventDate: null });
  assert.deepEqual(documentAssociation('REGULATION', entry.id, entry.eventId, [entry]), { classId: null, eventDate: null });
  assert.deepEqual(documentAssociation('OTHER', entry.id, entry.eventId, [entry]), { classId: null, eventDate: null });
  assert.deepEqual(documentAssociation('RESULT', entry.id, entry.eventId, [entry]), { classId: entry.id, eventDate: entry.date });
  assert.throws(() => documentAssociation('START_LIST', null, entry.eventId, [entry]));
  assert.throws(() => documentAssociation('RESULT', entry.id, 'other-event', [entry]));
  assert.equal(documentLabel({ type: 'RESULT', classId: null }, [entry]), 'Resultados · Pendiente de asignar');
});

test('General document rule correctly classifies PROGRAM, REGULATION, and OTHER', () => {
  assert.equal(isGeneralDocumentType('PROGRAM'), true);
  assert.equal(isGeneralDocumentType('REGULATION'), true);
  assert.equal(isGeneralDocumentType('OTHER'), true);
  assert.equal(isGeneralDocumentType('START_LIST'), false);
  assert.equal(isGeneralDocumentType('RESULT'), false);
});

test('Public contest filtering: contest without general documents, with only Anteprograma, and with multiple general documents', () => {
  const contestDocs = [
    { id: '1', eventId: 'ev1', type: 'PROGRAM' as const, name: 'Anteprograma', classId: null, eventDate: null },
    { id: '2', eventId: 'ev1', type: 'REGULATION' as const, name: 'Reglamento', classId: null, eventDate: null },
    { id: '3', eventId: 'ev1', type: 'OTHER' as const, name: 'Información para participantes', classId: null, eventDate: null },
    { id: '4', eventId: 'ev1', type: 'OTHER' as const, name: 'Estabulación y Boxes', classId: null, eventDate: null },
    { id: '5', eventId: 'ev1', type: 'START_LIST' as const, name: 'Listado · Prueba 1', classId: 'c1', eventDate: '2026-10-04' },
  ];

  // Scenario 1: Contest with no general documents (e.g. only start lists)
  const evNone = contestDocs.filter(d => d.eventId === 'ev-empty');
  assert.equal(evNone.filter(d => d.type === 'PROGRAM').length, 0);
  assert.equal(evNone.filter(d => d.type === 'REGULATION').length, 0);
  assert.equal(evNone.filter(d => d.type === 'OTHER').length, 0);

  // Scenario 2: Contest with only Anteprograma
  const evOnlyProgram = [contestDocs[0], contestDocs[4]];
  const programs = evOnlyProgram.filter(d => d.type === 'PROGRAM');
  const regulations = evOnlyProgram.filter(d => d.type === 'REGULATION');
  const others = evOnlyProgram.filter(d => d.type === 'OTHER');
  assert.equal(programs.length, 1);
  assert.equal(programs[0].name, 'Anteprograma');
  assert.equal(regulations.length, 0);
  assert.equal(others.length, 0);

  // Scenario 3: Contest with multiple general documents
  const evMultiple = contestDocs;
  const multiPrograms = evMultiple.filter(d => d.type === 'PROGRAM');
  const multiRegulations = evMultiple.filter(d => d.type === 'REGULATION');
  const multiOthers = evMultiple.filter(d => d.type === 'OTHER');
  assert.equal(multiPrograms.length, 1);
  assert.equal(multiRegulations.length, 1);
  assert.equal(multiOthers.length, 2);
  assert.equal(multiOthers[0].name, 'Información para participantes');
  assert.equal(multiOthers[1].name, 'Estabulación y Boxes');
});
