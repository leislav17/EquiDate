import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLiveEntryLabel,liveInsertionIndex} from '../src/utils/liveEntryPosition.ts';

test('validates entry labels and finds their live position', () => {
  assert.equal(parseLiveEntryLabel('a'), 'A');
  assert.equal(parseLiveEntryLabel('3 bis'), '3 bis');
  assert.equal(parseLiveEntryLabel(''), null);
  for (const invalid of ['AA', '3bis', '0', '-1']) assert.throws(() => parseLiveEntryLabel(invalid));
  const labels = ['A', 'C', '1', '2', '3', '4'];
  assert.equal(liveInsertionIndex(labels, 3, 'B'), 1);
  assert.equal(liveInsertionIndex(labels, 3, '3 bis'), 5);
  assert.equal(liveInsertionIndex(labels, 3, null), 4);
  assert.equal(liveInsertionIndex(labels, null, null), labels.length);
});
