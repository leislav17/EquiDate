/** Keep the original position as identity; live order is a separate sequence. */
export function orderLiveEntries<T extends {position:number}>(entries:T[], order?:number[]|null):T[] {
  const index = new Map((order || []).map((position,i)=>[position,i]));
  return [...entries].sort((a,b)=>(index.get(a.position) ?? Number.MAX_SAFE_INTEGER)-(index.get(b.position) ?? Number.MAX_SAFE_INTEGER) || a.position-b.position);
}

export function moveLivePosition(order:number[], from:number, to:number):number[] {
  const source=order.indexOf(from), target=order.indexOf(to);
  if(source<0 || target<0 || source===target)return order;
  const result=[...order]; result.splice(source,1); result.splice(target,0,from); return result;
}
