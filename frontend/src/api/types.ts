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

export interface ErrorBody {
  error_code: string
  message: string
  request_id: string | null
}
