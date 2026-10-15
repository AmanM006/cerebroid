import { useEffect, useState } from "react"
import { api } from "../api/client"
import { MARKER_LABELS, type Lime, type MarkerName, type TumorRegion } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { MIN_REGION_EFFECT, useExplainFocus } from "./ExplainFocus"

const SHOWN=6

/** Percentage points of probability, signed: "+12.3" means toward the positive class. */
function points(effect: number) {
  return `${effect>0 ? "+" : "−"}${Math.abs(effect*100).toFixed(1)}`
}

/**
 * Explainable AI: a LIME local explanation of one marker's call. Each bar is how much this patient's
 * own values in one group of inputs (versus a typical training patient) move the probability, as
 * fitted by LIME across every model in the near-optimal set. "Show on MRI" paints the per-region
 * totals onto the tumor in the viewer.
 */
export function LimeView({
  studyId,
  marker,
  known,
}: {
  studyId: string
  marker: MarkerName
  known: Partial<Record<MarkerName, 0 | 1>>
}) {
  const [result, setResult]=useState<{ key: string; lime: Lime | null; error: unknown } | null>(null)
  const { focus, setFocus }=useExplainFocus()
  const key=JSON.stringify([studyId, marker, known])

  useEffect(()=>{
    let cancelled=false
    api.getLime(studyId, marker, known)
      .then((lime)=>!cancelled && setResult({ key, lime, error: null }))
      .catch((error)=>!cancelled && setResult({ key, lime: null, error }))
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, marker, known])

  // The painted map belongs to this marker's current result; drop it when that result goes away.
  useEffect(()=>()=>setFocus(null), [key, setFocus])

  if (result?.key!==key) return <p className="font-mono text-[10.5px] text-[#716c87]">Running LIME…</p>
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const lime=result.lime
  if (!lime) return null

  const labels=MARKER_LABELS[marker]
  const positive=lime.call===labels.positive
  const top=lime.factors.slice(0, SHOWN)
  const largest=Math.max(0.01, ...top.map((f)=>Math.abs(f.effect)))
  const regionEffects=Object.fromEntries(
    lime.regions.map((r)=>[r.region, positive ? r.effect : -r.effect]),
  ) as Record<TumorRegion, number>
  const paintable=Object.values(regionEffects).some((e)=>Math.abs(e)>=MIN_REGION_EFFECT)
  const painted=focus?.marker===marker

  return (
    <div className="space-y-2 font-mono text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-[#8c889e]">Explainable AI · LIME</p>
        <button
          type="button"
          disabled={!paintable}
          aria-pressed={painted}
          onClick={()=>setFocus(painted ? null : { marker, call: lime.call, regions: regionEffects })}
          title={paintable ? "Colour the tumor regions in the MRI viewer by how they push this call"
            : "No tumor region moves this call noticeably"}
          className={`rounded-md border px-2 py-0.5 text-[10px] ${painted
            ? "border-amber-600 bg-amber-950/50 text-amber-200"
            : "border-[#2a2638] text-[#8c889e] hover:text-white"} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {painted ? "Showing on MRI" : "Show on MRI"}
        </button>
      </div>

      {top.length===0 || largest<=0.01 ? (
        <p className="text-[10.5px] text-[#c9c5d8]">
          A very confident call: no single group of inputs moves it by more than one percentage point.
        </p>
      ) : (
        <ul className="space-y-1">
          {top.map((f)=>{
            const supports=f.supports_call
            const width=`${Math.max(4, Math.round(Math.abs(f.effect)/largest*100))}%`
            return (
              <li key={f.evidence_id} className="space-y-0.5"
                title={`${points(f.effect)} probability points toward ${labels.positive}`
                  +(f.agreement!=null ? `; ${Math.round(f.agreement*100)}% of models agree on the direction` : "")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#c9c5d8]">{f.label}</span>
                  <span className={supports ? "text-emerald-300" : "text-rose-300"}>
                    {supports ? "supports" : "against"} {lime.call}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded bg-[#1b1826]">
                  <div className={`h-1.5 rounded ${supports ? "bg-emerald-500/80" : "bg-rose-500/80"}`} style={{ width }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-[9.5px] text-[#615c75]" title={lime.method}>
        Local fit R² {lime.fidelity_r2.toFixed(2)} across {lime.n_samples} variations
        {lime.explanation_agreement!=null && ` · models agree on the ranking ${Math.round(Math.max(0, lime.explanation_agreement)*100)}%`}
        {" "}· compared with a typical training patient · model sensitivity, not cause
      </p>
    </div>
  )
}
