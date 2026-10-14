import { MARKER_LABELS, type MarkerName } from "../api/types"

export type KnownResults=Partial<Record<MarkerName, 0 | 1>>

const MARKERS: MarkerName[]=["IDH", "1p19q", "MGMT", "GRADE"]

/** Lab results the clinician already has. A known marker is shown as entered, never predicted. */
export function KnownResultsForm({ value, onChange, disabled }: {
  value: KnownResults
  onChange: (next: KnownResults)=>void
  disabled?: boolean
}) {
  function set(marker: MarkerName, choice: string) {
    const next={ ...value }
    if (choice==="") delete next[marker]
    else next[marker]=choice==="1" ? 1 : 0
    onChange(next)
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Known lab results</legend>
      <div className="grid grid-cols-2 gap-2">
        {MARKERS.map((marker)=>(
          <label key={marker} className="text-xs text-slate-300">
            {MARKER_LABELS[marker].title}
            <select
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
              value={value[marker]===undefined ? "" : String(value[marker])}
              onChange={(e)=>set(marker, e.target.value)}
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
