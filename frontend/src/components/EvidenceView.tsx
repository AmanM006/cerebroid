import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { Evidence, MarkerName } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { ProvenanceBadge } from "./ProvenanceBadge"

const SHOWN=6

/**
 * "Why this call?": the input groups that moved this marker's probability most,
 * whether each supports or contradicts the call, and whether the models agree.
 */
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

  if (result?.key!==key) {
    return <p className="font-mono text-[10.5px] text-[#716c87]">Measuring which inputs drove this call…</p>
  }
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const evidence=result.evidence
  if (!evidence) return null

  const top=evidence.items.slice(0, SHOWN)
  const largest=top[0]?.weight ?? 1
  const agreement=evidence.explanation_agreement

  return (
    <div className="space-y-2">
      {evidence.low_signal && (
        <p className="font-mono text-[10.5px] text-amber-200">
          These models carry almost no signal for this marker, so the effects below are small and not evidence.
        </p>
      )}
      {top.length===0 ? (
        <p className="font-mono text-[10.5px] text-[#716c87]">
          No input group moves this call: the patient looks typical of the training cohort.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((item)=>(
            <li key={item.evidence_id} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 font-mono text-[10.5px]">
                <span className="text-[#c9c5d8]">{item.label}</span>
                <span className={item.supports_call ? "text-emerald-300" : "text-rose-300"}>
                  {item.supports_call ? "▲ supports" : "▼ against"} · {(item.weight*100).toFixed(1)} pts
                </span>
              </div>
              <div className="h-1 w-full rounded bg-[#1e1b2b]" aria-hidden="true">
                <div
                  className={`h-1 rounded ${item.supports_call ? "bg-emerald-500/70" : "bg-rose-500/70"}`}
                  style={{ width: `${Math.max(4, (item.weight/largest)*100)}%` }}
                />
              </div>
              {item.agreement!=null && item.agreement<1 && (
                <p className="font-mono text-[9.5px] text-[#615c75]">
                  {Math.round(item.agreement*100)}% of models agree on this direction
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1 border-t border-[#1e1b2b] pt-1.5 font-mono text-[9.5px] text-[#615c75]">
        {agreement!=null && (
          <p>
            Models agree on why: {agreement>=0.7 ? "yes" : agreement>=0.4 ? "partly" : "no"} (rank correlation{" "}
            {agreement.toFixed(2)})
          </p>
        )}
        <p className="flex items-center gap-1.5">
          Compared with the {evidence.reference.value}
          <ProvenanceBadge provenance={evidence.reference.provenance} />
        </p>
        <p title={evidence.method}>Shows how sensitive the models are to each input, not what causes the tumor type.</p>
      </div>
    </div>
  )
}
