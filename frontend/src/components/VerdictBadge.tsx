import type { Verdict } from "../api/types"

// Icon + word + colour, so the verdict never depends on colour alone.
const STYLE: Record<Verdict, { icon: string; text: string; hint: string; tone: string }>={
  STABLE: {
    icon: "●", text: "Stable", hint: "Nearly all equally good models agree",
    tone: "border-emerald-700 bg-emerald-950/50 text-emerald-300",
  },
  CONTESTED: {
    icon: "◐", text: "Contested", hint: "Equally good models disagree",
    tone: "border-amber-700 bg-amber-950/50 text-amber-300",
  },
  ARBITRARY: {
    icon: "○", text: "Arbitrary", hint: "The model panel is split close to 50/50",
    tone: "border-rose-700 bg-rose-950/50 text-rose-300",
  },
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const s=STYLE[verdict]
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${s.tone}`} title={s.hint}>
      <span aria-hidden="true">{s.icon}</span>
      {s.text}
    </span>
  )
}
