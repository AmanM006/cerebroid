import { MARKER_LABELS, type MarkerProfile } from "../api/types"
import { ProbabilityRange } from "./ProbabilityRange"
import { ProvenanceBadge } from "./ProvenanceBadge"
import { VerdictBadge } from "./VerdictBadge"

export function MarkerCard({ marker }: { marker: MarkerProfile }) {
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
          {marker.verdict && marker.verdict!=="STABLE" && (
            <p className="rounded border border-amber-800/70 bg-amber-950/40 px-2 py-1 text-xs text-amber-200">
              ⚑ Imaging evidence is not decisive here: confirm with tissue testing.
            </p>
          )}
        </div>
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
