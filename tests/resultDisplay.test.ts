import test from 'node:test';
import assert from 'node:assert/strict';
import { resultColumnsForFormat, resultColumnsForPhases, type ResultEntry } from '../src/utils/results.ts';
import { resultDisplayColumns, resultDisplayValue } from '../src/utils/resultDisplay.ts';

const row = (values: Record<string,string>): ResultEntry => ({position:1,rider:'Ana',horse:'',values});
test('Every template accepts undivided faults without inventing components', () => {
  for (const format of ['single','optimum','two_phases','jump_off','two_rounds'] as const) {
    const source = resultColumnsForFormat(format, false);
    assert.ok(!source.some(c => /(?:obstacle|time)_faults$/.test(c.key)));
    const values = Object.fromEntries(source.map(c => [c.key, c.key.endsWith('faults') ? '5' : '62,10']));
    const cols = resultDisplayColumns(source);
    assert.equal(resultDisplayValue(row(values),cols[0]),'5');
    assert.ok(cols.every(c => !resultDisplayValue(row(values),c).includes('+')));
    assert.equal(cols.filter(c=>c.label === 'Faltas').length, format === 'single' || format === 'optimum' ? 1 : 2);
  }
  const detailed = resultDisplayColumns(resultColumnsForFormat('single'));
  assert.equal(resultDisplayValue(row({faults:'5'}),detailed[0]),'5');
  assert.equal(resultDisplayValue(row({faults:'0'}),detailed[0]),'0');
});
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
