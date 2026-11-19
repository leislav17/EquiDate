import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveLivePosition, orderLiveEntries } from '../src/utils/liveOrder.ts';
test('drag moves a binomial to any other position while preserving identity',()=>{
  const original=[1,2,3,4];
  assert.deepEqual(moveLivePosition(original,1,4),[2,3,4,1]);
  assert.deepEqual(moveLivePosition(original,4,1),[4,1,2,3]);
  assert.deepEqual(original,[1,2,3,4]);
  assert.deepEqual(moveLivePosition(original,2,2),original);
  assert.deepEqual(orderLiveEntries([{position:1},{position:2},{position:3}], [3,1,2]).map(x=>x.position),[3,1,2]);
});
