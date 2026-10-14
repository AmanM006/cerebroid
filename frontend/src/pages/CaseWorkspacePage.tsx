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

  // Scratch block swapping: order can be toggled by clicking panel headers
  const [leftComponent, setLeftComponent] = useState<"2d" | "3d">("3d")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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
      <div className="flex h-[calc(100vh-3.25rem)] w-full flex-col overflow-hidden bg-black p-3 space-y-2.5">
        {/* Top Clinical Case Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-850 pb-2 px-1">
          <div className="flex items-center gap-3">
            <Link
              to="/cases"
              className="rounded-xl border border-neutral-800 bg-[#121212] px-3 py-1.5 text-xs font-mono text-neutral-300 hover:border-neutral-600 hover:text-white transition-all cursor-pointer"
            >
              ← Back to Cohort
            </Link>
            <h1 className="text-sm font-mono font-bold text-white tracking-wide">
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
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold border transition-all cursor-pointer ${
                isSidebarOpen
                  ? "bg-cyan-950/80 border-cyan-700/80 text-cyan-300"
                  : "bg-[#121212] border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700"
              }`}
            >
              {isSidebarOpen ? "◧ Hide Molecular Sidebars" : "◧ Molecular & Evidence Sidebar"}
            </button>
          </div>
        </div>

        {error !== null && <ErrorNotice error={error} />}

        {/* Modular Workspace Stage: MRI fills full width by default or shares space cleanly */}
        <div className="flex flex-1 gap-3 overflow-hidden min-h-0">
          {/* Main MRI Studio: Click header to swap 2D and 3D scratch block positions */}
          <section className="flex flex-1 overflow-hidden min-w-0">
            <ClinicalMriStudio leftComponent={leftComponent} onSwap={toggleSwap} />
          </section>

          {/* Slide-in Molecular Profile & Evidence Panel */}
          {isSidebarOpen && (
            <aside className="flex w-96 shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808] transition-all">
              <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-4 py-2.5">
                <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                  Molecular Profile &amp; Doubt
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-neutral-500 hover:text-white font-mono text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {caseId && <ProfilePanel studyId={caseId} readiness={readiness} />}

                <div className="border-t border-neutral-850 pt-4 text-xs font-mono text-neutral-400 space-y-2">
                  <p className="font-semibold text-white text-[11px]">WHO 2021 Clinical Criteria:</p>
                  <p className="text-[11px] leading-relaxed">
                    Cross-model multiplicity evaluation actively isolates stable genomic calls from contested predictions requiring histological biopsy.
                  </p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  )
}
