import { useEffect, useState } from "react"
import { api, ApiError } from "../api/client"
import type { MarkerName, Profile, ProvenancedValue, Readiness } from "../api/types"
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

const short = (sha: string) => sha.replace("sha256:", "").slice(0, 10)

export function ProfilePanel({ studyId, readiness }: { studyId: string; readiness: Readiness | null }) {
  const [known, setKnown] = useState<KnownResults>({})
  // Each result remembers which request it answers; "loading" = the latest answer is for an older request.
  const [result, setResult] = useState<{ key: string; profile: Profile | null; error: unknown } | null>(null)
  const key = JSON.stringify([studyId, known])

  useEffect(() => {
    let cancelled = false
    api.getProfile(studyId, known)
      .then((profile) => !cancelled && setResult({ key, profile, error: null }))
      .catch((error) => !cancelled && setResult({ key, profile: null, error }))
    return () => {
      cancelled = true
    }
  }, [key, studyId, known])

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
      <KnownResultsForm value={known} onChange={setKnown} disabled={notReady} />

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
            <MarkerCard key={m.marker} marker={m} truth={truth?.studyId === studyId ? truth.values[m.marker] : undefined} />
          ))}
          {truth?.studyId !== studyId && (
            <button
              onClick={reveal}
              className="w-full rounded-xl border border-[#262335] bg-[#14121d] py-2 text-xs font-medium text-slate-200 transition-all hover:border-[#38334d] hover:bg-[#1a1726] hover:text-white cursor-pointer"
            >
              Reveal Ground Truth Result
            </button>
          )}
          {revealError !== null && <ErrorNotice error={revealError} />}

          <div className="space-y-1 pt-2 font-mono text-[10.5px] text-[#716c87]">
            <p className="flex items-center gap-1.5">
              Biopsy prior to MRI: <span className="text-white">{profile.inputs.prior_biopsy.value ?? "not recorded"}</span>
              <ProvenanceBadge provenance={profile.inputs.prior_biopsy.provenance} />
            </p>
            {profile.missing_inputs.length > 0 && (
              <p>Missing inputs: {profile.missing_inputs.join(", ")} (uncertainty higher)</p>
            )}
            <p className="text-[#565169]">
              pipeline {short(profile.feature_pipeline_version)} · input {short(profile.input_hash)}
              {profile.request_id && <> · req {profile.request_id}</>}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
