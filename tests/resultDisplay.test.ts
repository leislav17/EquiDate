import test from 'node:test';
import assert from 'node:assert/strict';
import { resultColumnsForFormat, resultColumnsForPhases, type ResultEntry } from '../src/utils/results.ts';
import { resultDisplayColumns, resultDisplayValue } from '../src/utils/resultDisplay.ts';

const row = (values: Record<string,string>): ResultEntry => ({position:1,rider:'Ana',horse:'',values});
test('Detailed phases collapse to faults and time without changing source marks', () => {
  const source = resultColumnsForFormat('two_phases');
  const original = structuredClone(source);
  const cols = resultDisplayColumns(source);
  assert.equal(cols.length,5);
  const entry = row({round1_obstacle_faults:'4',round1_time_faults:'1',round1_faults:'5',round1_time:'71,20',round2_obstacle_faults:'0',round2_time_faults:'0',round2_faults:'0',round2_time:'31,45'});
  assert.deepEqual(cols.map(c=>resultDisplayValue(entry,c)),['(4+1)','71,20','(0+0)','31,45','5']);
  assert.deepEqual(source,original);
  assert.equal(entry.values?.round1_faults,'5');
  assert.equal(resultDisplayValue(row({...entry.values,total_faults:'9'}),cols[4]),'9');
});
test('Optimum difference stays visible with a single final total', () => {
  const cols = resultDisplayColumns(resultColumnsForFormat('optimum'));
  assert.deepEqual(cols.map(c=>c.label),['Faltas','Tiempo','Diferencia al óptimo','Total faltas de la prueba']);
  assert.deepEqual(cols.map(c=>resultDisplayValue(row({obstacle_faults:'4',time_faults:'1',faults:'5',time:'63,20',time_difference:'1,20'}),c)),['(4+1)','63,20','1,20','5']);
});
test('Final sum handles decimal commas and never fills missing or eliminated marks', () => {
  const cols = resultDisplayColumns(resultColumnsForPhases(2));
  const final = cols.at(-1)!;
  assert.equal(resultDisplayValue(row({phase1_faults:'0,1',phase2_faults:'0,2'}),final),'0,3');
  assert.equal(resultDisplayValue(row({phase1_faults:'4'}),final),'');
  assert.equal(resultDisplayValue(row({phase1_faults:'4',phase2_faults:'EL'}),final),'');
  const detailed = resultDisplayColumns(resultColumnsForFormat('jump_off'));
  assert.equal(resultDisplayValue(row({round1_obstacle_faults:'4',round2_obstacle_faults:'0',round2_time_faults:'0'}),detailed.at(-1)!), '');
});
