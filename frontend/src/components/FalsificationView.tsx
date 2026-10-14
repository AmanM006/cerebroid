import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { Claim, Falsification, MarkerName } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

function ClaimList({ title, claims, tone, empty }: { title: string; claims: Claim[]; tone: string; empty: string }) {
  return (
    <div className="space-y-1">
      <p className={`font-mono text-[10px] font-bold uppercase tracking-wider ${tone}`}>{title}</p>
      {claims.length===0 ? (
        <p className="font-mono text-[10px] text-[#615c75]">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {claims.map((c)=>(
            <li key={c.evidence_ids.join(",")} className="font-mono text-[10.5px] text-[#c9c5d8]"
              title={`Evidence: ${c.evidence_ids.join(", ")}`}>
              • {c.text}
            </li>
          ))}
        </ul>
      )}
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
    <div className="space-y-2.5">
      <ClaimList title={`For ${panel.call}`} claims={panel.supporting} tone="text-emerald-300"
        empty="No input group pushes toward this call." />
      <ClaimList title="Against" claims={panel.contradicting} tone="text-rose-300"
        empty="No input group pushes against this call." />
      <ClaimList title="Competing call" claims={[panel.competing]} tone="text-amber-300" empty="" />
      <ClaimList title="What would overturn it" claims={panel.overturn} tone="text-cyan-300"
        empty="No plausible change to age or the tumor measurements flips this call." />
      <p className="rounded-lg border border-[#2a2638] bg-[#14121d] px-2 py-1 font-mono text-[10.5px] text-[#c9c5d8]">
        Settled by: {panel.confirmatory_test}
      </p>
    </div>
  )
}
