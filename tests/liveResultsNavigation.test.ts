import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventReference, resourceHash, resourceSuffix } from '../src/utils/navigation.ts';
test('provisional results have a stable contest URL', () => {
  const route={pathname:'/republica/live-results/abc',search:'',hash:''};
  assert.equal(eventReference(route),'republica');
  assert.equal(resourceHash(route),'#live-results/abc');
  assert.equal(resourceSuffix('#live-results/abc'),'/live-results/abc');
});
