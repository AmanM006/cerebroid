const pct = (p: number) => `${Math.round(p * 100)}%`

/**
 * How likely the call is, in words, over a bar running from the negative result (left)
 * to the positive one (right): the band is the spread across the model panel, the tick
 * is the panel's median.
 */
export function ProbabilityRange({ min, median, max, positiveLabel, negativeLabel, call, muted = false }: {
  min: number
  median: number
  max: number
  positiveLabel: string
  negativeLabel: string
  call: string | null
  muted?: boolean
}) {
  const positive = call === positiveLabel
  const likelihood = positive ? median : 1 - median
  const [low, high] = positive ? [min, max] : [1 - max, 1 - min]
  return (
    <div className="space-y-1.5">
      <p className={`font-mono text-xs ${muted ? "text-neutral-300" : "text-neutral-200"}`}>
        <span className="text-base font-bold text-white">{pct(likelihood)}</span> likely {call}
        <span className="ml-1.5 text-xs text-neutral-400 font-medium">(models range {pct(low)}–{pct(high)})</span>
      </p>
      <div
        className="relative h-3 rounded-full bg-neutral-800/80 border border-neutral-600 shadow-inner overflow-hidden"
        role="img"
        aria-label={`Probability ${positiveLabel}: ${pct(min)} to ${pct(max)}, median ${pct(median)}`}
      >
        {/* Subtle center line at 50% decision boundary */}
        <div className="absolute inset-y-0 w-0.5 bg-neutral-500 z-10" style={{ left: "50%" }} />
        
        {/* Uncertainty Spread across models */}
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-cyan-600/70 via-cyan-400/80 to-cyan-500/70 border border-cyan-300/40 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
          style={{ left: `${min * 100}%`, width: `${Math.max((max - min) * 100, 2)}%` }}
        />
        
        {/* Median indicator needle */}
        <div 
          className="absolute -inset-y-0.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)] z-20 border border-neutral-900" 
          style={{ left: `calc(${median * 100}% - 3px)` }} 
        />
      </div>
      <div className="flex justify-between font-mono text-xs font-semibold uppercase tracking-wider text-neutral-300">
        <span>{negativeLabel}</span>
        <span>{positiveLabel}</span>
      </div>
    </div>
  )
}
