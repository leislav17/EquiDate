import test from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeId, transmissionLabel, sortClasses, formatClassSchedule } from '../src/utils/schedule.ts';

test('YouTube accepts supported URLs and rejects other origins or malformed IDs', () => {
  const id = 'abcdefghijk';
  for (const url of [
    'https://youtube.com/watch?v=' + id + '&t=20',
    'https://www.youtube.com/live/' + id + '?si=abc',
    'https://youtu.be/' + id,
    'https://www.youtube-nocookie.com/embed/' + id,
    'https://m.youtube.com/shorts/' + id,
  ]) assert.equal(getYouTubeId(url), id);
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=' + id,
    'https://youtube.com@evil.test/watch?v=' + id, 'https://evil.test/' + id,
    'https://youtube.com/watch?v=bad', 'https://youtube.com/channel/abc/live',
    'https://youtu.be/' + id + '/bad', 'not a url',
  ]) assert.equal(getYouTubeId(url), null, url);
});

test('Transmission uses the jornada timezone and changes at local midnight', () => {
  const zone = 'America/Argentina/Buenos_Aires';
  assert.equal(transmissionLabel('2026-10-04', zone, new Date('2026-10-05T02:59:59Z')), 'VER EN VIVO');
  assert.equal(transmissionLabel('2026-10-04', zone, new Date('2026-10-05T03:00:00Z')), 'VER TRANSMISIÓN');
  assert.equal(transmissionLabel('2026-10-05', zone, new Date('2026-10-04T15:00:00Z')), 'VER PRÓXIMA TRANSMISIÓN');
});

test('Classes respect configured manual order, natural number/letter collation, and do not send untimed classes to the end', () => {
  // 1. Configured manual order is prioritized over time
  const manuallyOrdered = [
    { id: 'c3', time: '08:00', order: 3, number: '1' },
    { id: 'c1', time: '12:00', order: 1, number: '3' },
    { id: 'c2', time: '10:00', order: 2, number: '2' },
  ];
  assert.deepEqual(sortClasses(manuallyOrdered as any).map(c => c.id), ['c1', 'c2', 'c3']);

  // 2. Editing time does not alter established manual order
  const editedTime = [
    { id: 'c3', time: '07:30', order: 3, number: '1' }, // even with earlier time, stays 3rd because order = 3
    { id: 'c1', time: '12:00', order: 1, number: '3' },
    { id: 'c2', time: '10:00', order: 2, number: '2' },
  ];
  assert.deepEqual(sortClasses(editedTime as any).map(c => c.id), ['c1', 'c2', 'c3']);

  // 3. When order is equal, times help initial order, but classes without time maintain their position (NOT forced to end)
  const untimedClasses = [
    { id: 'first_no_time', time: '', order: 1, number: '1' },
    { id: 'second_timed', time: '09:00', order: 1, number: '2' },
    { id: 'third_no_time', time: '', order: 1, number: '3' },
    { id: 'fourth_timed', time: '11:00', order: 1, number: '4' },
  ];
  assert.deepEqual(sortClasses(untimedClasses as any).map(c => c.id), [
    'first_no_time',
    'second_timed',
    'third_no_time',
    'fourth_timed',
  ]);

  // 4. Classes can be identified with letters (A, B, C...) or numbers (1, 2, 10...)
  const letterClasses = [
    { id: 'class_b', time: '', order: 1, number: 'B' },
    { id: 'class_a', time: '', order: 1, number: 'A' },
    { id: 'class_c', time: '', order: 1, number: 'C' },
  ];
  assert.deepEqual(sortClasses(letterClasses as any).map(c => c.id), ['class_a', 'class_b', 'class_c']);

  const numericClasses = [
    { id: 'class_10', time: '', order: 1, number: '10' },
    { id: 'class_2', time: '', order: 1, number: '2' },
    { id: 'class_1', time: '', order: 1, number: '1' },
  ];
  assert.deepEqual(sortClasses(numericClasses as any).map(c => c.id), ['class_1', 'class_2', 'class_10']);
});

test('Class schedule public display: exact time, approximate time, continuous, and no text when empty', () => {
  // 1. Exact time: "09:00 hs"
  assert.equal(formatClassSchedule({ time: '09:00', isApproximate: false, isContinuous: false }), '09:00 hs');
  assert.equal(formatClassSchedule({ time: '09:00:00' }), '09:00 hs');

  // 2. Approximate time: "09:00 hs (aprox.)"
  assert.equal(formatClassSchedule({ time: '09:00', isApproximate: true }), '09:00 hs (aprox.)');
  assert.equal(formatClassSchedule({ time: '14:30', isApproximate: true, isContinuous: false }), '14:30 hs (aprox.)');

  // 3. Continuous: "Continuado" (without requiring time or even if time is present)
  assert.equal(formatClassSchedule({ isContinuous: true }), 'Continuado');
  assert.equal(formatClassSchedule({ time: '', isContinuous: true }), 'Continuado');
  assert.equal(formatClassSchedule({ time: '10:00', isContinuous: true }), 'Continuado');

  // 4. Without time or condition: no text (empty string, not "Horario a confirmar")
  assert.equal(formatClassSchedule({ time: '' }), '');
  assert.equal(formatClassSchedule({ time: null }), '');
  assert.equal(formatClassSchedule(undefined), '');
  assert.equal(formatClassSchedule({}), '');
  assert.equal(formatClassSchedule({ time: '', isApproximate: true }), '');
});

