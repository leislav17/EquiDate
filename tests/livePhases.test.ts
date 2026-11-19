import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTwoPhases } from '../src/utils/livePhases.ts';
test('identifies two-phase formats in class descriptions', () => {
  for (const description of ['2FE', '2 F', 'Dos fases', 'Doble faz', '2 fases especiales']) assert.equal(hasTwoPhases(description), true, description);
  for (const description of ['', 'Tabla A', 'Desempate', '1m']) assert.equal(hasTwoPhases(description), false, description);
});
