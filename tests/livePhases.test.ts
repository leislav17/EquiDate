import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTwoPhases, isDoubleRound, isJumpOff } from '../src/utils/livePhases.ts';
test('identifies two-phase formats in class descriptions', () => {
  for (const description of ['2FE', '2 F', 'Dos fases', 'Doble faz', '2 fases especiales']) assert.equal(hasTwoPhases(description), true, description);
  for (const description of ['', 'Tabla A', 'Desempate', '1m']) assert.equal(hasTwoPhases(description), false, description);
});

test('recognizes existing double rounds',()=>{
  for(const s of ['Doble Recorrido','1.10m DR','Doble   recorrido']) assert.equal(isDoubleRound(null,s,''),true);
  for(const s of ['Doble faz','Dressage','Predr']) assert.equal(isDoubleRound(null,s,''),false);
  assert.equal(isDoubleRound('double_round','',''),true);
});

test('recognizes a single jump-off without confusing other formats',()=>{
  for(const s of ['1 desempate','1 D','1D','Un desempate','Prueba 1.20m - 1 D']) assert.equal(isJumpOff(null,s,''),true,s);
  assert.equal(isJumpOff(null,'Altura','1 Desempate'),true);
  for(const s of ['2 desempates','Doble recorrido','Dressage','1 dia']) assert.equal(isJumpOff(null,s,''),false,s);
  assert.equal(isJumpOff('double_round','1 D',''),false);
});
