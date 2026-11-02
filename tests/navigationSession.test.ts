import test from 'node:test';
import assert from 'node:assert/strict';
import { NAVIGATION_STORAGE_KEY, NAVIGATION_TTL, readNavigationEntry, writeNavigationEntry, sessionDataScope, type NavigationStorage } from '../src/utils/navigationSession.ts';
import { persistNavigationScroll, type ScrollEnvironment } from '../src/utils/navigationScroll.ts';
import { BEFORE_NAVIGATION_EVENT } from '../src/utils/navigation.ts';
const storage = () => { const data=new Map<string,string>(); return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}}; };

test('Reload preserves stable day IDs, important info and per-view scroll without mixing contests', () => {
  const s=storage();
  writeNavigationEntry('event:A',{open:['day-sunday'],info:true},s,100);
  writeNavigationEntry('view:A:#results/class5',{scroll:640},s,100);
  assert.deepEqual(readNavigationEntry('event:A',s,101)?.open,['day-sunday']);
  assert.equal(readNavigationEntry('event:A',s,101)?.info,true);
  assert.equal(readNavigationEntry('view:A:#results/class5',s,101)?.scroll,640);
  assert.equal(readNavigationEntry('event:B',s,101),undefined);
  assert.equal(readNavigationEntry('view:A:overview',s,101),undefined);
  // Stable IDs still select the right day after data reorder; deleted IDs never open another day.
  const valid=['day-monday','day-sunday'];
  assert.deepEqual(readNavigationEntry('event:A',s,101)?.open?.filter(id=>valid.includes(id)),['day-sunday']);
  assert.deepEqual(readNavigationEntry('event:A',s,101)?.open?.filter(id=>['other-day'].includes(id)),[]);
});
test('Expiry, malformed/blocked storage and bounded records degrade to normal navigation', () => {
  const s=storage();writeNavigationEntry('event:A',{open:['day']},s,100);
  assert.equal(readNavigationEntry('event:A',s,100+NAVIGATION_TTL),undefined);
  s.setItem(NAVIGATION_STORAGE_KEY,'malformed');assert.equal(readNavigationEntry('event:A',s),undefined);
  const blocked:NavigationStorage={getItem(){throw Error('disabled');},setItem(){throw Error('quota');}};
  assert.doesNotThrow(()=>writeNavigationEntry('event:A',{scroll:20},blocked));
  assert.equal(readNavigationEntry('event:A',blocked),undefined);
  for(let i=0;i<40;i++)writeNavigationEntry('view:'+i,{scroll:i},s,100+i);
  assert.equal(Object.keys(JSON.parse(s.getItem(NAVIGATION_STORAGE_KEY)!)).length,30);
  s.setItem(NAVIGATION_STORAGE_KEY,JSON.stringify({x:{at:100,scroll:-20,open:['day',4],token:'secret',query:'Name'}}));
  assert.deepEqual(readNavigationEntry('x',s,101),{at:100,open:['day']});
});
test('Same-user refocus and token renewal keep the data scope; identity and admin changes invalidate it', () => {
  const session={user:{id:'one',app_metadata:{equidate_admin:true}},access_token:'old'};
  const refreshed={...session,access_token:'refreshed'};
  assert.equal(sessionDataScope(session),sessionDataScope(refreshed));
  assert.notEqual(sessionDataScope(session),sessionDataScope({...session,user:{...session.user,id:'two'}}));
  assert.notEqual(sessionDataScope(session),sessionDataScope({...session,user:{...session.user,app_metadata:{equidate_admin:false}}}));
  assert.notEqual(sessionDataScope(session),sessionDataScope(null));
});
function harness(key='view:A:overview',target=600) {
  const s=storage();writeNavigationEntry(key,{scroll:target},s);
  const win=Object.assign(new EventTarget(),{scrollY:0,innerHeight:700,location:{pathname:'/a',hash:''},scrollTo:(options:ScrollToOptions)=>{win.scrollY=options.top||0;calls++;}});
  const doc=Object.assign(new EventTarget(),{documentElement:{scrollHeight:800},visibilityState:'visible'});
  let now=0,calls=0,restored=0,next=0;
  const frames=new Map<number,FrameRequestCallback>();
  const env={window:win,document:doc,storage:s,now:()=>now,requestFrame:(cb:FrameRequestCallback)=>{frames.set(++next,cb);return next;},cancelFrame:(id:number)=>{frames.delete(id);}} as unknown as ScrollEnvironment;
  const stop=persistNavigationScroll(key,'/a',true,()=>{restored++;},env);
  const frame=()=>{const all=[...frames.values()];frames.clear();for(const cb of all)cb(now);};
  return {s,win,doc,stop,frame,env,get calls(){return calls;},get restored(){return restored;},advance:(ms:number)=>{now+=ms;}};
}
test('Scroll restoration waits for rendered sections; returning from another app saves synchronously and restores once',()=>{
  const h=harness();h.frame();assert.equal(h.calls,0);
  h.doc.documentElement.scrollHeight=2500;h.frame();assert.equal(h.win.scrollY,600);assert.equal(h.restored,1);
  h.frame();assert.equal(h.calls,1);
  h.win.scrollY=900;h.doc.visibilityState='hidden';h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(readNavigationEntry('view:A:overview',h.s)?.scroll,900);
  h.doc.visibilityState='visible';h.doc.dispatchEvent(new Event('visibilitychange'));h.frame();assert.equal(h.win.scrollY,900);
  h.win.scrollY=1000;h.win.dispatchEvent(new Event('pagehide'));assert.equal(readNavigationEntry('view:A:overview',h.s)?.scroll,1000);
  h.stop();
});
test('A user gesture cancels delayed restoration; route changes save the departing view before scrolling to top',()=>{
  const h=harness();h.win.dispatchEvent(new Event('touchstart'));h.doc.documentElement.scrollHeight=2500;h.frame();assert.equal(h.calls,0);
  h.win.scrollY=350;h.win.dispatchEvent(new Event(BEFORE_NAVIGATION_EVENT));assert.equal(readNavigationEntry('view:A:overview',h.s)?.scroll,350);
  h.win.location.pathname='/b';h.win.scrollY=0;h.win.dispatchEvent(new Event('pagehide'));assert.equal(readNavigationEntry('view:A:overview',h.s)?.scroll,350);
  h.stop();
});
test('Shortened/removed content clamps scroll after a bounded wait; background updates do not restore again',()=>{
  const h=harness();h.frame();h.advance(2100);h.frame();assert.equal(h.win.scrollY,100);h.stop();
  h.win.scrollY=60;const stop=persistNavigationScroll('view:A:overview','/a',false,()=>assert.fail('unexpected restoration'),h.env);
  h.frame();assert.equal(h.win.scrollY,60);stop();
});
