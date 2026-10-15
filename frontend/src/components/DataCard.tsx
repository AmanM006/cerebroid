import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { ModelCard, SubgroupMetrics } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

const MARKERS=["IDH", "GRADE"] as const
const NAMES: Record<string, string>={ IDH: "IDH", GRADE: "WHO grade" }

function cell(m: SubgroupMetrics | undefined) {
  if (!m) return <span className="text-neutral-600">-</span>
  const acc=m.accuracy!=null ? `${Math.round(m.accuracy*100)}%` : "-"
  return (
    <span>
      <span className="text-white">{acc}</span>
      <span className="text-neutral-500"> · n={m.n}</span>
      {m.auc!=null && <span className="text-neutral-500"> · AUC {m.auc.toFixed(2)}</span>}
    </span>
  )
}

function GroupTable({ title, data, group }: { title: string; data: ModelCard["subgroups"]; group: string }) {
  if (!data) return null
  const groups=Object.keys(data.markers.IDH?.[`by_${group}`] ?? {})
  if (groups.length===0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1 pr-3 font-normal">{title}</th>
            {MARKERS.map((m)=><th key={m} className="py-1 pr-3 font-normal">{NAMES[m]} accuracy</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((g)=>(
            <tr key={g} className="border-t border-neutral-800">
              <td className="py-1 pr-3 capitalize text-neutral-300">{g}</td>
              {MARKERS.map((m)=><td key={m} className="py-1 pr-3">{cell(data.markers[m]?.[`by_${group}`]?.[g])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Who the models were trained on, and how they perform per group, including by race on an external cohort. */
export function DataCard() {
  const [card, setCard]=useState<ModelCard | null>(null)
  const [error, setError]=useState<unknown>(null)

  useEffect(()=>{
    api.modelCard().then(setCard).catch(setError)
  }, [])

  if (error) return <ErrorNotice error={error} />
  if (!card) return <p className="font-mono text-xs text-neutral-500">Loading…</p>
  const pop=card.training_population
  const external=card.external_validation

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-4 font-mono">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Trained on</p>
        <p className="text-xs text-neutral-200">
          {pop.patients} patients · {pop.site} · {pop.male} male / {pop.female} female · median age {pop.age_median}
          {" "}({pop.age_range?.[0]}–{pop.age_range?.[1]}) · {Math.round((pop.grade_4_share ?? 0)*100)}% grade 4
        </p>
        <p className="text-[11px] text-amber-200/90">Race: {pop.race}.</p>
      </div>

      {card.subgroups && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Held-out UCSF patients ({card.subgroups.patients}) by group
          </p>
          <GroupTable title="Sex" data={card.subgroups} group="sex" />
          <GroupTable title="Age" data={card.subgroups} group="age_band" />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
          External check: TCGA, many US hospitals, by race
        </p>
        {external ? (
          <>
            <p className="text-[11px] text-neutral-400">
              {external.cohort} · {external.patients} patients · models applied unchanged
            </p>
            <GroupTable title="Race" data={external} group="race" />
          </>
        ) : (
          <p className="text-[11px] text-neutral-500">Not yet computed.</p>
        )}
      </div>
    </div>
  )
}
