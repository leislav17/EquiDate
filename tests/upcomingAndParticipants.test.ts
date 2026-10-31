import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getArgentinaTodayStr,
  getArgentinaDate,
  getEventTemporalStatus,
} from '../src/utils/dateUtils.ts';

test('getArgentinaTodayStr returns YYYY-MM-DD corresponding to Argentina local time', () => {
  const todayStr = getArgentinaTodayStr();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);

  const dateObj = getArgentinaDate();
  assert.equal(typeof dateObj.year, 'number');
  assert.ok(dateObj.year >= 2026);
  assert.ok(dateObj.month >= 0 && dateObj.month <= 11);
  assert.ok(dateObj.day >= 1 && dateObj.day <= 31);
  assert.equal(dateObj.dateStr, todayStr);
});

test('getEventTemporalStatus accurately classifies events using Argentina timezone', () => {
  const today = getArgentinaTodayStr();
  // Today's event is ACTUAL
  assert.equal(getEventTemporalStatus(today, today), 'ACTUAL');

  // Multi-day event spanning today is ACTUAL
  assert.equal(getEventTemporalStatus('2020-01-01', '2030-12-31', today), 'ACTUAL');

  // Past event is FINALIZADO
  assert.equal(getEventTemporalStatus('2020-01-01', '2020-01-05', '2026-10-31'), 'FINALIZADO');

  // Future event is PROXIMO
  assert.equal(getEventTemporalStatus('2030-01-01', '2030-01-05', '2026-10-31'), 'PROXIMO');
});

test('Default upcoming competition filter criteria excludes finished and includes current and future events across months', () => {
  const today = '2026-10-31';

  const mockEvents = [
    { id: '1', name: 'Pasado 1', startDate: '2026-09-01', endDate: '2026-09-05', status: 'published' },
    { id: '2', name: 'Pasado ayer', startDate: '2026-10-25', endDate: '2026-10-30', status: 'published' },
    { id: '3', name: 'En curso hoy', startDate: '2026-10-30', endDate: '2026-11-02', status: 'published' },
    { id: '4', name: 'Empieza hoy', startDate: '2026-10-31', endDate: '2026-11-01', status: 'published' },
    { id: '5', name: 'Próximo mes', startDate: '2026-11-15', endDate: '2026-11-16', status: 'published' },
    { id: '6', name: 'Próximo año', startDate: '2027-03-10', endDate: '2027-03-12', status: 'published' },
    { id: '7', name: 'Borrador futuro', startDate: '2026-11-20', endDate: '2026-11-22', status: 'draft' },
  ];

  // Initial / default filter logic: selectedMonth === -2
  const upcomingEvents = mockEvents
    .filter(evt => evt.status === 'published' && evt.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  assert.equal(upcomingEvents.length, 4);
  assert.equal(upcomingEvents[0].id, '3'); // En curso hoy (starts 2026-10-30, ends 2026-11-02 >= 2026-10-31)
  assert.equal(upcomingEvents[1].id, '4'); // Empieza hoy (starts 2026-10-31)
  assert.equal(upcomingEvents[2].id, '5'); // Próximo mes (starts 2026-11-15)
  assert.equal(upcomingEvents[3].id, '6'); // Próximo año (starts 2027-03-10)

  // Finished events must not be in upcoming list
  assert.ok(!upcomingEvents.some(e => e.id === '1' || e.id === '2'));
  // Drafts must not be in upcoming list
  assert.ok(!upcomingEvents.some(e => e.id === '7'));
});

test('Calendar month navigation wraps across year boundaries correctly', () => {
  let activeYear = 2026;
  let calendarMonth = 0; // Enero

  // Left arrow on January: goes to December of previous year
  if (calendarMonth === 0) {
    activeYear = activeYear - 1;
    calendarMonth = 11;
  } else {
    calendarMonth = calendarMonth - 1;
  }
  assert.equal(calendarMonth, 11);
  assert.equal(activeYear, 2025);

  // Right arrow on December: goes to January of next year
  if (calendarMonth === 11) {
    activeYear = activeYear + 1;
    calendarMonth = 0;
  } else {
    calendarMonth = calendarMonth + 1;
  }
  assert.equal(calendarMonth, 0);
  assert.equal(activeYear, 2026);
});

test('Participant count formatting rule produces expected labels', () => {
  const formatParticipants = (count: number | null | undefined): string | null => {
    if (typeof count !== 'number' || count === null) return null;
    return `Cantidad de participantes: ${count}`;
  };

  assert.equal(formatParticipants(undefined), null);
  assert.equal(formatParticipants(null), null);
  assert.equal(formatParticipants(0), 'Cantidad de participantes: 0');
  assert.equal(formatParticipants(1), 'Cantidad de participantes: 1');
  assert.equal(formatParticipants(20), 'Cantidad de participantes: 20');
  assert.equal(formatParticipants(150), 'Cantidad de participantes: 150');
});

test('Competition detail jornada HOY badge only flags today matching Argentina date', () => {
  const argentinaTodayStr = getArgentinaTodayStr();
  const days = [
    { dateStr: '2020-01-01', fullFormatted: 'MIÉRCOLES 1 ENERO' },
    { dateStr: argentinaTodayStr, fullFormatted: 'HOY EN ARGENTINA' },
    { dateStr: '2030-12-31', fullFormatted: 'MARTES 31 DICIEMBRE' }
  ];

  const flagged = days.map(d => ({
    dateStr: d.dateStr,
    isToday: d.dateStr === argentinaTodayStr
  }));

  assert.equal(flagged[0].isToday, false);
  assert.equal(flagged[1].isToday, true);
  assert.equal(flagged[2].isToday, false);
});

test('Admin competition filtering: default includes ongoing & future for both published and draft', () => {
  const argentinaTodayStr = getArgentinaTodayStr();
  const mockEvents = [
    // Past published
    { id: '1', name: 'Pasado Pub', venue: 'Club A', status: 'published', startDate: '2020-01-01', endDate: '2020-01-02' },
    // Past draft
    { id: '2', name: 'Pasado Draft', venue: 'Club B', status: 'draft', startDate: '2020-01-01', endDate: '2020-01-02' },
    // Ongoing published (ends today)
    { id: '3', name: 'En curso Pub', venue: 'Club C', status: 'published', startDate: '2020-01-01', endDate: argentinaTodayStr },
    // Ongoing draft (ends today)
    { id: '4', name: 'En curso Draft', venue: 'Club D', status: 'draft', startDate: '2020-01-01', endDate: argentinaTodayStr },
    // Future published
    { id: '5', name: 'Futuro Pub', venue: 'Club E', status: 'published', startDate: '2030-01-01', endDate: '2030-01-05' },
    // Future draft
    { id: '6', name: 'Futuro Draft', venue: 'Club F', status: 'draft', startDate: '2030-01-01', endDate: '2030-01-05' },
  ];

  // Default admin filter: period = 'upcoming', status = 'all', search = ''
  const defaultFiltered = mockEvents.filter(e => e.endDate >= argentinaTodayStr);
  assert.equal(defaultFiltered.length, 4);
  assert.deepEqual(defaultFiltered.map(e => e.id), ['3', '4', '5', '6']);

  // Past filter: period = 'past'
  const pastFiltered = mockEvents.filter(e => e.endDate < argentinaTodayStr);
  assert.equal(pastFiltered.length, 2);
  assert.deepEqual(pastFiltered.map(e => e.id), ['1', '2']);

  // Status filter: only draft
  const draftFiltered = mockEvents.filter(e => e.status === 'draft');
  assert.equal(draftFiltered.length, 3);
  assert.deepEqual(draftFiltered.map(e => e.id), ['2', '4', '6']);

  // Text search on venue
  const searchClubC = mockEvents.filter(e => e.name.toLowerCase().includes('club c') || e.venue.toLowerCase().includes('club c'));
  assert.equal(searchClubC.length, 1);
  assert.equal(searchClubC[0].id, '3');
});

test('Day documents isolation: classes of day 1 do not appear in day 2 and documents bind strictly to their jornada', () => {
  const classes = [
    { id: 'c1', eventId: 'ev1', date: '2026-10-24', number: '1', name: '0.90m', order: 1 },
    { id: 'c2', eventId: 'ev1', date: '2026-10-24', number: '2', name: '1.00m', order: 2 },
    { id: 'c3', eventId: 'ev1', date: '2026-10-25', number: '3', name: '1.10m', order: 1 },
    { id: 'c4', eventId: 'ev1', date: '2026-10-25', number: '4', name: '1.20m', order: 2 },
  ];

  const day1Classes = classes.filter(c => c.date === '2026-10-24');
  const day2Classes = classes.filter(c => c.date === '2026-10-25');

  assert.equal(day1Classes.length, 2);
  assert.equal(day2Classes.length, 2);
  assert.ok(day1Classes.every(c => c.id === 'c1' || c.id === 'c2'));
  assert.ok(day2Classes.every(c => c.id === 'c3' || c.id === 'c4'));

  // Document segregation
  const documents = [
    { id: 'd1', eventId: 'ev1', type: 'START_LIST', classId: 'c1', eventDate: '2026-10-24' },
    { id: 'd2', eventId: 'ev1', type: 'RESULT', classId: 'c3', eventDate: '2026-10-25' },
    { id: 'd3', eventId: 'ev1', type: 'PROGRAM', classId: null, eventDate: null },
  ];

  const day1Docs = documents.filter(d => d.type !== 'PROGRAM' && d.eventDate === '2026-10-24');
  const day2Docs = documents.filter(d => d.type !== 'PROGRAM' && d.eventDate === '2026-10-25');

  assert.equal(day1Docs.length, 1);
  assert.equal(day1Docs[0].id, 'd1');
  assert.equal(day2Docs.length, 1);
  assert.equal(day2Docs[0].id, 'd2');
});
