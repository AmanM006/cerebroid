import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api/client"
import type { CaseList } from "../api/types"
import { AppShell } from "../components/AppShell"
import { ErrorNotice } from "../components/ErrorNotice"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

export function CasesPage() {
  const [cases, setCases]=useState<CaseList | null>(null)
  const [error, setError]=useState<unknown>(null)

  useEffect(()=>{
    api.listCases().then(setCases).catch(setError)
  }, [])

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <h1 className="text-lg font-semibold">Cases</h1>
        {error!==null && <ErrorNotice error={error} />}
        {!cases && error===null && <p className="text-sm text-slate-400">Loading cases…</p>}
        {cases && cases.items.length===0 && (
          <p className="text-sm text-slate-400">No cases are available to your account.</p>
        )}
        {cases && cases.items.length>0 && (
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
            {cases.items.map((c)=>(
              <li key={c.id}>
                <Link to={`/cases/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-900">
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.kind==="demo" ? "Demo case" : "Your upload"} · {c.status}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1.5">
                      Age {c.age.value ?? "—"} <ProvenanceBadge provenance={c.age.provenance} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      Sex {c.sex.value ?? "—"} <ProvenanceBadge provenance={c.sex.provenance} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  )
}
