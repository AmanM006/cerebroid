import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { Evidence, MarkerName } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

const SHOWN=3

/** "Why": the few inputs that moved this call most, each marked as pushing for or against it. */
export function EvidenceView({
  studyId,
  marker,
  known,
}: {
  studyId: string
  marker: MarkerName
  known: Partial<Record<MarkerName, 0 | 1>>
}) {
  // Each result remembers which request it answers, so a stale answer never shows for a newer one.
  const [result, setResult]=useState<{ key: string; evidence: Evidence | null; error: unknown } | null>(null)
  const key=JSON.stringify([studyId, marker, known])

  useEffect(()=>{
    let cancelled=false
    api.getEvidence(studyId, marker, known)
      .then((evidence)=>!cancelled && setResult({ key, evidence, error: null }))
      .catch((error)=>!cancelled && setResult({ key, evidence: null, error }))
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, marker, known])

  if (result?.key!==key) return <p className="font-mono text-[10.5px] text-[#716c87]">Loading…</p>
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const evidence=result.evidence
  if (!evidence) return null
  const top=evidence.items.slice(0, SHOWN)

  if (top.length===0) {
    return <p className="font-mono text-[10.5px] text-[#716c87]">Nothing stands out: this tumor looks typical of the training cases.</p>
  }
  const agreement=evidence.explanation_agreement
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <p className="text-[10px] uppercase tracking-wider text-[#615c75]">Main reasons</p>
      <ul className="space-y-1">
        {top.map((item)=>(
          <li key={item.evidence_id} className="flex items-center gap-2"
            title={`Moves the probability by ${(item.weight*100).toFixed(1)} points on average`
              +(item.agreement!=null ? `; ${Math.round(item.agreement*100)}% of models agree on the direction` : "")}>
            <span className={item.supports_call ? "text-emerald-300" : "text-rose-300"} aria-hidden="true">
              {item.supports_call ? "▲" : "▼"}
            </span>
            <span className="text-[#c9c5d8]">{item.label}</span>
            <span className="text-[10px] text-[#615c75]">{item.supports_call ? "supports" : "against"}</span>
          </li>
        ))}
      </ul>
      {agreement!=null && agreement<0.4 && (
        <p className="text-[10px] text-amber-200/80">The models rely on different inputs for this call.</p>
      )}
      <p className="text-[9.5px] text-[#615c75]" title={evidence.method}>
        Compared with a typical training patient · model sensitivity, not cause
      </p>
    </div>
  )
}
