import { useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { api } from "../api/client"
import { MARKER_LABELS, type Case, type MarkerName, type MarkerProfile, type NextMeasurements, type Profile } from "../api/types"
import { ErrorNotice } from "../components/ErrorNotice"

/**
 * One-page tumor board briefing for a case, printable or savable as PDF. Every value comes from the
 * same /profile and /next-measurements responses the workspace shows; the footer carries the model
 * versions and input hash so the printed page can be traced back to the exact computation.
 */

const MARKER_NAMES: Record<MarkerName, string>={ IDH: "IDH", "1p19q": "1p/19q co-deletion", MGMT: "MGMT promoter", GRADE: "WHO grade" }
const VERDICT_NAMES: Record<string, string>={ STABLE: "Stable", CONTESTED: "Contested", ARBITRARY: "Arbitrary" }

function parseKnown(raw: string | null): Partial<Record<MarkerName, 0 | 1>> {
  const known: Partial<Record<MarkerName, 0 | 1>>={}
  for (const part of (raw ?? "").split(",")) {
    const [marker="", value=""]=part.split(":")
    if (["IDH", "1p19q", "MGMT", "GRADE"].includes(marker) && (value==="0" || value==="1")) {
      known[marker as MarkerName]=value==="1" ? 1 : 0
    }
  }
  return known
}

function percent(p: number | null | undefined): string {
  return p==null ? "—" : `${Math.round(p*100)}%`
}

/** How likely the call itself is, with the model range, as on the marker cards ("93% likely intact"). */
function likelihood(m: MarkerProfile): string {
  const positive=m.call===MARKER_LABELS[m.marker].positive
  const flip=(p: number | null | undefined)=>(p==null ? null : positive ? p : 1-p)
  const [lo, hi]=positive ? [flip(m.prob_min), flip(m.prob_max)] : [flip(m.prob_max), flip(m.prob_min)]
  return `${percent(flip(m.prob_median))} likely ${m.call} (models ${percent(lo)}–${percent(hi)}, ${m.n_models} models)`
}

/** What the card would say about this marker, in words a printed page can carry. */
function flags(m: MarkerProfile): string[] {
  const out: string[]=[]
  if (m.out_of_distribution) out.push("Unlike training scans: do not rely on the AI, refer for expert review")
  if (m.close_call) out.push("Close call: probability near the decision boundary")
  if (m.verdict && m.verdict!=="STABLE" && !m.low_signal) out.push("Confirm with tissue")
  if (m.marker==="GRADE" && m.call==="grade 2-3" && m.alert_threshold!=null && (m.prob_median ?? 0)>=m.alert_threshold) {
    out.push(`Grade 4 not ruled out (P(grade 4) ${percent(m.prob_median)}, alert level ${percent(m.alert_threshold)})`)
  }
  if (m.resolved_by_combining) out.push("Decided by MRI + age and sex (MRI alone was not stable)")
  return out
}

export function BriefingPage() {
  const { caseId }=useParams()
  const [params]=useSearchParams()
  const known=useMemo(()=>parseKnown(params.get("known")), [params])
  const [data, setData]=useState<{ c: Case; profile: Profile; plan: NextMeasurements } | null>(null)
  const [error, setError]=useState<unknown>(null)
  const [generatedAt]=useState(()=>new Date())

  useEffect(()=>{
    if (!caseId) return
    let cancelled=false
    Promise.all([api.getCase(caseId), api.getProfile(caseId, known), api.getNextMeasurements(caseId, known)])
      .then(([c, profile, plan])=>!cancelled && setData({ c, profile, plan }))
      .catch((e)=>!cancelled && setError(e))
    return ()=>{
      cancelled=true
    }
  }, [caseId, known])

  if (error) return <div className="p-8"><ErrorNotice error={error} /></div>
  if (!data) return <p className="p-8 font-mono text-sm text-neutral-500">Preparing the briefing…</p>
  const { c, profile, plan }=data
  const knownMarkers=profile.inputs.known_markers

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 12mm; } @media print { body { background: white; } }"}</style>

      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <Link to={`/cases/${c.id}`} className="font-mono text-sm text-neutral-700 hover:text-black">← Back to case</Link>
        <button type="button" onClick={()=>window.print()}
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
          Print or save as PDF
        </button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-10 py-8 text-[12px] leading-snug text-black shadow-lg print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">Cerebroid · pre-operative molecular estimate</p>
            <h1 className="mt-1 text-xl font-extrabold">Tumor board briefing</h1>
          </div>
          <div className="text-right text-[10.5px] text-neutral-700">
            <p>Generated {generatedAt.toLocaleString()}</p>
            <p className="font-semibold text-black">Decision support, not a diagnosis.</p>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-4 gap-3 text-[11.5px]">
          <div><p className="text-neutral-500">Case</p><p className="font-semibold">{c.label}</p></div>
          <div><p className="text-neutral-500">Age · sex</p><p className="font-semibold">{c.age.value ?? "—"} · {c.sex.value ?? "—"}</p></div>
          <div><p className="text-neutral-500">Inputs</p><p className="font-semibold">MRI (T1, T1c, T2, FLAIR, tumor outline), age, sex</p></div>
          <div>
            <p className="text-neutral-500">Lab results entered</p>
            <p className="font-semibold">
              {knownMarkers.length===0 ? "None" : knownMarkers.map((k)=>`${MARKER_NAMES[k.marker]}: ${k.value.value}`).join("; ")}
            </p>
          </div>
        </section>
        {profile.missing_inputs.length>0 && (
          <p className="mt-2 text-[11px] text-neutral-700">Not available in this scan: {profile.missing_inputs.join(", ")}</p>
        )}

        <section className="mt-4">
          <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider">Molecular estimate from MRI</h2>
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 pr-2">Marker</th><th className="py-1 pr-2">Estimate</th><th className="py-1 pr-2">Verdict</th>
                <th className="py-1 pr-2">How likely</th><th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {profile.markers.map((m)=>{
                const name=MARKER_NAMES[m.marker]
                if (m.status==="known") {
                  return <tr key={m.marker} className="border-b border-neutral-300 align-top">
                    <td className="py-1.5 pr-2 font-semibold">{name}</td><td className="py-1.5 pr-2">{m.call}</td>
                    <td className="py-1.5 pr-2">Lab result</td><td className="py-1.5 pr-2">—</td>
                    <td className="py-1.5">Entered by the clinician; not predicted</td>
                  </tr>
                }
                if (m.status!=="predicted") {
                  return <tr key={m.marker} className="border-b border-neutral-300 align-top">
                    <td className="py-1.5 pr-2 font-semibold">{name}</td><td className="py-1.5 pr-2">Not available</td>
                    <td className="py-1.5 pr-2">—</td><td className="py-1.5 pr-2">—</td><td className="py-1.5">{m.reason ?? "No model set"}</td>
                  </tr>
                }
                if (m.low_signal) {
                  return <tr key={m.marker} className="border-b border-neutral-300 align-top">
                    <td className="py-1.5 pr-2 font-semibold">{name}</td><td className="py-1.5 pr-2">MRI can't tell</td>
                    <td className="py-1.5 pr-2">No reliable signal</td><td className="py-1.5 pr-2">—</td>
                    <td className="py-1.5">Order the lab test; the MRI carries almost no signal for this marker</td>
                  </tr>
                }
                return <tr key={m.marker} className="border-b border-neutral-300 align-top">
                  <td className="py-1.5 pr-2 font-semibold">{name}</td>
                  <td className="py-1.5 pr-2 capitalize">{m.call}</td>
                  <td className="py-1.5 pr-2 font-semibold">{VERDICT_NAMES[m.verdict ?? ""] ?? "—"}</td>
                  <td className="py-1.5 pr-2">{likelihood(m)}</td>
                  <td className="py-1.5">{flags(m).join("; ") || "—"}</td>
                </tr>
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-5">
          <div>
            <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider">WHO 2021 types still possible</h2>
            <p className="text-[11.5px]">
              {plan.candidate_categories.length===0 ? "None fits these calls together." : plan.candidate_categories.join("; ")}
            </p>
            <h2 className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wider">Suggested next step</h2>
            <p className="text-[11.5px] font-semibold">{plan.next_step.title}</p>
            <p className="text-[11.5px]">{plan.next_step.reason}</p>
            {plan.next_step.test && <p className="mt-1 text-[11px] text-neutral-700">Test: {plan.next_step.test}</p>}
          </div>
          <div>
            <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider">Confirmatory tissue tests</h2>
            <ul className="space-y-1 text-[11px]">
              {plan.tests.map((t)=>(
                <li key={t.marker}><span className="font-semibold">{MARKER_NAMES[t.marker]}:</span> {t.test}.<br />
                  <span className="text-neutral-700">{t.reason}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-4 border-y border-black py-2 text-[11px]">
          <p className="font-bold">How to use this briefing</p>
          <p>
            The lab result always wins. Do not skip or delay a biopsy or lab test because of this estimate, do not treat on it
            alone, and do not watch and wait on a grade 2–3 estimate without tissue. Any verdict other than Stable, a close call,
            "unlike training scans" or "MRI can't tell" means confirm with tissue.
          </p>
        </section>

        <footer className="mt-3 text-[9.5px] leading-tight text-neutral-600">
          <p>
            Model versions: {Object.entries(profile.model_versions).map(([k, v])=>`${k} ${v.replace("sha256:", "").slice(0, 12)}`).join(" · ")}
          </p>
          <p>Feature pipeline {profile.feature_pipeline_version} · input {profile.input_hash.replace("sha256:", "").slice(0, 16)} · request {profile.request_id ?? "—"}</p>
          <p>Cerebroid research decision-support prototype, trained on public de-identified data. Not a diagnostic device.</p>
        </footer>
      </article>
    </div>
  )
}
