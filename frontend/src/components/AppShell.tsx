import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen w-full flex-col bg-black text-slate-100 antialiased selection:bg-neutral-800 selection:text-white">
      {/* Top Clinical Navigation Bar */}
      <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center justify-between border-b border-neutral-800 bg-[#0a0a0a]/95 px-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link to="/cases" className="flex items-center gap-2.5 group">
            <span className="font-heading text-lg font-black tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              Cerebroid
            </span>
            <span className="h-3.5 w-px bg-neutral-800" />
            <span className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase">
              Neuro-Oncology PACS
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-[#121212] px-3.5 py-1.5 text-xs text-neutral-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[11px] border border-emerald-500/30">
                Dr
              </span>
              <div className="flex flex-col text-left leading-tight">
                <span className="font-semibold text-white text-xs">
                  {user.username === "doctor" ? "Dr. Aaron Schader" : user.username}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono capitalize">
                  {user.role} · Neuro-Radiology
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => void logout()}
            className="rounded-xl border border-neutral-800 bg-[#121212] px-3 py-1.5 text-xs font-mono font-medium text-neutral-400 transition-all hover:border-neutral-600 hover:bg-[#1a1a1a] hover:text-white cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content Viewport: Scrolls naturally down as far as needed (100vh, 200vh, etc.) */}
      <main className="flex-1 bg-black">{children}</main>

      {/* Ground Footer at the bottom of the entire page */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-neutral-900 bg-[#080808] px-5 text-[11px] text-neutral-400 font-mono mt-auto">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="text-[10.5px]">WHO 2021 CNS Molecular Taxonomy · Virtual Molecular Biopsy</span>
        </div>
        <div className="flex items-center gap-4 text-[10.5px]">
          <span>Trained on UCSF-PDGM + TCGA (adult gliomas)</span>
          <span>Platt Calibration</span>
        </div>
      </footer>
    </div>
  )
}
