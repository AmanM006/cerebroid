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
        className="relative h-2.5 rounded-full bg-[#181624] border border-[#262335]"
        role="img"
        aria-label={`Probability ${positiveLabel}: ${pct(min)} to ${pct(max)}, median ${pct(median)}`}
      >
        <div className="absolute inset-y-0 w-px bg-[#3b364e]" style={{ left: "50%" }} />
        <div
          className="absolute inset-y-0 rounded-full bg-slate-400/50"
          style={{ left: `${min * 100}%`, width: `${Math.max((max - min) * 100, 1.5)}%` }}
        />
        <div className="absolute -inset-y-0.5 w-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]" style={{ left: `${median * 100}%` }} />
      </div>
      <div className="flex justify-between font-mono text-xs capitalize text-neutral-400 font-medium">
        <span>{negativeLabel}</span>
        <span>{positiveLabel}</span>
      </div>
    </div>
  )
}
