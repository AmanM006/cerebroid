import type { Provenance } from "../api/types"

// Icon + text, never colour alone.
const LABELS: Record<Provenance, { icon: string; text: string; tone: string }> = {
  clinical_input: { icon: "✎", text: "Clinical", tone: "border-[#2b273d] bg-[#14121f] text-sky-300" },
  measured: { icon: "✓", text: "Measured", tone: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300" },
  model_inferred: { icon: "◆", text: "Inferred", tone: "border-[#38334e] bg-[#161423] text-indigo-300" },
  reference_cohort: { icon: "≈", text: "Cohort", tone: "border-amber-800/60 bg-amber-950/30 text-amber-300" },
  missing: { icon: "∅", text: "Missing", tone: "border-[#232030] bg-[#100f17] text-[#6d6883]" },
  synthetic: { icon: "⚠", text: "Synthetic", tone: "border-orange-800/60 bg-orange-950/30 text-orange-300" },
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const label = LABELS[provenance]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono leading-none ${label.tone}`}
      title={`Provenance: ${label.text}`}
    >
      <span aria-hidden="true">{label.icon}</span>
      {label.text}
    </span>
  )
}
