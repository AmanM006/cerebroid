/**
 * The only module that talks to the backend.
 *
 * - The access token lives in memory only (never localStorage), so injected
 *   script can't read it from storage; the refresh token is an HttpOnly cookie
 *   the browser sends to /api/v1/auth/* by itself.
 * - On an expired access token, one refresh is attempted (shared by all
 *   concurrent requests) and the request is retried once.
 * - Every failure becomes an ApiError carrying the server's error_code and
 *   request_id, so a user can report the exact request that failed.
 */
import type {
  Case, CaseList, Doubt, ErrorBody, Evidence, ModelCard, MarkerName, MriSequence, NextMeasurements, Profile, ProfileView, Readiness, Reveal, TokenResponse, User, Volumes, MetricsSummary } from "./types"

export class ApiError extends Error {
  readonly status: number
  readonly errorCode: string
  readonly requestId: string | null

  constructor(status: number, body: Partial<ErrorBody>, fallbackRequestId: string | null) {
    super(body.message ?? `Request failed with status ${status}`)
    this.status=status
    this.errorCode=body.error_code ?? "UNKNOWN_ERROR"
    this.requestId=body.request_id ?? fallbackRequestId
  }
}

let accessToken: string | null=null
let refreshInFlight: Promise<boolean> | null=null
let onSessionExpired: (()=>void) | null=null

export function setSessionExpiredHandler(handler: ()=>void) {
  onSessionExpired=handler
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId=response.headers.get("X-Request-Id")
  try {
    return new ApiError(response.status, (await response.json()) as ErrorBody, requestId)
  } catch {
    return new ApiError(response.status, {}, requestId)
  }
}

async function _doRefresh(): Promise<boolean> {
  try {
    const response=await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" })
    if (!response.ok) {
      accessToken=null
      return false
    }
    const token = ((await response.json()) as TokenResponse).access_token
    accessToken=token
    return true
  } finally {
    refreshInFlight=null
  }
}

async function refreshAccessToken(): Promise<boolean> {
  refreshInFlight??=(async ()=>{
    if (typeof navigator!=="undefined" && "locks" in navigator) {
      return navigator.locks.request("vbx_refresh_lock", ()=>_doRefresh())
    }
    return _doRefresh()
  })()
  return refreshInFlight
}

async function send(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const headers=new Headers(init.headers)
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
  const response=await fetch(path, { ...init, headers, credentials: "same-origin" })

  if (response.status===401 && retry && accessToken) {
    if (await refreshAccessToken()) return send(path, init, false)
    onSessionExpired?.()
  }
  if (!response.ok) throw await toApiError(response)
  return response
}

async function getJson<T>(path: string): Promise<T> {
  return (await send(path, { method: "GET" }, true)).json() as Promise<T>
}

export const api={
  async login(username: string, password: string): Promise<User> {
    const response=await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "same-origin",
    })
    if (!response.ok) throw await toApiError(response)
    const token = ((await response.json()) as TokenResponse).access_token
    accessToken=token
    return api.me()
  },

  /** Restores a session after a page reload from the HttpOnly refresh cookie. */
  async resume(): Promise<User | null> {
    if (accessToken) {
      try {
        return await api.me()
      } catch {
        // The in-memory token may have expired; fall back to the refresh cookie.
      }
    }
    return (await refreshAccessToken()) ? api.me() : null
  },

  async logout(): Promise<void> {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" })
    } finally {
      accessToken=null
    }
  },

  me: ()=>getJson<User>("/api/v1/auth/me"),
  listCases: ()=>getJson<CaseList>("/api/v1/cases"),
  getCase: (id: string)=>getJson<Case>(`/api/v1/cases/${encodeURIComponent(id)}`),

  /** known: lab results the clinician already has, 1 = positive class, 0 = negative. */
  getProfile(id: string, known: Partial<Record<MarkerName, 0 | 1>>={}, view: ProfileView="fused"): Promise<Profile> {
    const params=new URLSearchParams()
    if (view!=="fused") params.set("view", view)
    for (const [marker, value] of Object.entries(known)) params.append("known", `${marker}:${value}`)
    const query=params.size>0 ? `?${params}` : ""
    return getJson<Profile>(`/api/v1/studies/${encodeURIComponent(id)}/profile${query}`)
  },

  /** Which input groups drove one marker's call; uses the same known results as getProfile. */
  getEvidence(id: string, marker: MarkerName, known: Partial<Record<MarkerName, 0 | 1>>={}): Promise<Evidence> {
    const params=new URLSearchParams({ marker })
    for (const [m, value] of Object.entries(known)) params.append("known", `${m}:${value}`)
    return getJson<Evidence>(`/api/v1/studies/${encodeURIComponent(id)}/evidence?${params}`)
  },

  /** Why one marker's call is uncertain, by source, with the action each calls for. */
  getDoubt(id: string, marker: MarkerName, known: Partial<Record<MarkerName, 0 | 1>>={}): Promise<Doubt> {
    const params=new URLSearchParams({ marker })
    for (const [m, value] of Object.entries(known)) params.append("known", `${m}:${value}`)
    return getJson<Doubt>(`/api/v1/studies/${encodeURIComponent(id)}/doubt?${params}`)
  },

  /** WHO CNS5 categories still possible and the lab tests ranked by how far they narrow them. */
  getNextMeasurements(id: string, known: Partial<Record<MarkerName, 0 | 1>>={}): Promise<NextMeasurements> {
    const params=new URLSearchParams()
    for (const [m, value] of Object.entries(known)) params.append("known", `${m}:${value}`)
    const query=params.size>0 ? `?${params}` : ""
    return getJson<NextMeasurements>(`/api/v1/studies/${encodeURIComponent(id)}/next-measurements${query}`)
  },

  /** The dataset's true lab results, for held-out demo cases only. */
  reveal: (id: string)=>getJson<Reveal>(`/api/v1/studies/${encodeURIComponent(id)}/reveal`),

  /** Data, limitations and per-group performance of the deployed models. */
  modelCard: ()=>getJson<ModelCard>("/api/v1/model-card"),

  /** MRI volumes stored for a study; the viewer loads them with volume(). */
  listVolumes: (id: string)=>getJson<Volumes>(`/api/v1/studies/${encodeURIComponent(id)}/volumes`),
  volume: (id: string, sequence: MriSequence)=>
    api.getBytes(`/api/v1/studies/${encodeURIComponent(id)}/volume/${sequence}`),

  /** Public held-out headline numbers for the landing page (no sign-in needed). */
  async metricsSummary(): Promise<MetricsSummary> {
    const response=await fetch("/api/v1/metrics/summary")
    if (!response.ok) throw await toApiError(response)
    return (await response.json()) as MetricsSummary
  },

  /** /ready answers 503 while not ready, which is information here, not an error. */
  async readiness(): Promise<Readiness> {
    const response=await fetch("/ready")
    if (response.status!==200 && response.status!==503) throw await toApiError(response)
    return (await response.json()) as Readiness
  },

  /** Raw bytes for authenticated binary downloads such as NIfTI volumes. */
  async getBytes(path: string): Promise<ArrayBuffer> {
    return (await send(path, { method: "GET" }, true)).arrayBuffer()
  },
}
