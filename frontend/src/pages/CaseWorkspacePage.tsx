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

  // Panel layout minimization states: true = maximized / expanded, false = collapsed
  const [isViewerExpanded, setIsViewerExpanded] = useState(false)
  const [isEvidenceVisible, setIsEvidenceVisible] = useState(true)
  const [isProfileVisible, setIsProfileVisible] = useState(true)

  useEffect(() => {
    if (!caseId) return
    api.getCase(caseId).then(setStudy).catch(setError)
    api.readiness().then(setReadiness).catch(setError)
  }, [caseId])

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-2.5 p-3 sm:p-4 bg-[#07060b]">
        {/* Top Case Subheader */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#1b1926] pb-2.5">
          <div className="flex items-center gap-3">
            <Link
              to="/cases"
              className="rounded-lg border border-[#221f30] bg-[#12101b] px-2.5 py-1 text-xs font-mono text-[#8c889e] hover:border-[#38334d] hover:text-white transition-all cursor-pointer"
            >
              ← Back to Cohort
            </Link>
            <h1 className="text-sm font-mono font-bold text-white tracking-wide">
              {study?.label ?? "Case Workspace"}
            </h1>
            {study && (
              <div className="flex items-center gap-3 font-mono text-xs text-[#8c889e]">
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

          {/* Quick Panel Toggle Buttons */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setIsViewerExpanded((prev) => !prev)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all cursor-pointer ${
                isViewerExpanded
                  ? "bg-cyan-950/70 border-cyan-700/60 text-cyan-300"
                  : "bg-[#12101b] border-[#232030] text-[#8c889e] hover:text-white"
              }`}
            >
              {isViewerExpanded ? "⤢ Restore Layout" : "⤢ Maximize MRI Viewer"}
            </button>

            {!isViewerExpanded && (
              <>
                <button
                  onClick={() => setIsProfileVisible((prev) => !prev)}
                  className={`rounded-lg px-2 py-1 text-[11px] border transition-all cursor-pointer ${
                    isProfileVisible
                      ? "bg-[#181624] border-[#2c283f] text-slate-200"
                      : "bg-[#100f17] border-[#1d1b26] text-[#615c75]"
                  }`}
                  title="Toggle Molecular Profile Panel"
                >
                  {isProfileVisible ? "Hide Profile" : "Show Profile"}
                </button>
                <button
                  onClick={() => setIsEvidenceVisible((prev) => !prev)}
                  className={`rounded-lg px-2 py-1 text-[11px] border transition-all cursor-pointer ${
                    isEvidenceVisible
                      ? "bg-[#181624] border-[#2c283f] text-slate-200"
                      : "bg-[#100f17] border-[#1d1b26] text-[#615c75]"
                  }`}
                  title="Toggle Evidence Panel"
                >
                  {isEvidenceVisible ? "Hide Evidence" : "Show Evidence"}
                </button>
              </>
            )}
          </div>
        </div>

        {error !== null && <ErrorNotice error={error} />}

        {/* Dynamic Modular Workspace Layout */}
        <div className="flex flex-1 gap-3 overflow-hidden">
          {/* Main 2D & 3D MRI Viewport (Expands smoothly up to 100% or 65% width) */}
          <section
            className={`relative flex flex-col overflow-hidden rounded-2xl border border-[#1e1b2b] bg-[#000000] transition-all duration-300 ${
              isViewerExpanded
                ? "w-full"
                : isProfileVisible && isEvidenceVisible
                ? "flex-1 min-w-0"
                : isProfileVisible || isEvidenceVisible
                ? "w-3/4 min-w-0"
                : "w-full"
            }`}
          >
            <ClinicalMriStudio />
          </section>

          {/* Collapsible Molecular Profile Panel */}
          {!isViewerExpanded && isProfileVisible && (
            <section
              aria-labelledby="profile-heading"
              className="flex w-80 lg:w-96 flex-col overflow-hidden rounded-2xl border border-[#1e1b2b] bg-[#0c0a13] transition-all"
            >
              <div className="flex items-center justify-between border-b border-[#1b1926] bg-[#0f0d17] px-4 py-2.5">
                <h2
                  id="profile-heading"
                  className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#a9a4be]"
                >
                  Molecular Profile
                </h2>
                <button
                  onClick={() => setIsProfileVisible(false)}
                  className="text-[#615c75] hover:text-white font-mono text-xs cursor-pointer"
                  title="Minimize Panel"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3.5">
                {caseId && <ProfilePanel studyId={caseId} readiness={readiness} />}
              </div>
            </section>
          )}

          {/* Collapsible Evidence & Doubt Section */}
          {!isViewerExpanded && isEvidenceVisible && (
            <section
              aria-labelledby="evidence-heading"
              className="hidden 2xl:flex w-72 flex-col overflow-hidden rounded-2xl border border-[#1e1b2b] bg-[#0c0a13] transition-all"
            >
              <div className="flex items-center justify-between border-b border-[#1b1926] bg-[#0f0d17] px-4 py-2.5">
                <h2
                  id="evidence-heading"
                  className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#a9a4be]"
                >
                  Clinical Doubt &amp; Evidence
                </h2>
                <button
                  onClick={() => setIsEvidenceVisible(false)}
                  className="text-[#615c75] hover:text-white font-mono text-xs cursor-pointer"
                  title="Minimize Panel"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-[#8c889e] space-y-3">
                <p>
                  Decision-support evidence and cross-model uncertainty metrics populated automatically from near-optimal ensembles.
                </p>
                <div className="rounded-xl border border-[#1e1b2b] bg-[#12101b] p-3 text-[11px] text-[#716c87] space-y-1.5">
                  <p className="font-semibold text-slate-300">WHO 2021 Diagnostic Targets:</p>
                  <p>• IDH1/2 mutation status</p>
                  <p>• 1p/19q codeletion (Oligodendroglioma)</p>
                  <p>• MGMT promoter methylation</p>
                  <p>• Histopathological CNS WHO Grade</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  )
}
