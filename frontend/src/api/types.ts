// Mirrors backend/app/api/schemas.py and backend/app/domain/contracts.py.

export type Provenance=
  | "clinical_input"
  | "measured"
  | "model_inferred"
  | "reference_cohort"
  | "missing"
  | "synthetic"

export interface ProvenancedValue {
  value: number | string | null
  provenance: Provenance
}

export interface TokenResponse {
  access_token: string
  token_type: "bearer"
  expires_in: number
}

export type Role="clinician" | "reviewer"

export interface User {
  id: string
  username: string
  role: Role
  is_synthetic: boolean
}

export type StudyKind="demo" | "upload"
export type StudyStatus="pending" | "processing" | "ready" | "failed"

export interface Case {
  id: string
  kind: StudyKind
  label: string
  age: ProvenancedValue
  sex: ProvenancedValue
  status: StudyStatus
  created_at: string
}

export interface CaseList {
  items: Case[]
  total: number
  limit: number
  offset: number
}

export type MarkerStatus="loaded" | "missing" | "integrity_error" | "invalid"

export interface Readiness {
  status: "ready" | "not_ready"
  checks: { database: boolean; models: boolean }
  markers: Record<string, MarkerStatus>
}

export type MarkerName="IDH" | "1p19q" | "MGMT" | "GRADE"
export type Verdict="STABLE" | "CONTESTED" | "ARBITRARY"

// Positive / negative class labels per marker; mirrors MARKER_LABELS in backend contracts.py.
export const MARKER_LABELS: Record<MarkerName, { positive: string; negative: string; title: string }>={
  IDH: { positive: "mutant", negative: "wildtype", title: "IDH" },
  "1p19q": { positive: "codeleted", negative: "intact", title: "1p/19q co-deletion" },
  MGMT: { positive: "methylated", negative: "unmethylated", title: "MGMT promoter" },
  GRADE: { positive: "grade 4", negative: "grade 2-3", title: "WHO grade" },
}

export interface MarkerProfile {
  marker: MarkerName
  status: "known" | "predicted" | "unavailable"
  call: string | null
  provenance: Provenance
  evidence_ids: string[]
  verdict?: Verdict | null
  variant?: string | null
  n_models?: number | null
  agreement?: number | null
  prob_min?: number | null
  prob_median?: number | null
  prob_max?: number | null
  model_version?: string | null
  reason?: string | null
  imaging_only_call?: string | null
  imaging_only_verdict?: Verdict | null
  resolved_by_combining?: boolean
  /** Relative CV log-loss gain of the model set over guessing the base rate. */
  skill?: number | null
  /** The set barely beats the base rate: its agreement is not evidence. */
  low_signal?: boolean
}

export interface Reveal {
  study_id: string
  results: { marker: MarkerName; value: ProvenancedValue }[]
}

export type ProfileView="fused" | "imaging_only" | "clinical_only"

export interface Profile {
  study_id: string
  view: ProfileView
  inputs: {
    age: ProvenancedValue
    sex: ProvenancedValue
    prior_biopsy: ProvenancedValue
    known_markers: { marker: MarkerName; value: ProvenancedValue }[]
  }
  missing_inputs: string[]
  markers: MarkerProfile[]
  model_versions: Record<string, string>
  feature_pipeline_version: string
  input_hash: string
  request_id: string | null
  latency_ms: number
}

export interface EvidenceItem {
  evidence_id: string
  group: string
  label: string
  direction: "toward_positive" | "toward_negative"
  supports_call: boolean
  /** Mean absolute change in probability across the model set. */
  weight: number
  /** Fraction of models whose effect points the same way. */
  agreement: number | null
  n_columns: number
  provenance: Provenance
}

export interface Evidence {
  study_id: string
  marker: MarkerName
  variant: string
  call: string
  low_signal: boolean
  method: string
  reference: ProvenancedValue
  /** Mean pairwise rank correlation of the models' explanations. */
  explanation_agreement: number | null
  items: EvidenceItem[]
  model_version: string
  request_id: string | null
  latency_ms: number
}

export interface NextMeasurements {
  study_id: string
  input_hash: string
  label: "decision-support heuristic"
  marker_states: {
    marker: MarkerName; value: string | null; settled: boolean; from_lab: boolean; reason: string; provenance: Provenance
  }[]
  candidate_categories: string[]
  tests: { marker: MarkerName; test: string; settled: boolean; remaining_worst_case: number | null; reason: string }[]
  request_id: string | null
}

export interface Claim {
  /** A few words for the card; text is the full templated sentence. */
  short: string
  text: string
  evidence_ids: string[]
  provenance: Provenance
}

export interface Falsification {
  study_id: string
  marker: MarkerName
  variant: string
  call: string
  verdict: Verdict
  supporting: Claim[]
  contradicting: Claim[]
  competing: Claim
  overturn: Claim[]
  confirmatory_test: string
  model_version: string
  request_id: string | null
  latency_ms: number
}

export type DoubtLevel="low" | "medium" | "high" | "unknown"

export interface DoubtComponent {
  source: "multiplicity" | "ambiguity" | "data_sparsity" | "missing_inputs" | "model_skill"
  level: DoubtLevel
  value: number | null
  detail: string
  action: string
  provenance: Provenance
}

export interface Doubt {
  study_id: string
  marker: MarkerName
  variant: string
  call: string
  verdict: Verdict
  primary_source: string | null
  recommended_action: string
  components: DoubtComponent[]
  model_version: string
  request_id: string | null
  latency_ms: number
}

export type MriSequence="t1" | "t1c" | "t2" | "flair" | "seg"

export interface Volumes {
  study_id: string
  sequences: MriSequence[]
}

export interface ErrorBody {
  error_code: string
  message: string
  request_id: string | null
}
