import { MARKER_LABELS, type MarkerName } from "../api/types"

export type KnownResults = Partial<Record<MarkerName, 0 | 1>>

const MARKERS: MarkerName[] = ["IDH", "1p19q", "MGMT", "GRADE"]

/** Lab results the clinician already has. A known marker is shown as entered, never predicted. */
export function KnownResultsForm({ value, onChange, disabled }: {
  value: KnownResults
  onChange: (next: KnownResults) => void
  disabled?: boolean
}) {
  function set(marker: MarkerName, choice: string) {
    const next = { ...value }
    if (choice === "") delete next[marker]
    else next[marker] = choice === "1" ? 1 : 0
    onChange(next)
  }

  return (
    <fieldset className="space-y-2.5 rounded-xl border border-[#1b1926] bg-[#0c0a13] p-3" disabled={disabled}>
      <legend className="px-1 text-[10.5px] font-mono uppercase tracking-wider text-[#8c889e]">
        Prior Known Lab Results
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {MARKERS.map((marker) => (
          <label key={marker} className="block text-[11px] font-mono text-[#a9a4be]">
            <span className="block mb-1 text-[10.5px] text-[#716c87]">{MARKER_LABELS[marker].title}</span>
            <select
              className="w-full rounded-lg border border-[#232030] bg-[#14121d] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#38334d]"
              value={value[marker] === undefined ? "" : String(value[marker])}
              onChange={(e) => set(marker, e.target.value)}
            >
              <option value="">Not known</option>
              <option value="1">{MARKER_LABELS[marker].positive}</option>
              <option value="0">{MARKER_LABELS[marker].negative}</option>
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
