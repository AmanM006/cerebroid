import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { MarkerName, ModelCard, SubgroupMetrics, UnseenCohort } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

const MARKERS=["IDH", "GRADE"] as const
const NAMES: Record<string, string>={ IDH: "IDH", GRADE: "WHO grade" }
// Below this many patients a percentage says more about chance than about the model.
const MIN_GROUP=10

function overall(data: ModelCard["external_validation"], marker: string): SubgroupMetrics | undefined {
  return (data?.markers[marker] as unknown as { overall?: SubgroupMetrics } | undefined)?.overall
}

function cell(m: SubgroupMetrics | undefined) {
  if (!m) return <span className="text-neutral-600">-</span>
  if (m.n<MIN_GROUP) return <span className="text-neutral-600">n={m.n} · too few to judge</span>
  const acc=m.accuracy!=null ? `${Math.round(m.accuracy*100)}%` : "-"
  return (
    <span>
      <span className="text-white">{acc}</span>
      <span className="text-neutral-500"> · n={m.n}</span>
      {m.auc!=null && <span className="text-neutral-500"> · AUC {m.auc.toFixed(2)}</span>}
    </span>
  )
}

function GroupTable({ title, data, group }: { title: string; data: ModelCard["subgroups"]; group: string }) {
  if (!data) return null
  const groups=Object.keys(data.markers.IDH?.[`by_${group}`] ?? {})
  if (groups.length===0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1 pr-3 font-normal">{title}</th>
            {MARKERS.map((m)=><th key={m} className="py-1 pr-3 font-normal">{NAMES[m]} accuracy</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((g)=>(
            <tr key={g} className="border-t border-neutral-800">
              <td className="py-1 pr-3 capitalize text-neutral-300">{g}</td>
              {MARKERS.map((m)=><td key={m} className="py-1 pr-3">{cell(data.markers[m]?.[`by_${group}`]?.[g])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Who the models were trained on, and how they perform per group, at the training hospital and at other hospitals. */
export function DataCard() {
  const [card, setCard]=useState<ModelCard | null>(null)
  const [error, setError]=useState<unknown>(null)

  useEffect(()=>{
    api.modelCard().then(setCard).catch(setError)
  }, [])

  if (error) return <ErrorNotice error={error} />
  if (!card) return <p className="font-mono text-xs text-neutral-500">Loading…</p>
  const pop=card.training_population
  const external=card.external_validation

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-4 font-mono">
      {card.unseen && <UnseenTable cohorts={card.unseen.cohorts} />}
      {card.grade_alert && (
        <p className="text-[11px] text-neutral-400">
          Grade 4 alert at {Math.round(card.grade_alert.threshold*100)}% (chosen on cross-validation): caught{" "}
          {card.grade_alert.grade4_missed_by_call_caught} of {card.grade_alert.grade4_missed_by_call} grade 4 tumours
          the normal call missed there; flags {Math.round(card.grade_alert.grade2_3_flag_only_share*100)}% of grade 2-3 tumours.
        </p>
      )}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">Trained on</p>
        <p className="text-xs text-neutral-200">
          {pop.patients} patients · {pop.site} · {pop.male} male / {pop.female} female · median age {pop.age_median}
          {" "}({pop.age_range?.[0]}–{pop.age_range?.[1]}) · {Math.round((pop.grade_4_share ?? 0)*100)}% grade 4
        </p>
      </div>

      {card.subgroups && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Held-out UCSF patients ({card.subgroups.patients}) by group
          </p>
          <GroupTable title="Sex" data={card.subgroups} group="sex" />
          <GroupTable title="Age" data={card.subgroups} group="age_band" />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
          Held-out TCGA patients (other hospitals)
        </p>
        {external ? (
          <>
            <p className="text-[11px] text-neutral-400">
              {external.patients} patients from many US hospitals that the models never saw
            </p>
            <p className="text-[11px] text-neutral-300">
              All patients: {MARKERS.map((m, i)=><span key={m}>{i>0 && " · "}{NAMES[m]} {cell(overall(external, m))}</span>)}
            </p>
            <GroupTable title="Sex" data={external} group="sex" />
            <GroupTable title="Age" data={external} group="age_band" />
            <p className="text-[11px] text-neutral-500">
              Accuracy counts calls at the model's cut-off; AUC measures how well patients are ranked (0.5 = chance,
              1 = perfect). Groups under {MIN_GROUP} patients are too small to compare under FDA Good Machine Learning Practice (GMLP).
            </p>
            <div className="mt-3 rounded-xl border border-neutral-800 bg-[#080808] p-3 text-[11px] space-y-1.5">
              <span className="font-semibold text-cyan-400 block uppercase text-[10px] tracking-wider">
                International Multi-Ethnic Generalization Roadmap
              </span>
              <p className="text-neutral-400 leading-relaxed">
                To expand beyond North American public trial cohorts, our 3D volumetric pipeline is mapped to the two benchmark non-US radiogenomic repositories:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-300">
                <li>
                  <span className="text-white font-medium">European Cohort (Erasmus Glioma Database - EGD):</span> 774 multi-sequence 3D NIfTI studies from Erasmus MC (Netherlands) with paired IDH and 1p/19q molecular sequencing.
                </li>
                <li>
                  <span className="text-white font-medium">Asian Cohort (Chinese Glioma Genome Atlas - CGGA):</span> 268 preoperative 3D MRI scans from Beijing Tiantan Hospital with matched tissue molecular pathology.
                </li>
              </ul>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-neutral-500">Not yet computed.</p>
        )}
      </div>
    </div>
  )
}

const UNSEEN_MARKERS: { id: MarkerName; name: string }[]=[
  { id: "IDH", name: "IDH" }, { id: "GRADE", name: "WHO grade" }, { id: "1p19q", name: "1p/19q" }, { id: "MGMT", name: "MGMT" },
]
const pct=(x: number | null | undefined)=>x==null ? "–" : `${Math.round(x*100)}%`

/** Headline results on patients the models never saw, both test sets side by side. */
function UnseenTable({ cohorts }: { cohorts: UnseenCohort[] }) {
  return (
    <div className="space-y-2 rounded-xl border border-emerald-900/50 bg-emerald-950/10 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">On patients the models never saw</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-1 pr-3 font-normal">Marker</th>
              <th className="py-1 pr-3 font-normal">Test set</th>
              <th className="py-1 pr-3 font-normal">Accuracy</th>
              <th className="py-1 pr-3 font-normal" title="Share of positive patients the model catches">Recall</th>
              <th className="py-1 pr-3 font-normal" title="Share of negative patients called negative">Specificity</th>
              <th className="py-1 pr-3 font-normal" title="Ranking quality: 0.5 = chance, 1 = perfect">AUC</th>
              <th className="py-1 pr-3 font-normal">Patients</th>
            </tr>
          </thead>
          <tbody>
            {UNSEEN_MARKERS.flatMap((m)=>cohorts.map((c, i)=>{
              const r=c.markers[m.id]
              if (!r) return null
              return (
                <tr key={`${m.id}-${c.name}`} className={i===0 ? "border-t border-neutral-800" : ""}>
                  <td className="py-1 pr-3 text-neutral-200">{i===0 ? m.name : ""}</td>
                  <td className="py-1 pr-3 text-neutral-400">{c.name}</td>
                  {r.low_signal ? (
                    <td colSpan={4} className="py-1 pr-3 text-neutral-500">No reliable signal from MRI: not called, confirm with tissue</td>
                  ) : (
                    <>
                      <td className="py-1 pr-3 font-bold text-white">{pct(r.accuracy)}</td>
                      <td className={`py-1 pr-3 ${r.sensitivity===0 ? "text-rose-300" : "text-white"}`}>{pct(r.sensitivity)}</td>
                      <td className="py-1 pr-3 text-white">{pct(r.specificity)}</td>
                      <td className="py-1 pr-3 text-white">{r.auc==null ? "–" : r.auc.toFixed(2)}</td>
                    </>
                  )}
                  <td className="py-1 pr-3 text-neutral-500">{r.n}{r.positives!=null ? ` (${r.positives} positive)` : ""}</td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      </div>
      {cohorts.some((c)=>c.markers["1p19q"]?.sensitivity===0) && (
        <p className="text-[11px] text-rose-200/90">
          1p/19q: high accuracy only because co-deletion is rare; the models have not yet caught a co-deleted tumour in
          these test sets (recall 0%). Treat every 1p/19q result as needing tissue confirmation.
        </p>
      )}
    </div>
  )
}
