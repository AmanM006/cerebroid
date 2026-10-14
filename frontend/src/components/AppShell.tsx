import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout }=useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <Link to="/cases" className="font-semibold tracking-wide">VBX</Link>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {user && (
            <span>
              {user.username} · {user.role}
              {user.is_synthetic && " · synthetic account"}
            </span>
          )}
          <button onClick={()=>void logout()} className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
        Research decision-support prototype. Not a diagnostic device. Trained on public de-identified data.
      </footer>
    </div>
  )
}
