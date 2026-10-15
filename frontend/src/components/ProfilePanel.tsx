import { useEffect, useState } from "react"
import { api, ApiError } from "../api/client"
import type { MarkerName, Profile, ProfileView, ProvenancedValue, Readiness } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { KnownResultsForm, type KnownResults } from "./KnownResultsForm"
import { MarkerCard } from "./MarkerCard"
import { ProvenanceBadge } from "./ProvenanceBadge"

const MARKER_STATUS_TEXT: Record<string, string> = {
  loaded: "model set loaded",
  missing: "model set not deployed",
  integrity_error: "model files failed integrity check",
  invalid: "model files invalid",
}

// What the models may look at: the counterfactual views show what each source decides alone.
const VIEWS: { id: ProfileView; label: string; hint: string }[] = [
  { id: "fused", label: "MRI + age & sex", hint: "All inputs combined" },
  { id: "imaging_only", label: "MRI only", hint: "Age, sex and history hidden from the models" },
  { id: "clinical_only", label: "Age & sex only", hint: "No imaging: only age, sex and history" },
]

const short = (sha: string) => sha.replace("sha256:", "").slice(0, 10)

export function ProfilePanel({
  studyId,
  readiness,
  known,
  onKnownChange,
}: {
  studyId: string
  readiness: Readiness | null
  /** Lab results the clinician entered; owned by the page so other panels follow them too. */
  known: KnownResults
  onKnownChange: (known: KnownResults) => void
}) {
  const [view, setView] = useState<ProfileView>("fused")
  const [showLabForm, setShowLabForm] = useState(false)
  // Each result remembers which request it answers; "loading" = the latest answer is for an older request.
  const [result, setResult] = useState<{ key: string; profile: Profile | null; error: unknown } | null>(null)
  const key = JSON.stringify([studyId, known, view])

  useEffect(() => {
    let cancelled = false
    api.getProfile(studyId, known, view)
      .then((profile) => !cancelled && setResult({ key, profile, error: null }))
      .catch((error) => !cancelled && setResult({ key, profile: null, error }))
    return () => {
      cancelled = true
    }
  }, [key, studyId, known, view])

  const [truth, setTruth] = useState<{ studyId: string; values: Partial<Record<MarkerName, ProvenancedValue>> } | null>(null)
  const [revealError, setRevealError] = useState<unknown>(null)

  function reveal() {
    api.reveal(studyId)
      .then((r) => setTruth({ studyId, values: Object.fromEntries(r.results.map((x) => [x.marker, x.value])) }))
      .catch(setRevealError)
  }

  const loading = result?.key !== key
  const profile = result?.profile ?? null
  const error = result?.error ?? null

  const notReady = error instanceof ApiError && error.errorCode === "FEATURES_NOT_READY"

  return (
    <div className="space-y-3">
      {showLabForm || Object.keys(known).length > 0 ? (
        <KnownResultsForm value={known} onChange={onKnownChange} disabled={notReady} />
      ) : (
        <button onClick={() => setShowLabForm(true)}
          className="font-mono text-[11px] text-[#8c889e] hover:text-white cursor-pointer">
          Have a lab result already? <span className="text-cyan-300">▸ Enter it</span>
        </button>
      )}

      <div role="radiogroup" aria-label="Inputs the models may use" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-[#716c87]">Based on:</span>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="radio"
            aria-checked={view === v.id}
            title={v.hint}
            onClick={() => setView(v.id)}
            className={`rounded-lg border px-2 py-0.5 font-mono text-[10.5px] transition-colors cursor-pointer ${
              view === v.id
                ? "border-cyan-700 bg-cyan-950/60 text-cyan-200 font-bold"
                : "border-[#2a2638] text-[#8c889e] hover:text-white"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading && !profile && (
        <div className="flex items-center gap-2 py-4 text-xs font-mono text-[#8c889e]">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          <span>Computing molecular profile…</span>
        </div>
      )}

      {notReady && (
        <div className="space-y-2 text-xs font-mono">
          <p className="text-[#8c889e]">Imaging features for this case are not available yet, so no profile can be computed.</p>
          {readiness && (
            <ul className="space-y-1">
              {Object.entries(readiness.markers).map(([marker, status]) => (
                <li key={marker} className="flex justify-between rounded-lg border border-[#1e1b2b] bg-[#0c0a13] px-2.5 py-1 text-xs text-[#a9a4be]">
                  <span>{marker}</span>
                  <span className="text-[#6d6883]">{MARKER_STATUS_TEXT[status] ?? status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error !== null && !notReady && <ErrorNotice error={error} />}

      {profile && (
        <div className={`space-y-2.5 ${loading ? "opacity-60" : ""}`}>
          {profile.markers.map((m) => (
            <MarkerCard key={m.marker} marker={m} studyId={studyId} known={known} explainable={view === "fused"}
              truth={truth?.studyId === studyId ? truth.values[m.marker] : undefined} />
          ))}
          {truth?.studyId !== studyId && (
            <button
              onClick={reveal}
              className="w-full rounded-xl border border-neutral-800 bg-[#121214] py-2.5 text-xs font-semibold text-white transition-all hover:border-neutral-600 hover:bg-[#1a1a1d] cursor-pointer shadow-sm"
            >
              Reveal true lab results
            </button>
          )}
          {revealError !== null && <ErrorNotice error={revealError} />}

          <div className="space-y-1.5 pt-2 font-mono text-xs text-neutral-300">
            <p className="flex items-center gap-1.5">
              Biopsy prior to MRI: <span className="text-white font-semibold">{profile.inputs.prior_biopsy.value ?? "not recorded"}</span>
              <ProvenanceBadge provenance={profile.inputs.prior_biopsy.provenance} />
            </p>
            {profile.missing_inputs.length > 0 && (
              <p className="text-amber-200/90 font-medium">Missing inputs: {profile.missing_inputs.join(", ")} (uncertainty higher)</p>
            )}
            <p className="w-fit cursor-help text-neutral-400 hover:text-white transition-colors"
              title={`Features ${short(profile.feature_pipeline_version)} · input ${short(profile.input_hash)}`
                + (profile.request_id ? ` · request ${profile.request_id}` : "")}>
              ⓘ Reproducibility details
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
