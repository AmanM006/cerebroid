import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { Doubt, DoubtLevel, MarkerName } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { ProvenanceBadge } from "./ProvenanceBadge"

const SOURCE_LABELS: Record<string, string>={
  multiplicity: "Models disagree",
  ambiguity: "Close to the boundary",
  data_sparsity: "Unlike training cases",
  missing_inputs: "Missing inputs",
  model_skill: "Weak imaging signal",
}

// Icon + word + colour, so the level never depends on colour alone.
const LEVEL_STYLE: Record<DoubtLevel, { icon: string; tone: string }>={
  high: { icon: "▲", tone: "text-rose-300" },
  medium: { icon: "◆", tone: "text-amber-300" },
  low: { icon: "●", tone: "text-emerald-300" },
  unknown: { icon: "?", tone: "text-[#716c87]" },
}

/** Why this marker's call is uncertain, by source, and what to do about the strongest one. */
export function DoubtView({
  studyId,
  marker,
  known,
}: {
  studyId: string
  marker: MarkerName
  known: Partial<Record<MarkerName, 0 | 1>>
}) {
  const [result, setResult]=useState<{ key: string; doubt: Doubt | null; error: unknown } | null>(null)
  const key=JSON.stringify([studyId, marker, known])

  useEffect(()=>{
    let cancelled=false
    api.getDoubt(studyId, marker, known)
      .then((doubt)=>!cancelled && setResult({ key, doubt, error: null }))
      .catch((error)=>!cancelled && setResult({ key, doubt: null, error }))
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, marker, known])

  if (result?.key!==key) return <p className="font-mono text-[10.5px] text-[#716c87]">Checking sources of doubt…</p>
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const doubt=result.doubt
  if (!doubt) return null

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-2 py-1 font-mono text-[10.5px] text-cyan-100">
        → {doubt.recommended_action}
      </p>
      <ul className="space-y-1">
        {doubt.components.map((c)=>{
          const style=LEVEL_STYLE[c.level]
          return (
            <li key={c.source} className="font-mono text-[10.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#c9c5d8]">{SOURCE_LABELS[c.source] ?? c.source}</span>
                <span className={`flex items-center gap-1.5 ${style.tone}`}>
                  <span aria-hidden="true">{style.icon}</span>
                  {c.level}
                  <ProvenanceBadge provenance={c.provenance} />
                </span>
              </div>
              <p className="text-[9.5px] text-[#615c75]">{c.detail}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
