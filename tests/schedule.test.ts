import test from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeId, transmissionLabel, sortClasses } from '../src/utils/schedule.ts';

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

test('Classes sort by time, then order and number, keeping unknown times last', () => {
  const entries = [
    { id: 'late', time: '12:15', order: 1, number: '5' },
    { id: 'unknown', time: '', order: 0, number: '1' },
    { id: 'early', time: '08:00', order: 2, number: '3' },
    { id: 'first', time: '08:00', order: 1, number: '2' },
  ];
  assert.deepEqual(sortClasses(entries as any).map(entry => entry.id), ['first', 'early', 'late', 'unknown']);
  assert.equal(entries[0].id, 'late');
});
