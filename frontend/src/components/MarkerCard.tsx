import { useState } from "react"
import { MARKER_LABELS, type MarkerName, type MarkerProfile, type ProvenancedValue } from "../api/types"
import { DoubtView } from "./DoubtView"
import { EvidenceView } from "./EvidenceView"
import { TippingView } from "./TippingView"
import { ProbabilityRange } from "./ProbabilityRange"
import { ProvenanceBadge } from "./ProvenanceBadge"
import { VerdictBadge } from "./VerdictBadge"

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
  const [showWhy, setShowWhy] = useState(false)
  const [showDoubt, setShowDoubt] = useState(false)
  const [showTipping, setShowTipping] = useState(false)
  const labels = MARKER_LABELS[marker.marker]
  const agreeing = marker.n_models != null && marker.agreement != null
    ? Math.round(marker.agreement * marker.n_models) : null

  return (
    <article className="rounded-xl border border-[#1e1b2b] bg-[#0c0a13] p-3.5 shadow-sm transition-all hover:border-[#2e2a40]">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8c889e]">{labels.title}</h3>
          <p className="mt-0.5 text-sm font-bold text-white capitalize">{marker.call ?? "No call"}</p>
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

      {marker.status === "predicted" && marker.prob_min != null && marker.prob_median != null && marker.prob_max != null && (
        <div className="mt-3 space-y-2">
          <ProbabilityRange
            min={marker.prob_min}
            median={marker.prob_median}
            max={marker.prob_max}
            positiveLabel={labels.positive}
          />
          {agreeing != null && (
            <p className="font-mono text-[10.5px] text-[#716c87]">
              {agreeing} of {marker.n_models} equally good models agree
              {marker.variant === "fused_given_idh" && " · uses known IDH"}
            </p>
          )}
          {marker.resolved_by_combining && (
            <p className="rounded-lg border border-purple-800/40 bg-purple-950/25 px-2 py-1 font-mono text-[10.5px] text-purple-200"
              title="MRI alone could not decide; MRI with patient information is Stable">
              ◆ Resolved by combining: MRI alone was {marker.imaging_only_verdict?.toLowerCase()}
              {marker.imaging_only_call && <> ({marker.imaging_only_call})</>}
            </p>
          )}
          {!marker.resolved_by_combining && marker.imaging_only_verdict && (
            <p className="font-mono text-[10.5px] text-[#615c75]">
              MRI alone: {marker.imaging_only_call} · {marker.imaging_only_verdict.toLowerCase()}
            </p>
          )}
          {marker.low_signal && marker.skill != null && (
            <p className="rounded-lg border border-amber-800/50 bg-amber-950/25 px-2 py-1 font-mono text-[10.5px] text-amber-200">
              ⚑ MRI carries almost no signal for this marker (only {Math.max(0, Math.round(marker.skill * 100))}% better
              than guessing from how common each result is). The call reflects the cohort average: confirm with tissue testing.
            </p>
          )}
          {!marker.low_signal && marker.verdict && marker.verdict !== "STABLE" && (
            <p className="rounded-lg border border-amber-800/50 bg-amber-950/25 px-2 py-1 font-mono text-[10.5px] text-amber-200">
              ⚑ Imaging evidence inconclusive: confirm with tissue testing.
            </p>
          )}
          {explainable && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              className="font-mono text-[10.5px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
            >
              {showWhy ? "▾ Hide why" : "▸ Why this call?"}
            </button>
            <button
              onClick={() => setShowDoubt((v) => !v)}
              aria-expanded={showDoubt}
              className="font-mono text-[10.5px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
            >
              {showDoubt ? "▾ Hide doubt" : "▸ What's uncertain?"}
            </button>
            <button
              onClick={() => setShowTipping((v) => !v)}
              aria-expanded={showTipping}
              className="font-mono text-[10.5px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
            >
              {showTipping ? "▾ Hide" : "▸ What would flip it?"}
            </button>
          </div>}
          {explainable && showWhy && <EvidenceView studyId={studyId} marker={marker.marker} known={known} />}
          {explainable && showDoubt && <DoubtView studyId={studyId} marker={marker.marker} known={known} />}
          {explainable && showTipping && <TippingView studyId={studyId} marker={marker.marker} known={known} />}
        </div>
      )}

      {truth && (
        <p className="mt-2.5 flex items-center gap-1.5 border-t border-[#1b1926] pt-2 text-xs font-mono">
          <span className="text-[#6d6883]">True result:</span>
          <span className="font-semibold text-white capitalize">{truth.value ?? "not recorded"}</span>
          {marker.status === "predicted" && truth.value != null && (
            <span className={truth.value === marker.call ? "text-emerald-400" : "text-rose-400"}>
              {truth.value === marker.call ? "✓ matches" : "✗ differs"}
            </span>
          )}
          <ProvenanceBadge provenance={truth.provenance} />
        </p>
      )}
      {marker.status === "known" && (
        <p className="mt-2 font-mono text-[10.5px] text-[#716c87]">Lab result entered by clinician; not predicted.</p>
      )}
      {marker.status === "unavailable" && (
        <p className="mt-2 font-mono text-[10.5px] text-[#716c87]">Not available: {marker.reason ?? "no model set"}.</p>
      )}
    </article>
  )
}
