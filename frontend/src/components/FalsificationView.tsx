import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { Claim, Falsification, MarkerName } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

const SHOWN=2

/** One short line per claim; the full templated sentence and its evidence IDs are in the tooltip. */
function ClaimList({ title, claims, tone }: { title: string; claims: Claim[]; tone: string }) {
  if (claims.length===0) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`text-[10px] uppercase tracking-wider ${tone}`}>{title}</span>
      {claims.slice(0, SHOWN).map((c, i)=>(
        <span key={c.evidence_ids.join(",")} className="text-[#c9c5d8]" title={`${c.text}
Evidence: ${c.evidence_ids.join(", ")}`}>
          {c.short}{i<Math.min(claims.length, SHOWN)-1 ? "," : ""}
        </span>
      ))}
    </div>
  )
}

/** The case for and against a call, the competing call, and what would overturn it. */
export function FalsificationView({
  studyId,
  marker,
  known,
}: {
  studyId: string
  marker: MarkerName
  known: Partial<Record<MarkerName, 0 | 1>>
}) {
  const [result, setResult]=useState<{ key: string; panel: Falsification | null; error: unknown } | null>(null)
  const key=JSON.stringify([studyId, marker, known])

  useEffect(()=>{
    let cancelled=false
    api.getFalsification(studyId, marker, known)
      .then((panel)=>!cancelled && setResult({ key, panel, error: null }))
      .catch((error)=>!cancelled && setResult({ key, panel: null, error }))
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, marker, known])

  if (result?.key!==key) return <p className="font-mono text-[10.5px] text-[#716c87]">Building the case for and against…</p>
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const panel=result.panel
  if (!panel) return null

  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <ClaimList title="For" claims={panel.supporting} tone="text-emerald-300" />
      <ClaimList title="Against" claims={panel.contradicting} tone="text-rose-300" />
      <ClaimList title="Alternative" claims={[panel.competing]} tone="text-amber-300" />
      <p className="text-[10.5px] text-[#8c889e]">Settled by: <span className="text-[#c9c5d8]">{panel.confirmatory_test}</span></p>
    </div>
  )
}
