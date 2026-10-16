import { useState } from "react"

/**
 * The rules for using Cerebroid in a clinic, shown next to the results they govern.
 * Every warning named here is one the app itself displays on the marker cards.
 */
const USE_FOR=[
  "Planning surgery before any tissue exists",
  "Choosing which lab test to order first",
  "A documented second read for the tumor board",
]

const NEVER=[
  "Skip or delay a biopsy or lab test because of a result",
  "Treat on Cerebroid alone, even when no biopsy is possible",
  "Watch and wait on \"Grade 2–3\": grade 4 is never ruled out without tissue",
]

const STOP_WHEN: { badge: string; tone: string; meaning: string }[]=[
  { badge: "⚠ Unlike training scans", tone: "border-rose-800/80 bg-rose-950/40 text-rose-200", meaning: "do not rely on the AI; refer" },
  { badge: "Contested · Arbitrary", tone: "border-amber-800/60 bg-amber-950/30 text-amber-200", meaning: "models disagree; confirm with tissue" },
  { badge: "◐ Close call", tone: "border-amber-800/60 bg-amber-950/30 text-amber-200", meaning: "models agree on a near coin flip; confirm" },
  { badge: "MRI can't tell", tone: "border-neutral-700 bg-neutral-900 text-neutral-300", meaning: "no signal; order the lab test" },
  { badge: "⚠ Grade 4 not ruled out", tone: "border-rose-800/80 bg-rose-950/40 text-rose-200", meaning: "treat as possible grade 4" },
]

const STORAGE_KEY="cerebroid_safe_use_hidden"

function initiallyHidden(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY)==="1"
  } catch {
    return false
  }
}

export function SafeUsePanel() {
  const [hidden, setHidden]=useState(initiallyHidden)

  const toggle=()=>{
    const next=!hidden
    setHidden(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
    } catch {
      // Storage unavailable (private window): the choice lasts for this page only.
    }
  }

  return (
    <section aria-labelledby="safe-use-title" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="safe-use-title" className="font-mono text-xs font-bold uppercase tracking-wider text-white">
          How to use Cerebroid safely
          <span className="ml-2 normal-case tracking-normal font-semibold text-emerald-300">The lab result always wins.</span>
        </h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!hidden}
          className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 font-mono text-[11px] text-neutral-400 hover:text-white"
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>

      {!hidden && (
        <div className="mt-3 grid grid-cols-1 gap-4 text-[12.5px] md:grid-cols-3">
          <div>
            <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-300">✓ Use it for</p>
            <ul className="space-y-1 text-neutral-200">
              {USE_FOR.map((t)=><li key={t}>{t}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300">✕ Never</p>
            <ul className="space-y-1 text-neutral-200">
              {NEVER.map((t)=><li key={t}>{t}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-300">⚑ Stop and confirm when you see</p>
            <ul className="space-y-1.5">
              {STOP_WHEN.map((s)=>(
                <li key={s.badge} className="flex flex-wrap items-center gap-1.5 text-neutral-300">
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${s.tone}`}>{s.badge}</span>
                  <span>{s.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-2 font-mono text-[10.5px] text-neutral-500">
        Research decision-support prototype. Not a diagnostic device.
      </p>
    </section>
  )
}
