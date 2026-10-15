import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { MarkerName, NextMeasurements } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

/**
 * Which WHO CNS5 tumor categories are still possible, and the one lab test that
 * would narrow them most. A decision-support heuristic, labelled as such.
 */
export function NextStepPanel({
  studyId,
  known,
}: {
  studyId: string
  known: Partial<Record<MarkerName, 0 | 1>>
}) {
  const [result, setResult]=useState<{ key: string; plan: NextMeasurements | null; error: unknown } | null>(null)
  const [showAll, setShowAll]=useState(false)
  const key=JSON.stringify([studyId, known])

  useEffect(()=>{
    let cancelled=false
    api.getNextMeasurements(studyId, known)
      .then((plan)=>!cancelled && setResult({ key, plan, error: null }))
      .catch((error)=>!cancelled && setResult({ key, plan: null, error }))
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, known])

  if (result?.key!==key) return <p className="font-mono text-xs text-neutral-500">Working out the next step…</p>
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const plan=result.plan
  if (!plan) return null
  const step=plan.next_step
  const others=plan.tests.filter((t)=>t.marker!==step.marker)
  const tone=step.kind==="confirm"
    ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-100"
    : step.kind==="review" ? "border-amber-900/60 bg-amber-950/20 text-amber-100"
    : "border-cyan-900/60 bg-cyan-950/20 text-cyan-100"

  return (
    <div className="space-y-4 font-mono">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Still possible</p>
        <div className="flex flex-wrap gap-1.5">
          {plan.candidate_categories.length===0 ? (
            <span className="text-xs text-neutral-400">No category fits the settled markers: review the calls.</span>
          ) : plan.candidate_categories.map((c)=>(
            <span key={c} className="rounded-full border border-neutral-700 bg-[#121212] px-2.5 py-1 text-[11px] text-neutral-200">{c}</span>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Most useful next step</p>
        <div className={`rounded-xl border px-3 py-2 ${tone}`}>
          <p className="text-sm font-bold">{step.title}</p>
          <p className="text-[11px] opacity-80">{step.reason}</p>
          {step.test && <p className="mt-1 text-[10px] text-neutral-400">{step.test}</p>}
        </div>
      </div>

      {others.length>0 && (
        <div className="space-y-1">
          <button onClick={()=>setShowAll((v)=>!v)} aria-expanded={showAll}
            className="text-[10.5px] text-neutral-400 hover:text-white cursor-pointer">
            {showAll ? "▾ Hide tissue tests" : `▸ ${others.length} tissue test${others.length>1 ? "s" : ""} for confirmation`}
          </button>
          {showAll && (
            <ul className="space-y-1.5">
              {others.map((t)=>(
                <li key={t.marker} className="text-[10.5px] text-neutral-400">
                  <span className="text-neutral-200">{t.marker}</span> · {t.test}
                  <span className="block text-[10px] text-neutral-500">{t.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plan.pathways && plan.pathways.length>0 && (
        <div className="space-y-2 border-t border-neutral-800 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Typical treatment pathway{plan.pathways.length>1 ? " for each possible type" : ""}
          </p>
          {plan.pathway_basis?.length>0 && (
            <ul className="space-y-0.5 text-[10.5px] text-neutral-400">
              {plan.pathway_basis.map((line)=><li key={line}>· {line}</li>)}
            </ul>
          )}
          {plan.pathways.map((p, i)=>(
            <details key={p.category} open={i===0} className="rounded-xl border border-neutral-800 bg-[#101010] px-3 py-2">
              <summary className="cursor-pointer text-xs font-bold text-neutral-100">{p.category}</summary>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11px] text-neutral-300">
                {p.steps.map((s)=><li key={s}>{s}</li>)}
              </ol>
              <p className="mt-1.5 text-[10.5px] text-amber-200/90">{p.mgmt_note}</p>
              {p.grade_note && <p className="text-[10.5px] text-cyan-200/90">{p.grade_note}</p>}
            </details>
          ))}
          <p className="text-[9.5px] text-neutral-500" title={plan.pathway_sources?.join(" · ")}>
            {plan.pathway_label} Sources: EANO 2021 guideline; FDA 2024 vorasidenib label.
          </p>
        </div>
      )}
      <p className="text-[9.5px] text-neutral-600">Decision-support heuristic, not clinical guidance.</p>
    </div>
  )
}
