import { MARKER_LABELS, type MarkerProfile, type ProvenancedValue } from "../api/types"
import { ProbabilityRange } from "./ProbabilityRange"
import { ProvenanceBadge } from "./ProvenanceBadge"
import { VerdictBadge } from "./VerdictBadge"

export function MarkerCard({ marker, truth }: { marker: MarkerProfile; truth?: ProvenancedValue }) {
  const labels=MARKER_LABELS[marker.marker]
  const agreeing=marker.n_models!=null && marker.agreement!=null
    ? Math.round(marker.agreement*marker.n_models) : null

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">{labels.title}</h3>
          <p className="text-base font-semibold capitalize">{marker.call ?? "No call"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {marker.verdict && <VerdictBadge verdict={marker.verdict} />}
          <ProvenanceBadge provenance={marker.provenance} />
        </div>
      </header>

      {marker.status==="predicted" && marker.prob_min!=null && marker.prob_median!=null && marker.prob_max!=null && (
        <div className="mt-3 space-y-2">
          <ProbabilityRange min={marker.prob_min} median={marker.prob_median} max={marker.prob_max}
            positiveLabel={labels.positive} />
          {agreeing!=null && (
            <p className="text-xs text-slate-400">
              {agreeing} of {marker.n_models} equally good models agree
              {marker.variant==="fused_given_idh" && " · uses the known IDH result"}
            </p>
          )}
          {marker.resolved_by_combining && (
            <p className="rounded border border-violet-700 bg-violet-950/40 px-2 py-1 text-xs text-violet-200"
              title="MRI alone could not decide; MRI with patient information is Stable">
              ◆ Resolved by combining: MRI alone was {marker.imaging_only_verdict?.toLowerCase()}
              {marker.imaging_only_call && <> ({marker.imaging_only_call})</>}
            </p>
          )}
          {!marker.resolved_by_combining && marker.imaging_only_verdict && (
            <p className="text-xs text-slate-500">
              MRI alone: {marker.imaging_only_call} · {marker.imaging_only_verdict.toLowerCase()}
            </p>
          )}
          {marker.verdict && marker.verdict!=="STABLE" && (
            <p className="rounded border border-amber-800/70 bg-amber-950/40 px-2 py-1 text-xs text-amber-200">
              ⚑ Imaging evidence is not decisive here: confirm with tissue testing.
            </p>
          )}
        </div>
      )}

      {truth && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-slate-800 pt-2 text-xs">
          <span className="text-slate-400">True result:</span>
          <span className="font-medium capitalize">{truth.value ?? "not recorded"}</span>
          {marker.status==="predicted" && truth.value!=null && (
            <span className={truth.value===marker.call ? "text-emerald-300" : "text-rose-300"}>
              {truth.value===marker.call ? "✓ matches" : "✗ differs"}
            </span>
          )}
          <ProvenanceBadge provenance={truth.provenance} />
        </p>
      )}
      {marker.status==="known" && (
        <p className="mt-2 text-xs text-slate-400">Lab result entered by the clinician; not predicted.</p>
      )}
      {marker.status==="unavailable" && (
        <p className="mt-2 text-xs text-slate-400">Not available: {marker.reason ?? "no model set"}.</p>
      )}
    </article>
  )
}
