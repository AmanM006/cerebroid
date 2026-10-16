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
  if (!step) return null
  const others=plan.tests.filter((t)=>t.marker!==step?.marker)
  const tone=step.kind==="confirm"
    ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-100"
    : step.kind==="review" ? "border-amber-900/60 bg-amber-950/20 text-amber-100"
    : "border-cyan-900/60 bg-cyan-950/20 text-cyan-100"

  return (
    <div className="space-y-5 font-mono">
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">Still possible</p>
        <div className="flex flex-wrap gap-2">
          {plan.candidate_categories.length===0 ? (
            <span className="text-sm font-semibold text-amber-200">None of the WHO 2021 types fits these calls together.</span>
          ) : plan.candidate_categories.map((c)=>(
            <span key={c} className="rounded-xl border border-neutral-700 bg-[#161618] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">{c}</span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">Most useful next step</p>
        <div className={`rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
          <p className="text-lg font-black text-white tracking-tight">{step.title}</p>
          <p className="mt-1 text-sm font-medium text-neutral-200 leading-relaxed">{step.reason}</p>
          {step.test && <p className="mt-2 text-xs text-neutral-300 font-mono font-bold bg-black/40 px-2 py-1 rounded border border-white/10">{step.test}</p>}
        </div>
      </div>

      {others.length>0 && (
        <div className="space-y-2">
          <button onClick={()=>setShowAll((v)=>!v)} aria-expanded={showAll}
            className="text-xs font-bold text-neutral-200 hover:text-white transition-colors cursor-pointer">
            {showAll ? "▾ Hide tissue tests" : `▸ ${others.length} tissue test${others.length>1 ? "s" : ""} for confirmation`}
          </button>
          {showAll && (
            <ul className="space-y-2.5 pl-1">
              {others.map((t)=>(
                <li key={t.marker} className="rounded-lg border border-neutral-800 bg-[#111113] p-2.5 text-xs text-neutral-200">
                  <span className="text-white font-bold">{t.marker}</span> · <span className="text-neutral-300">{t.test}</span>
                  <span className="block text-xs text-neutral-400 mt-1 leading-normal">{t.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plan.pathways && plan.pathways.length>0 && (
        <div className="space-y-3 border-t border-neutral-800 pt-3.5">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Typical treatment pathway{plan.pathways.length>1 ? " for each possible type" : ""}
          </p>
          {plan.pathway_basis?.length>0 && (
            <ul className="space-y-1 text-xs text-neutral-300">
              {plan.pathway_basis.map((line)=><li key={line}>· {line}</li>)}
            </ul>
          )}
          {plan.pathways.map((p, i)=>(
            <details key={p.category} open={i===0} className="rounded-xl border border-neutral-800 bg-[#0f0f12] px-4 py-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-bold text-white hover:text-cyan-300 transition-colors">{p.category}</summary>
              <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs text-neutral-200 leading-relaxed">
                {p.steps.map((s)=><li key={s}>{s}</li>)}
              </ol>
              <p className="mt-2 text-xs font-semibold text-amber-200">{p.mgmt_note}</p>
              {p.grade_note && <p className="text-xs font-semibold text-cyan-200">{p.grade_note}</p>}
            </details>
          ))}
          <p className="text-xs text-neutral-400" title={plan.pathway_sources?.join(" · ")}>
            {plan.pathway_label} Sources: EANO 2021 guideline; FDA 2024 vorasidenib label.
          </p>
        </div>
      )}
      <p className="text-xs text-neutral-400">Decision-support heuristic, not clinical guidance.</p>
    </div>
  )
}
