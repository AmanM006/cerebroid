import { useEffect, useState } from "react"
import { api } from "../api/client"
import { MARKER_LABELS, type Lime, type MarkerName, type TumorRegion } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { MIN_REGION_EFFECT, useExplainFocus } from "./ExplainFocus"

const SHOWN=6

const REGION_SHORT: [RegExp, string][]=[[/enhancing/, "rim"], [/necrotic/, "core"], [/edema/, "swelling"]]

/** Short chart label for an evidence group, e.g. "T1 contrast · edema" -> "Swelling · T1c". */
function short(label: string): string {
  const [first="", second]=label.split(" · ")
  const region=(text: string | undefined)=>REGION_SHORT.find(([re])=>re.test(text ?? ""))?.[1] ?? text ?? ""
  if (first==="Shape and size") return `Shape · ${region(second)}`
  if (second) return `${region(second).replace(/^./, (c)=>c.toUpperCase())} · ${first.replace("T1 contrast", "T1c")}`
  if (label.startsWith("Tumor composition")) return "Composition"
  if (label.startsWith("Tumor parts")) return "Missing parts"
  return label
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

      <Contributions
        call={lime.call}
        steps={top.slice(0, 5).map((f)=>({ id: f.evidence_id, label: short(f.label), full: f.label,
          delta: (f.supports_call ? 1 : -1)*Math.abs(f.effect)*100 }))}
      />

      <p className="text-[11px] text-neutral-500" title={`${lime.method} Local fit R² ${lime.fidelity_r2.toFixed(2)}.`}>
        LIME · how much each factor pushed this prediction, in % points
      </p>
    </div>
  )
}

/** The top factors behind this prediction and how much each pushed it, toward or against the call. */
function Contributions({ call, steps }: {
  call: string
  steps: { id: string; label: string; full: string; delta: number }[]
}) {
  const rows=steps.filter((s)=>Math.abs(s.delta)>=0.05)
  if (rows.length===0) {
    return <p className="text-[11px] text-neutral-400">No single factor moves this prediction noticeably.</p>
  }
  // A full half-bar is at least 10 points, so a 2-point push looks small.
  const scale=Math.max(10, ...rows.map((r)=>Math.abs(r.delta)))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
        <span className="w-28 shrink-0" />
        <span className="flex flex-1 justify-between"><span>◀ against {call}</span><span>toward {call} ▶</span></span>
        <span className="w-10 shrink-0" />
      </div>
      {rows.map((r)=>{
        const half=Math.max(1, Math.abs(r.delta)/scale*50)
        const up=r.delta>0
        return (
          <div key={r.id} className="flex items-center gap-2"
            title={`${r.full}: ${up ? "+" : "−"}${Math.abs(r.delta).toFixed(1)} points ${up ? "toward" : "against"} ${call}`}>
            <span className="w-28 shrink-0 truncate text-[11px] text-neutral-300">{r.label}</span>
            <div className="relative h-2.5 flex-1">
              <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-700" aria-hidden="true" />
              <div className={`absolute top-0 h-2.5 rounded-sm ${up ? "bg-emerald-500" : "bg-rose-500"}`}
                style={up ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-[11px] text-neutral-300">
              {up ? "+" : "−"}{Math.abs(r.delta).toFixed(1)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
