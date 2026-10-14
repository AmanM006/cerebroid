import type { Verdict } from "../api/types"

// Icon + word + colour, so the verdict never depends on colour alone.
const STYLE: Record<Verdict, { icon: string; text: string; hint: string; tone: string }> = {
  STABLE: {
    icon: "●", text: "Stable", hint: "Nearly all equally good models agree",
    tone: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300 font-mono",
  },
  CONTESTED: {
    icon: "◐", text: "Contested", hint: "Equally good models disagree",
    tone: "border-amber-800/60 bg-amber-950/30 text-amber-300 font-mono",
  },
  ARBITRARY: {
    icon: "○", text: "Arbitrary", hint: "The model panel is split close to 50/50",
    tone: "border-rose-800/60 bg-rose-950/30 text-rose-300 font-mono",
  },
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const s = STYLE[verdict]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${s.tone}`} title={s.hint}>
      <span aria-hidden="true">{s.icon}</span>
      {s.text}
    </span>
  )
}
