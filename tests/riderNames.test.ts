import test from 'node:test';
import assert from 'node:assert/strict';
import { riderDirectory, riderParticipations, searchRiders } from '../src/utils/riders.ts';
import { eventReference, isAdminRoute } from '../src/utils/navigation.ts';

test('Chosen name and all prior variants remain searchable without duplicating performances', () => {
  const events = [{id:'e',status:'published'}] as any;
  const classes = [{id:'c',eventId:'e'}] as any;
  const row = {position:1,rider:'Ana Peres',horse:'Sol',club:'Club'};
  const starts = [{id:'s',class_id:'c',entries:[row]}] as any;
  const results = [{id:'r',class_id:'c',entries:[{...row,rider:'Ana Perez',category:'Otra'}],columns:[]}] as any;
  const head = (id: string) => [{class_id:'c',version_id:id,revision:''}];
  const aliases = ['start:s:1','result:r:1'].map(source => ({source,identity:'same',canonical_name:'Ana Pérez Corregida',name_variants:['Ana Anterior']}));
  const original = JSON.stringify([starts,results]);
  const directory=riderDirectory(events,classes,head('s'),starts,head('r'),results,aliases);
  assert.equal(directory.length,1);
  assert.equal(directory[0].canonicalName, 'Ana Pérez Corregida');
  for (const name of ['Ana Peres','Ana Perez','Ana Pérez Corregida','Ana Anterior']) assert.equal(searchRiders(directory,name).length,1);
  const participations=riderParticipations(directory[0]);
  assert.equal(participations.length,1);
  assert.ok(participations[0].start && participations[0].result);
  assert.equal(JSON.stringify([starts,results]),original);
  assert.equal(riderDirectory(events,classes,head('s'),starts,head('r'),results,[]).length,2);
});

test('Useful information is an independent public route; /admin and subroutes keep admin routing', () => {
  const route = (pathname: string) => ({pathname,search:'',hash:''});
  assert.equal(eventReference(route('/informacion-util')),null);
  assert.equal(eventReference(route('/informacion-util/')),null);
  for (const path of ['/admin','/admin/jinetes','/admin/informacion-util']) {
    assert.equal(isAdminRoute(route(path)),true);
    assert.equal(eventReference(route(path)),null);
  }
  assert.equal(isAdminRoute(route('/informacion-util')),false);
});
