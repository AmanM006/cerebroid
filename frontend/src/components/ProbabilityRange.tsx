/**
 * The spread of P(positive class) across the model panel: a band from the lowest
 * to the highest model, a tick at the median, and the 50% decision line. A band,
 * not a single number, so the display never looks more precise than the panel is.
 */
const pct=(p: number)=>`${Math.round(p*100)}%`

export function ProbabilityRange({ min, median, max, positiveLabel }: {
  min: number
  median: number
  max: number
  positiveLabel: string
}) {
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-slate-800" role="img"
        aria-label={`Probability ${positiveLabel}: ${pct(min)} to ${pct(max)}, median ${pct(median)}`}>
        <div className="absolute inset-y-0 w-px bg-slate-500" style={{ left: "50%" }} />
        <div className="absolute inset-y-0 rounded-full bg-sky-600/60"
          style={{ left: `${min*100}%`, width: `${Math.max((max-min)*100, 1)}%` }} />
        <div className="absolute -inset-y-0.5 w-0.5 rounded bg-sky-200" style={{ left: `${median*100}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        P({positiveLabel}) {pct(min)}–{pct(max)} · median {pct(median)}
      </p>
    </div>
  )
}
