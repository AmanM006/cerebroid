const pct = (p: number) => `${Math.round(p * 100)}%`

export function ProbabilityRange({ min, median, max, positiveLabel }: {
  min: number
  median: number
  max: number
  positiveLabel: string
}) {
  return (
    <div>
      <div
        className="relative h-2 rounded-full bg-[#181624] border border-[#262335]"
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
      <p className="mt-1.5 font-mono text-[10.5px] text-[#8c889e]">
        P({positiveLabel}) {pct(min)}–{pct(max)} · median <span className="text-white font-semibold">{pct(median)}</span>
      </p>
    </div>
  )
}
