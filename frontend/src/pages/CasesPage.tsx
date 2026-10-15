import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import type { CaseList } from "../api/types"
import { AppShell } from "../components/AppShell"
import { DataCard } from "../components/DataCard"
import { ErrorNotice } from "../components/ErrorNotice"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

export function CasesPage() {
  const [cases, setCases] = useState<CaseList | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [showData, setShowData] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")

  useEffect(() => {
    api.listCases().then(setCases).catch(setError)
  }, [])

  const filteredItems = cases?.items.filter((c) => {
    const matchesSearch = c.label.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterStatus === "ALL" || c.status.toUpperCase() === filterStatus
    return matchesSearch && matchesFilter
  }) ?? []

  return (
    <AppShell>
      <div className="flex h-full w-full overflow-hidden bg-black">
        {/* Left Clinical Sidebar Navigation */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col overflow-y-auto border-r border-neutral-800 bg-[#080808] p-4 text-xs font-mono">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-2.5 font-bold">
                Worklist Navigation
              </p>
              <div className="space-y-1.5">
                <button
                  onClick={() => setFilterStatus("ALL")}
                  className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                    filterStatus === "ALL"
                      ? "bg-[#141414] text-white border border-neutral-700 shadow-sm"
                      : "text-neutral-400 hover:bg-[#121212] hover:text-white"
                  }`}
                >
                  <span className="font-semibold">Active Cohort</span>
                  <span className="rounded-lg bg-[#202020] px-2 py-0.5 text-[11px] font-bold text-cyan-400">
                    {cases?.total ?? 0}
                  </span>
                </button>
                <button
                  onClick={() => setFilterStatus("READY")}
                  className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                    filterStatus === "READY"
                      ? "bg-[#141414] text-white border border-neutral-700 shadow-sm"
                      : "text-neutral-400 hover:bg-[#121212] hover:text-white"
                  }`}
                >
                  <span>Ready for Review</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </button>
              </div>
            </div>

            <div className="border-t border-neutral-850 pt-4">
              <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-2.5 font-bold">
                Diagnostic Modalities
              </p>
              <div className="space-y-2.5 text-[11.5px] text-neutral-300">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">MP-MRI Anatomical</span>
                  <span className="text-white font-semibold">T1, T1c, T2, FLAIR</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Volume Format</span>
                  <span className="text-cyan-400 font-semibold">NIfTI (3D)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Genomic Targets</span>
                  <span className="text-white font-semibold">IDH, 1p19q, MGMT</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-[#0d0d0d] p-3.5 text-[11px] text-neutral-400 space-y-1.5 leading-relaxed">
              <span className="font-bold text-slate-200 block">PACS Workstation</span>
              <p>Adult diffuse glioma cohort derived from UCSF-PDGM. Clinical decision support only.</p>
            </div>
          </div>
        </aside>

        {/* Main Worklist Content Stage: Exactly 100vh bounded, internal table scrollable */}
        <main className="flex flex-1 flex-col overflow-hidden p-4 lg:p-6 space-y-4 bg-black">
          {/* Header Stats Bar */}
          <div className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-850 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-white tracking-tight">
                  Patient Cohort Worklist
                </h1>
                <span className="rounded-full bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  PACS ACTIVE
                </span>
              </div>
              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                Clinical review workstation · WHO 2021 CNS Molecular Taxonomy
              </p>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <button
                onClick={() => setShowData((v) => !v)}
                aria-expanded={showData}
                className="rounded-xl border border-neutral-800 bg-[#101010] px-3.5 py-1.5 text-neutral-300 hover:text-white cursor-pointer"
              >
                {showData ? "Hide" : "Training data & fairness"}
              </button>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#101010] px-3.5 py-1.5 text-neutral-300">
                <span className="text-neutral-400">Active Cases:</span>
                <span className="font-bold text-white">{filteredItems.length}</span>
              </div>
            </div>
          </div>

          {showData && <DataCard />}

          {/* Quick Filter Search Bar */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by Patient ID (e.g. UCSF-PDGM-0027)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-[#0e0e0e] py-2 pl-10 pr-4 text-xs font-mono text-white placeholder-neutral-500 transition-all focus:border-neutral-600 focus:bg-[#141414] focus:outline-none"
              />
            </div>
          </div>

          {error !== null && (
            <div className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3">
              <ErrorNotice error={error} />
            </div>
          )}

          {/* High-Density PACS Worklist Table: Pure Black with Neutral Dark Rows */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808] shadow-2xl">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="sticky top-0 z-10 border-b border-neutral-800 bg-[#111111] text-[10.5px] uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Patient / Case ID</th>
                    <th className="py-3 px-4">Age</th>
                    <th className="py-3 px-4">Sex</th>
                    <th className="py-3 px-4">Study Source</th>
                    <th className="py-3 px-4">Modality</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredItems.map((c) => (
                    <tr
                      key={c.id}
                      className="group transition-colors hover:bg-[#121212]"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[10.5px] font-medium text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {c.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-white group-hover:text-cyan-400 transition-colors">
                        <Link to={`/cases/${c.id}`} className="hover:underline">
                          {c.label}
                        </Link>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-neutral-300">
                        <span className="font-semibold text-white mr-1.5">{c.age.value ?? "—"}</span>
                        <ProvenanceBadge provenance={c.age.provenance} />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-neutral-300">
                        <span className="font-semibold text-white mr-1.5">{c.sex.value ?? "—"}</span>
                        <ProvenanceBadge provenance={c.sex.provenance} />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-neutral-400">
                        {c.kind === "demo" ? "Held-out test cohort" : "Uploaded study"}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-neutral-300">
                        <span className="rounded-lg bg-[#141414] px-2 py-0.5 text-[10px] text-cyan-400 border border-neutral-750">
                          MP-MRI 3D
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <Link
                          to={`/cases/${c.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#141414] px-3.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-all hover:border-cyan-500/60 hover:bg-[#1f1f1f] hover:text-white"
                        >
                          <span>Open Case</span>
                          <span className="text-cyan-400">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-neutral-400">
                        No matching patient studies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  )
}
