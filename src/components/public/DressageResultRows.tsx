import { ChevronDown } from 'lucide-react';
import { displayDressagePercentage, dressageFinalKey, isJudgeScoreColumn, type ResultColumn, type ResultEntry } from '../../utils/results';

const summaryGrid = 'grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_1rem] items-start gap-x-2 px-3';

function Binomial({ row }: { row: ResultEntry }) {
  return <span className="min-w-0 [overflow-wrap:anywhere]">
    <span className="block font-bold text-[#123E59]">{row.rider}</span>
    <span className="block text-neutral-700">{row.horse}</span>
    {(row.club || row.category) && <span className="mt-0.5 block text-xs text-neutral-500">
      {[row.club, row.category].filter(Boolean).join(' · ')}
    </span>}
  </span>;
}

function JudgeMark({ row, judge }: { row: ResultEntry; judge: ResultColumn }) {
  const score = displayDressagePercentage(row.values?.[judge.key]);
  const rank = row.values?.[judge.key + '_rank']?.trim();
  return <>
    {score || '—'}
    {rank && !/^[-–—]+$/.test(rank) && <span className="block text-xs font-normal text-neutral-500">Puesto {rank}</span>}
  </>;
}

export function DressageResultRows({ entries, columns }: { entries: ResultEntry[]; columns: ResultColumn[] }) {
  const judges = columns.filter(isJudgeScoreColumn);
  const final = (row: ResultEntry) => displayDressagePercentage(row.values?.[dressageFinalKey]) || '—';
  return <>
    <div className="overflow-hidden rounded-xl border border-neutral-200 md:hidden" aria-label="Resultados de adiestramiento">
      <div className={`${summaryGrid} bg-[#123E59] py-3 text-xs font-semibold text-white`}>
        <span>Puesto</span><span>Jinete / Caballo</span><span className="text-right">% final</span>
      </div>
      <div className="divide-y divide-neutral-200">
        {entries.map(row => {
          const available = judges.filter(judge => [row.values?.[judge.key], row.values?.[judge.key + '_rank']]
            .some(value => value?.trim() && !/^[-–—]+$/.test(value.trim())));
          const marks = <>
            <span className="tabular-nums text-neutral-600">{row.rank || '—'}</span>
            <Binomial row={row} />
            <span className="text-right font-bold tabular-nums text-[#123E59]">{final(row)}</span>
          </>;
          if (!available.length) return <div key={row.position} className={`${summaryGrid} py-3 text-sm`}>{marks}</div>;
          return <details key={row.position} className="group">
            <summary className={`${summaryGrid} min-h-11 cursor-pointer list-none py-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#123E59] [&::-webkit-details-marker]:hidden`}>
              {marks}
              <ChevronDown className="mt-0.5 size-4 text-[#123E59] group-open:rotate-180" aria-hidden="true" />
            </summary>
            <dl className="mx-3 mb-3 divide-y divide-neutral-200 rounded-lg bg-neutral-50 px-3 text-sm">
              {available.map(judge => <div key={judge.key} className="flex items-start justify-between gap-3 py-2">
                <dt className="text-neutral-700">{judge.label}</dt>
                <dd className="shrink-0 text-right font-semibold tabular-nums text-[#123E59]"><JudgeMark row={row} judge={judge} /></dd>
              </div>)}
            </dl>
          </details>;
        })}
      </div>
    </div>
    <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Puesto, binomio, porcentaje final y resultados por juez</caption>
        <thead className="bg-[#123E59] text-white"><tr>
          <th scope="col" className="px-3 py-3">Puesto</th>
          <th scope="col" className="min-w-40 px-3 py-3">Jinete / Caballo</th>
          <th scope="col" className="whitespace-nowrap px-3 py-3 text-right">% final</th>
          {judges.map(judge => <th key={judge.key} scope="col" className="min-w-20 px-3 py-3 text-right text-xs">{judge.label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-neutral-200">
          {entries.map(row => <tr key={row.position} className="align-top">
            <td className="px-3 py-3 tabular-nums text-neutral-600">{row.rank || '—'}</td>
            <td className="px-3 py-3"><Binomial row={row} /></td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-[#123E59]">{final(row)}</td>
            {judges.map(judge => <td key={judge.key} className="whitespace-nowrap px-3 py-3 text-right tabular-nums"><JudgeMark row={row} judge={judge} /></td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
  </>;
}
