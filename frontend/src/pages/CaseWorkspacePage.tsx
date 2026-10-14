import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api/client"
import type { Case, Readiness } from "../api/types"
import { AppShell } from "../components/AppShell"
import { ErrorNotice } from "../components/ErrorNotice"
import { ClinicalMriStudio } from "../components/ClinicalMriStudio"
import { ProfilePanel } from "../components/ProfilePanel"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

export function CaseWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>()
  const [study, setStudy] = useState<Case | null>(null)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [error, setError] = useState<unknown>(null)

  // Scratch block swapping for the top MRI viewers
  const [leftComponent, setLeftComponent] = useState<"2d" | "3d">("3d")

  useEffect(() => {
    if (!caseId) return
    api.getCase(caseId).then(setStudy).catch(setError)
    api.readiness().then(setReadiness).catch(setError)
  }, [caseId])

  const toggleSwap = () => {
    setLeftComponent((prev) => (prev === "3d" ? "2d" : "3d"))
  }

  return (
    <AppShell>
      <div className="flex w-full flex-col bg-black p-4 lg:p-6 space-y-6">
        {/* Sticky Case Navigation Subheader */}
        <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
          <div className="flex items-center gap-3">
            <Link
              to="/cases"
              className="rounded-xl border border-neutral-800 bg-[#121212] px-3.5 py-1.5 text-xs font-mono text-neutral-300 hover:border-neutral-600 hover:text-white transition-all cursor-pointer"
            >
              ← Back to Cohort
            </Link>
            <h1 className="text-base font-mono font-bold text-white tracking-wide">
              {study?.label ?? "Case Workspace"}
            </h1>
            {study && (
              <div className="flex items-center gap-3 font-mono text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  Age <strong className="text-white">{study.age.value ?? "—"}</strong>
                  <ProvenanceBadge provenance={study.age.provenance} />
                </span>
                <span className="flex items-center gap-1.5">
                  Sex <strong className="text-white">{study.sex.value ?? "—"}</strong>
                  <ProvenanceBadge provenance={study.sex.provenance} />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="rounded-full bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
              ● Active Diagnostic Session
            </span>
          </div>
        </div>

        {error !== null && <ErrorNotice error={error} />}

        {/* SECTION 1: Full-Screen Height (100vh) Multi-Planar & 3D GPU MRI Viewport */}
        <section className="flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-200">
                Primary Neuro-Imaging Stage
              </h2>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">
              Click either block header to swap left ⇄ right
            </span>
          </div>

          <div className="h-[88vh] min-h-[580px] w-full rounded-2xl border border-neutral-800 bg-[#080808] p-2 overflow-hidden shadow-2xl">
            {caseId && <ClinicalMriStudio studyId={caseId} leftComponent={leftComponent} onSwap={toggleSwap} />}
          </div>
        </section>

        {/* SECTION 2: Molecular Inferences & Doubt Analysis (Below MRI — full scrollable section) */}
        <section className="flex flex-col space-y-3 pt-4 border-t border-neutral-850">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-200">
                Molecular Profile, Multiplicity &amp; Clinical Doubt
              </h2>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">
              WHO 2021 CNS Criteria · Multi-Model Ensemble Verdicts
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Molecular Marker Cards (2 Columns Wide on Desktop) */}
            <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-5 shadow-xl">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 mb-4 border-b border-neutral-850 pb-2">
                Predicted Genomic Biomarkers
              </h3>
              {caseId && <ProfilePanel studyId={caseId} readiness={readiness} />}
            </div>

            {/* Evidence, Doubt Decomposition & Clinical Guidelines */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-5 shadow-xl space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-850 pb-2">
                  Clinical Evidence &amp; Doubt
                </h3>
                <p className="font-mono text-xs text-neutral-400 leading-relaxed">
                  Each call is made by a set of equally accurate models. <strong className="text-emerald-400">Stable</strong> means nearly all of them agree; the cut-offs are chosen on cross-validation data.
                </p>
                <div className="rounded-xl border border-neutral-800 bg-[#141414] p-3 text-[11px] font-mono text-neutral-400 space-y-1.5">
                  <span className="font-bold text-neutral-200 block">Doubt Protocol:</span>
                  <p>• If Contested / Arbitrary: Tissue biopsy mandatory.</p>
                  <p>• If Stable: Molecular profiling matches non-invasive radiomic features.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-5 shadow-xl space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-850 pb-2">
                  WHO 2021 Diagnostic Targets
                </h3>
                <ul className="space-y-2 font-mono text-xs text-neutral-400">
                  <li className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
                    <span>IDH1/2 Mutation</span>
                    <span className="text-white font-semibold">Codon 132/172</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
                    <span>1p/19q Co-deletion</span>
                    <span className="text-white font-semibold">Oligodendroglioma</span>
                  </li>
                  <li className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
                    <span>MGMT Methylation</span>
                    <span className="text-white font-semibold">Temozolomide Response</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Histopathologic Grade</span>
                    <span className="text-white font-semibold">WHO CNS Grade 2–4</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
