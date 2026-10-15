import { useState } from "react"
import { MARKER_LABELS, type MarkerName, type MarkerProfile, type ProvenancedValue } from "../api/types"
import { DoubtView } from "./DoubtView"
import { LimeView } from "./LimeView"
import { ProbabilityRange } from "./ProbabilityRange"
import { ProvenanceBadge } from "./ProvenanceBadge"
import { VerdictBadge } from "./VerdictBadge"

// The card stays glanceable (call, badge, probability band); explanations live behind "Details".
// One plain sentence under the call, so the badge never needs decoding. A Contested call can come
// from split votes or from unanimous votes with very different confidence; the sentence says which.
function verdictMeaning(marker: MarkerProfile): string {
  if (marker.out_of_distribution) return "Scan unlike the training cases: do not rely on the AI"
  if (marker.low_signal) return "Confirm with tissue testing"
  if (marker.verdict === "STABLE") return "The models agree"
  if (marker.verdict === "ARBITRARY") return "The models are split close to 50/50"
  if (marker.verdict === "CONTESTED") {
    return marker.agreement === 1 ? "The models agree on the call, not on how sure" : "The models disagree"
  }
  return ""
}

const TABS = [
  { id: "why", label: "Why" },
  { id: "doubt", label: "Uncertainty" },
] as const
type Tab = (typeof TABS)[number]["id"]

export function MarkerCard({
  marker,
  truth,
  studyId,
  known,
  explainable = true,
}: {
  marker: MarkerProfile
  truth?: ProvenancedValue
  studyId: string
  known: Partial<Record<MarkerName, 0 | 1>>
  /** Evidence and doubt describe the combined model set, so they are offered only in that view. */
  explainable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("why")
  const labels = MARKER_LABELS[marker.marker]
  const agreeing = marker.n_models != null && marker.agreement != null
    ? Math.round(marker.agreement * marker.n_models) : null
  const needsTissue = marker.status === "predicted" && (marker.low_signal || (marker.verdict != null && marker.verdict !== "STABLE"))
  // Set on cross-validation (ml/pipeline/grade_alert.py): catches every grade 4 the 0.5 call misses there.
  const gradeAlert = marker.alert_threshold != null && marker.prob_median != null
    && marker.prob_median >= marker.alert_threshold && marker.call === "grade 2-3"
  const predicted = marker.status === "predicted" && marker.prob_min != null && marker.prob_median != null && marker.prob_max != null

  return (
    <article className="rounded-xl border border-neutral-800 bg-[#0d0d0f] p-4 shadow-sm transition-all hover:border-neutral-700">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-300 font-bold">{labels.title}</h3>
          <p className={`mt-1 text-xl font-black capitalize tracking-tight ${marker.low_signal ? "text-neutral-300" : "text-white"}`}>
            {marker.low_signal ? "MRI can't tell" : (marker.call ?? "No call")}
          </p>
          {marker.status === "predicted" && (
            <p className="mt-0.5 font-mono text-xs text-neutral-300 font-medium">
              {verdictMeaning(marker)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {marker.low_signal ? (
            <span className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-900/60 px-1.5 py-0.5 text-xs font-medium text-slate-300"
              title="The models barely beat guessing from how common each result is, so their agreement is not evidence">
              <span aria-hidden="true">∅</span>
              No reliable signal
            </span>
          ) : marker.verdict && <VerdictBadge verdict={marker.verdict} />}
          <ProvenanceBadge provenance={marker.provenance} />
        </div>
      </header>

      {predicted && !marker.low_signal && (
        <div className="mt-3 space-y-2">
          <ProbabilityRange
            min={marker.prob_min!}
            median={marker.prob_median!}
            max={marker.prob_max!}
            positiveLabel={labels.positive}
            negativeLabel={labels.negative}
            call={marker.call}
            muted={marker.low_signal}
          />
          {(needsTissue || marker.resolved_by_combining || (gradeAlert) || marker.out_of_distribution) && (
            <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
              {gradeAlert && (
                <span className="rounded-full border border-rose-800/80 bg-rose-950/40 px-2 py-0.5 text-rose-200 font-semibold shadow-sm"
                  title={`P(grade 4) is at or above ${Math.round((marker.alert_threshold ?? 0) * 100)}%, the level chosen on cross-validation to catch every grade 4 tumour the call would miss there (its false-alarm rate is in Training data & fairness).`}>
                  ⚠ Grade 4 not ruled out ({Math.round((marker.prob_median ?? 0) * 100)}%) · confirm with tissue
                </span>
              )}
              {marker.out_of_distribution && (
                <span className="rounded-full border border-rose-800/80 bg-rose-950/40 px-2 py-0.5 text-rose-200 font-semibold"
                  title={marker.reason ?? "This scan is unlike the training cases"}>
                  ⚠ Unlike training scans · refer for expert review
                </span>
              )}
              {needsTissue && (
                <span className="rounded-full border border-amber-800/60 bg-amber-950/30 px-2 py-0.5 text-amber-200"
                  title={marker.low_signal
                    ? "MRI carries almost no signal for this marker; the call reflects the cohort average"
                    : "Imaging evidence is not decisive here"}>
                  ⚑ Confirm with tissue
                </span>
              )}
              {marker.resolved_by_combining && (
                <span className="rounded-full border border-purple-800/50 bg-purple-950/30 px-2 py-0.5 text-purple-200"
                  title={`MRI alone was ${marker.imaging_only_verdict?.toLowerCase()}; combined with patient age and sex produces stable verdict`}>
                  ◆ Decided by MRI + Age & Sex
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="font-mono text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            {open ? "▾ Hide details" : "▸ Details"}
          </button>

          {open && (
            <div className="space-y-3 border-t border-neutral-800 pt-3">
              <p className="font-mono text-xs text-neutral-300 font-semibold leading-relaxed">
                {agreeing != null && <span className="text-white font-bold">{agreeing}/{marker.n_models} models say {marker.call}</span>}
                {marker.imaging_only_verdict && <span className="text-neutral-400"> · MRI alone: <span className="text-neutral-200">{marker.imaging_only_call}</span></span>}
                {marker.variant === "fused_given_idh" && <span className="text-neutral-400"> · uses the known IDH result</span>}
              </p>
              {explainable && (
                <>
                  <div role="tablist" className="flex flex-wrap gap-2 pt-0.5">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`rounded-lg border px-3 py-1 font-mono text-xs font-bold transition-all cursor-pointer ${
                          tab === t.id
                            ? "border-cyan-500 bg-cyan-950/80 text-cyan-200 shadow-sm"
                            : "border-neutral-800 bg-[#121214] text-neutral-400 hover:text-white hover:border-neutral-700"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {tab === "why" && <LimeView studyId={studyId} marker={marker.marker} known={known} />}
                  {tab === "doubt" && <DoubtView studyId={studyId} marker={marker.marker} known={known} />}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {truth && (
        <p className="mt-2.5 flex items-center gap-1.5 border-t border-[#1b1926] pt-2 text-xs font-mono">
          <span className="text-[#6d6883]">True result:</span>
          <span className="font-semibold text-white capitalize">{truth.value ?? "not recorded"}</span>
          {marker.status === "predicted" && !marker.low_signal && truth.value != null && (
            <span className={truth.value === marker.call ? "text-emerald-400" : "text-rose-400"}>
              {truth.value === marker.call ? "✓" : "✗"}
            </span>
          )}
          <ProvenanceBadge provenance={truth.provenance} />
        </p>
      )}
      {marker.status === "known" && (
        <p className="mt-2 font-mono text-[10.5px] text-[#716c87]">Lab result entered by clinician</p>
      )}
      {marker.status === "unavailable" && (
        <p className="mt-2 font-mono text-[10.5px] text-[#716c87]">Not available: {marker.reason ?? "no model set"}</p>
      )}
    </article>
  )
}
