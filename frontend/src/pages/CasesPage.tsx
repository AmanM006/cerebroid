import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import type { CaseList } from "../api/types"
import { AppShell } from "../components/AppShell"
import { DataCard } from "../components/DataCard"
import { UploadStudy } from "../components/UploadStudy"
import { ErrorNotice } from "../components/ErrorNotice"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

export function CasesPage() {
  const [cases, setCases] = useState<CaseList | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [showData, setShowData] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const reload = () => {
    api.listCases().then(setCases).catch(setError)
  }
  // Only the owner's uploads can be deleted (the server enforces it); demo cases have no button.
  const [deleting, setDeleting] = useState<string | null>(null)
  const deleteUpload = (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? Its MRI files and results are removed permanently.`)) return
    setDeleting(id)
    api.deleteUpload(id).then(reload).catch(setError).finally(() => setDeleting(null))
  }
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")

  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      // Auto-poll every 3s if any study is PROCESSING
      api.listCases().then((res) => {
        setCases(res)
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const processingCount = cases?.items.filter(c => c.status === "processing").length ?? 0
  const readyCount = cases?.items.filter(c => c.status === "ready").length ?? 0

  // Demo cases are shared by every account, so they are hidden per browser instead of deleted.
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cerebroid_hidden_cases") ?? "[]")
      return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []
    } catch {
      return []
    }
  })
  const [showHidden, setShowHidden] = useState(false)
  const saveHidden = (ids: string[]) => {
    setHidden(ids)
    try {
      localStorage.setItem("cerebroid_hidden_cases", JSON.stringify(ids))
    } catch {
      // Not remembered across visits; still hidden now.
    }
  }
  const hiddenCount = cases?.items.filter((c) => hidden.includes(c.id)).length ?? 0

  const filteredItems = cases?.items.filter((c) => {
    const matchesSearch = c.label.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterStatus === "ALL" || c.status.toUpperCase() === filterStatus
    return matchesSearch && matchesFilter && (showHidden || !hidden.includes(c.id))
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
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-md bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400">{readyCount}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  </span>
                </button>
                {processingCount > 0 && (
                  <button
                    onClick={() => setFilterStatus("PROCESSING")}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      filterStatus === "PROCESSING"
                        ? "bg-[#141414] text-white border border-amber-600/50 shadow-sm"
                        : "text-amber-400 hover:bg-[#121212]"
                    }`}
                  >
                    <span className="font-semibold">Processing / Ingesting</span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-md bg-amber-950/60 border border-amber-700/50 px-1.5 py-0.2 text-[10px] font-bold text-amber-300">{processingCount}</span>
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                    </span>
                  </button>
                )}
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
                onClick={() => setShowUpload((v) => !v)}
                aria-expanded={showUpload}
                className="rounded-xl border border-white bg-white px-3.5 py-1.5 font-bold text-black hover:bg-neutral-200 cursor-pointer"
              >
                {showUpload ? "Close upload" : "Upload MRI"}
              </button>
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
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowHidden((v) => !v)}
                  className="rounded-xl border border-neutral-800 bg-[#101010] px-3.5 py-1.5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showHidden ? "Hide removed" : `Show removed (${hiddenCount})`}
                </button>
              )}
            </div>
          </div>

          {showUpload && <UploadStudy onDone={reload} />}
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
                placeholder="Search by Patient ID (e.g. UCSF-PDGM-0018)..."
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
                        {c.status.toUpperCase() === "READY" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[10.5px] font-medium text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            READY
                          </span>
                        ) : c.status.toUpperCase() === "PROCESSING" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-2.5 py-0.5 text-[10.5px] font-medium text-amber-300 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            PROCESSING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-0.5 text-[10.5px] font-medium text-neutral-400">
                            {c.status.toUpperCase()}
                          </span>
                        )}
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
                        {c.kind === "upload" && (
                          <button
                            type="button"
                            onClick={() => deleteUpload(c.id, c.label)}
                            disabled={deleting === c.id || c.status === "processing"}
                            title={c.status === "processing" ? "Wait until processing has finished" : "Delete this upload"}
                            aria-label={`Delete ${c.label}`}
                            className="ml-2 inline-flex items-center rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-1.5 text-[11px] font-semibold text-rose-300 transition-all hover:border-rose-500/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                          >
                            {deleting === c.id ? "Deleting…" : "Delete"}
                          </button>
                        )}
                        {c.kind === "demo" && (
                          hidden.includes(c.id) ? (
                            <button
                              type="button"
                              onClick={() => saveHidden(hidden.filter((x) => x !== c.id))}
                              className="ml-2 inline-flex items-center rounded-xl border border-neutral-700 bg-[#141414] px-3 py-1.5 text-[11px] font-semibold text-neutral-300 hover:text-white cursor-pointer"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => saveHidden([...hidden, c.id])}
                              title="Remove from your list (demo cases are shared, so they are hidden, not deleted)"
                              aria-label={`Remove ${c.label} from your list`}
                              className="ml-2 inline-flex items-center rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-1.5 text-[11px] font-semibold text-rose-300 transition-all hover:border-rose-500/60 hover:text-rose-200 cursor-pointer"
                            >
                              Remove
                            </button>
                          )
                        )}
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
