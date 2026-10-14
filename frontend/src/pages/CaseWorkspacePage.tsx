/**
 * Three-region workspace (CLAUDE.md §8): MRI viewer · molecular profile · evidence & doubt.
 * Every panel shows only what the API actually returns; nothing is filled in client-side.
 */
import { lazy, Suspense, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../api/client"
import type { Case, Readiness } from "../api/types"
import { AppShell } from "../components/AppShell"
import { ErrorNotice } from "../components/ErrorNotice"
import type { ViewerVolume } from "../components/MriViewer"
import { ProfilePanel } from "../components/ProfilePanel"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

// NiiVue is most of the bundle; load it only when a case is opened.
const MriViewer=lazy(()=>import("../components/MriViewer").then((m)=>({ default: m.MriViewer })))

const NO_VOLUMES: ViewerVolume[]=[]

export function CaseWorkspacePage() {
  const { caseId }=useParams<{ caseId: string }>()
  const [study, setStudy]=useState<Case | null>(null)
  const [readiness, setReadiness]=useState<Readiness | null>(null)
  const [error, setError]=useState<unknown>(null)

  useEffect(()=>{
    if (!caseId) return
    api.getCase(caseId).then(setStudy).catch(setError)
    api.readiness().then(setReadiness).catch(setError)
  }, [caseId])

  return (
    <AppShell>
      <div className="grid h-[calc(100vh-5.5rem)] grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_22rem_20rem]">
        <section className="flex min-h-[24rem] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <h1 className="text-base font-semibold">{study?.label ?? "Case"}</h1>
            {study && (
              <>
                <span className="flex items-center gap-1.5">Age {study.age.value ?? "—"} <ProvenanceBadge provenance={study.age.provenance} /></span>
                <span className="flex items-center gap-1.5">Sex {study.sex.value ?? "—"} <ProvenanceBadge provenance={study.sex.provenance} /></span>
              </>
            )}
          </div>
          {error!==null && <ErrorNotice error={error} />}
          <div className="flex-1">
            <Suspense fallback={<p className="text-sm text-slate-400">Loading viewer…</p>}>
              <MriViewer volumes={NO_VOLUMES} />
            </Suspense>
          </div>
        </section>

        <section aria-labelledby="profile-heading" className="overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h2 id="profile-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Molecular profile
          </h2>
          {caseId && <ProfilePanel studyId={caseId} readiness={readiness} />}
        </section>

        <section aria-labelledby="evidence-heading" className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 xl:block">
          <h2 id="evidence-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Evidence &amp; doubt
          </h2>
          <p className="text-sm text-slate-400">Evidence is shown once a molecular profile has been computed for this case.</p>
        </section>
      </div>
    </AppShell>
  )
}
