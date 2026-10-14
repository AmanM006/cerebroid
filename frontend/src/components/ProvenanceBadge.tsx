import type { Provenance } from "../api/types"

// Icon + text, never colour alone (CLAUDE.md §8 accessibility).
const LABELS: Record<Provenance, { icon: string; text: string; tone: string }>={
  clinical_input: { icon: "✎", text: "Clinical input", tone: "border-sky-800 text-sky-300" },
  measured: { icon: "✓", text: "Measured", tone: "border-emerald-800 text-emerald-300" },
  model_inferred: { icon: "◆", text: "Model-inferred", tone: "border-violet-800 text-violet-300" },
  reference_cohort: { icon: "≈", text: "Reference cohort", tone: "border-amber-800 text-amber-300" },
  missing: { icon: "∅", text: "Missing", tone: "border-slate-700 text-slate-400" },
  synthetic: { icon: "⚠", text: "Synthetic", tone: "border-orange-800 text-orange-300" },
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const label=LABELS[provenance]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-none ${label.tone}`}
      title={`Provenance: ${label.text}`}
    >
      <span aria-hidden="true">{label.icon}</span>
      {label.text}
    </span>
  )
}
