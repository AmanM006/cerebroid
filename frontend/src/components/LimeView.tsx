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
  const largest=Math.max(0, ...top.map((f)=>Math.abs(f.effect)))
  // Bars share a fixed scale (a full bar is 10 probability points), so small effects look small.
  const scale=Math.max(0.10, largest)
  const other=positive ? labels.negative : labels.positive
  const forCall=(p: number)=>Math.round((positive ? p : 1-p)*100)
  const typicalPct=forCall(Number(lime.typical.value))
  const patientPct=forCall(Number(lime.probability.value))
  const regionEffects=Object.fromEntries(
    lime.regions.map((r)=>[r.region, positive ? r.effect : -r.effect]),
  ) as Record<TumorRegion, number>
  const paintable=Object.values(regionEffects).some((e)=>Math.abs(e)>=MIN_REGION_EFFECT)
  const painted=focus?.marker===marker

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">Explainable AI · LIME</p>
        <button
          type="button"
          disabled={!paintable}
          aria-pressed={painted}
          onClick={()=>setFocus(painted ? null : { marker, call: lime.call, regions: regionEffects })}
          title={paintable ? "Colour the tumor regions in the MRI viewer by how they push this call"
            : "No tumor region moves this call noticeably"}
          className={`rounded-lg border px-3 py-1 text-xs font-bold transition-all cursor-pointer ${painted
            ? "border-amber-500 bg-amber-950/80 text-amber-200 shadow-sm"
            : "border-neutral-700 bg-[#141416] text-neutral-300 hover:text-white hover:border-neutral-600"} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {painted ? "Showing on MRI" : "Show on MRI"}
        </button>
      </div>

      <p className="text-xs text-neutral-200 leading-relaxed font-medium">
        A typical training patient: <span className="text-white font-bold">{typicalPct}% {lime.call}</span>
        {" → "}this patient: <span className="text-white font-bold">{patientPct}% {lime.call}</span>.
        {" "}
        {largest<0.01
          ? "No group of this patient's inputs moves it by even one point: the call mostly reflects what is typical in the training data, not this tumor."
          : "The bars show what moves this patient away from typical."}
      </p>

      {largest>=0.01 && (
        <ul className="space-y-2 pt-1">
          {top.map((f)=>{
            const supports=f.supports_call
            const width=`${Math.max(2, Math.round(Math.abs(f.effect)/scale*100))}%`
            return (
              <li key={f.evidence_id} className="space-y-1 rounded-lg border border-neutral-850 bg-[#121214] p-2"
                title={`${points(f.effect)} probability points toward ${labels.positive}`
                  +(f.agreement!=null ? `; ${Math.round(f.agreement*100)}% of models agree on the direction` : "")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-neutral-200 font-semibold">{f.label}</span>
                  <span className={`shrink-0 font-bold ${supports ? "text-emerald-400" : "text-rose-400"}`}>
                    {Math.abs(f.effect*100).toFixed(1)} pts toward {supports ? lime.call : other}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-800">
                  <div className={`h-2 rounded-full ${supports ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"}`} style={{ width }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-neutral-400 font-medium pt-1" title={lime.method}>
        Local fit R² {lime.fidelity_r2.toFixed(2)} across {lime.n_samples} variations
        {lime.explanation_agreement != null && <> · {Math.round(lime.explanation_agreement * 100)}% model agreement</>}
        {" "}· compared with a typical training patient · model sensitivity, not cause
      </p>
    </div>
  )
}
