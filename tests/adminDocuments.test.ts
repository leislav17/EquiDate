import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAdminDocuments } from '../src/utils/adminDocuments.ts';
import type { CompetitionClass, DocumentItem } from '../src/types/equestrian.ts';
const classes = [
  { id:'one', eventId:'event', date:'2026-11-01', number:'1', name:'Iniciados' },
  { id:'two', eventId:'event', date:'2026-11-02', number:'2', name:'Mayores' },
  { id:'empty', eventId:'event', date:'2026-11-02', number:'3', name:'Vacía' },
  { id:'foreign', eventId:'other', date:'2026-11-02', number:'4', name:'Otro concurso' },
] as CompetitionClass[];
const docs = [
  { id:'general', eventId:'event', type:'PROGRAM', name:'Anteprograma', eventDate:null },
  { id:'pdf', eventId:'event', type:'START_LIST', name:'Orden de ingreso', classId:'one', eventDate:'2026-11-01' },
  { id:'both', eventId:'event', type:'RESULT', name:'Resultados', classId:'two', eventDate:'2026-11-02' },
  { id:'legacy', eventId:'event', type:'RESULT', name:'Histórico sin asignación', classId:null, eventDate:null },
  { id:'foreign', eventId:'other', type:'RESULT', name:'Fuera del concurso' },
] as DocumentItem[];
const start = [{class_id:'two',version_id:'v1',revision:'1'}, {class_id:'foreign',version_id:'v2',revision:'1'}];
const results = [{class_id:'one',version_id:null,revision:'2'}, {class_id:'two',version_id:'v3',revision:'1'}];
const filters = {search:'',type:'' as const,date:'',classId:''};
test('Document workspace preserves PDF-only, structured-only, both, and recoverable history, excluding empty/foreign classes', () => {
  const before = structuredClone({docs,classes,start,results});
  const data = filterAdminDocuments('event',docs,classes,start,results,filters);
  assert.deepEqual(data.files.map(d=>d.id),['general','pdf','both','legacy']);
  assert.deepEqual(data.structured,[{classId:'one',type:'RESULT',published:false},{classId:'two',type:'START_LIST',published:true},{classId:'two',type:'RESULT',published:true}]);
  assert.deepEqual({docs,classes,start,results},before);
});
test('Document filters intersect by stable class, type and day, without including general or unassigned documents', () => {
  const data = filterAdminDocuments('event',docs,classes,start,results,{...filters,type:'RESULT',date:'2026-11-02',classId:'two'});
  assert.deepEqual(data.files.map(d=>d.id),['both']);
  assert.deepEqual(data.structured,[{classId:'two',type:'RESULT',published:true}]);
  assert.equal(filterAdminDocuments('event',docs,classes,start,results,{...filters,date:'2026-11-01',classId:'two'}).structured.length,0);
});
test('Search finds names and class numbers with case/accent differences; reset retains historical unassigned records', () => {
  assert.deepEqual(filterAdminDocuments('event',docs,classes,start,results,{...filters,search:'HISTORICO'}).files.map(d=>d.id),['legacy']);
  assert.equal(filterAdminDocuments('event',docs,classes,start,results,{...filters,search:'MAYORES'}).structured.length,2);
  assert.equal(filterAdminDocuments('event',docs,classes,start,results,{...filters,search:'2026-11-02'}).files.length,1);
});
