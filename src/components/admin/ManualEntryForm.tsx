import React,{useState} from 'react';
import {supabase} from '../../lib/supabase';
import type {ManualEntry} from '../../utils/liveMatches';
export function ManualEntryForm({eventId,classId,row,twoPhases,done}:{eventId:string;classId:string;row?:ManualEntry;twoPhases:boolean;done:()=>void}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={async e=>{
   e.preventDefault();const fields=new FormData(e.currentTarget);
   const number=(key:string)=>fields.get(key)?Number(fields.get(key)):null;
   const values={id:row?.id??crypto.randomUUID(),rider:fields.get('rider'),horse:fields.get('horse'),category:fields.get('category'),position:number('position'),obstacle_faults:number('obstacle_faults'),time_seconds:number('time_seconds'),phase2_faults:number('phase2_faults'),phase2_seconds:number('phase2_seconds')};
   setBusy(true);const result=await supabase.functions.invoke('external-assignments',{body:{action:'manual_save',eventId,classId,edit:!!row,row:values}});setBusy(false);
   if(result.error)setError('No se pudo guardar. Completá tiempo y faltas juntos.');else done();
 }}>
 {(['rider','horse','category','position','obstacle_faults','time_seconds',...(twoPhases?['phase2_faults','phase2_seconds']:[])] as (keyof ManualEntry)[]).map((key,i)=><label key={key} className="text-sm">{['Jinete','Caballo','Categoría','N.º de ingreso','Faltas','Tiempo','Faltas fase 2','Tiempo fase 2'][i]}<input name={key} defaultValue={row?.[key]??''} required={i<2} type={i<3?'text':'number'} min={i===3?1:0} step={key.includes('seconds')?0.01:1} className="block border rounded p-2 w-36"/></label>)}
 <button disabled={busy} className="rounded bg-[#123E59] text-white px-4 py-2">Guardar binomio</button>{error&&<p role="alert">{error}</p>}</form>;
}
