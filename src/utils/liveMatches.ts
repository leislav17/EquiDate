type Entry = { rider: string; horse?: string; position?: number | null };

function normalize(name?: string) {
  return (name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

// Consider all manual entries together so two marks cannot claim the same rider and horse.
export function matchLiveEntries(manual: Entry[], published: Entry[]) {
  const choices = manual.map(source => {
    const rider = normalize(source.rider);
    const horse = normalize(source.horse);
    return published.flatMap((target, index) => {
      const sameRider = !!rider && rider === normalize(target.rider);
      const sameHorse = !!horse && horse === normalize(target.horse);
      const sameOrder = source.position != null && source.position === target.position;
      if (!sameRider && !sameHorse && !sameOrder) return [];
      return [{index, exact: sameRider && sameHorse && (source.position == null || sameOrder),
        score: Number(sameRider) * 4 + Number(sameHorse) * 4 + Number(sameOrder)}];
    }).sort((a, b) => b.score - a.score);
  });
  const claims = new Map<number, number>();
  for (const options of choices) for (const option of options) {
    if (option.exact) claims.set(option.index, (claims.get(option.index) ?? 0) + 1);
  }
  return choices.map(options => {
    const exact = options.filter(option => option.exact);
    const automatic = exact.length === 1 && claims.get(exact[0].index) === 1;
    return {match: automatic ? exact[0].index : null, suggestions: options.map(option => option.index)};
  });
}

export type ManualEntry = {entry_label?:string|null;id:string;rider:string;horse:string;category:string;position:number|null;obstacle_faults:number|null;time_seconds:number|null;phase2_faults:number|null;phase2_seconds:number|null};
export function resolveManual(manual:ManualEntry[], entries:Entry[]) {
  const matches=matchLiveEntries(manual,entries);
  return manual.map((row,i)=>({...row,target:matches[i].match===null?null:entries[matches[i].match!].position,suggestions:matches[i].suggestions}));
}
