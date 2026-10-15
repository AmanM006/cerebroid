import { useEffect, useState } from "react"
import { api } from "../api/client"
import { MARKER_LABELS, type Lime, type MarkerName, type TumorRegion } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { MIN_REGION_EFFECT, useExplainFocus } from "./ExplainFocus"


const REGION_WORDS: [RegExp, string][]=[
  [/enhancing/, "enhancing rim"], [/necrotic/, "dead core (necrosis)"], [/edema/, "swelling (edema)"],
]

/** Plain wording for an evidence group, e.g. "T1 contrast · edema" -> "How the swelling (edema) looks on T1 contrast". */
function plain(label: string): string {
  const [first="", second]=label.split(" · ")
  const region=(text: string | undefined)=>REGION_WORDS.find(([re])=>re.test(text ?? ""))?.[1] ?? text ?? ""
  if (first==="Shape and size") return `Shape and size of the ${region(second)}`
  if (second) return `How the ${region(second)} looks on ${first}`
  if (label.startsWith("Tumor composition")) return "Tumor make-up (how much is rim, core and swelling)"
  if (label.startsWith("Tumor parts")) return "Parts of the tumor that are absent (e.g. no enhancing rim)"
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

      <ol className="space-y-1.5">
        {[
          { id: "how-common", label: `Usual result for most patients (${lime.call})`,
            points: ((positive ? 1 : -1)*Number(lime.typical.value)+(positive ? 0 : 1))*100-50 },
          ...lime.factors.filter((f)=>f.supports_call).map((f)=>({
            id: f.evidence_id, label: plain(f.label), points: Math.abs(f.effect)*100,
          })),
        ].filter((f)=>f.points>=0.5).sort((x, y)=>y.points-x.points).slice(0, 4).map((f, i)=>(
          <li key={f.id} className="flex items-baseline justify-between gap-3 text-sm text-neutral-200">
            <span><span className="text-neutral-500">{i+1}.</span> {f.label}</span>
            <span className="shrink-0 text-[11px] text-neutral-500">+{f.points.toFixed(0)}</span>
          </li>
        ))}
      </ol>

      <p className="text-[11px] text-neutral-500" title={`${lime.method} Local fit R² ${lime.fidelity_r2.toFixed(2)}.`}>
        LIME · what pushes the model toward this result, strongest first
      </p>
    </div>
  )
}

