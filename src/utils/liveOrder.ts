/** Keep the original position as identity; live order is a separate sequence. */
export function orderLiveEntries<T extends {position:number}>(entries:T[], order?:number[]|null):T[] {
  const index = new Map((order || []).map((position,i)=>[position,i]));
  return [...entries].sort((a,b)=>(index.get(a.position) ?? Number.MAX_SAFE_INTEGER)-(index.get(b.position) ?? Number.MAX_SAFE_INTEGER) || a.position-b.position);
}
