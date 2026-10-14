import { useEffect, useState } from "react"
import { api } from "../api/client"
import { MARKER_LABELS, type MarkerName, type Tipping, type TippingItem } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"

function format(item: TippingItem, value: number): string {
  if (item.unit==="years") return `${Math.round(value)} years`
  if (item.unit==="fraction") return `${Math.round(value*100)}%`
  if (item.unit==="mm³") return `${(value/1000).toFixed(1)} cm³`
  return value.toFixed(2)
}

function nearestIndex(item: TippingItem, value: number): number {
  let best=0
  item.curve.forEach((p, i)=>{
    if (Math.abs(p.value-value)<Math.abs(item.curve[best]!.value-value)) best=i
  })
  return best
}

/** Age: a slider showing the call at any age, with the flip point marked in words. */
function AgeSlider({ item, marker }: { item: TippingItem; marker: MarkerName }) {
  const [index, setIndex]=useState(()=>nearestIndex(item, item.current))
  const point=item.curve[index]!
  const labels=MARKER_LABELS[marker]
  const call=point.positive_fraction>=0.5 ? labels.positive : labels.negative
  return (
    <div className="space-y-1">
      <input
        type="range"
        min={0}
        max={item.curve.length-1}
        value={index}
        onChange={(e)=>setIndex(Number(e.target.value))}
        aria-label="Try another age"
        className="h-1 w-full cursor-pointer accent-cyan-400"
      />
      <p className="text-[10.5px] text-[#8c889e]">
        Try it: at {format(item, point.value)} the call would be <span className="capitalize text-white">{call}</span>
      </p>
    </div>
  )
}

/** "What would flip it?": model sensitivity to inputs a clinician can verify. */
export function TippingView({
  studyId,
  marker,
  known,
}: {
  studyId: string
  marker: MarkerName
  known: Partial<Record<MarkerName, 0 | 1>>
}) {
  const [result, setResult]=useState<{ key: string; tipping: Tipping | null; error: unknown } | null>(null)
  const key=JSON.stringify([studyId, marker, known])

  useEffect(()=>{
    let cancelled=false
    api.getTipping(studyId, marker, known)
      .then((tipping)=>!cancelled && setResult({ key, tipping, error: null }))
      .catch((error)=>!cancelled && setResult({ key, tipping: null, error }))
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, marker, known])

  if (result?.key!==key) return <p className="font-mono text-[10.5px] text-[#716c87]">Testing what would flip this call…</p>
  if (result.error!==null) return <ErrorNotice error={result.error} />
  const tipping=result.tipping
  if (!tipping) return null

  const flips=tipping.items.filter((i)=>i.flip_at!=null)
  const age=tipping.items.find((i)=>i.input==="age")
  return (
    <div className="space-y-2 font-mono text-[11px]" title={tipping.method}>
      {flips.length===0 ? (
        <p className="text-emerald-300">● No realistic change to age or tumor size/shape flips this call.</p>
      ) : (
        <ul className="space-y-1">
          {flips.map((i)=>(
            <li key={i.input} className="text-[#c9c5d8]">
              {i.label} {format(i, i.current)} → <span className="text-amber-200">{i.flips_to}</span> at {format(i, i.flip_at!)}
            </li>
          ))}
        </ul>
      )}
      {age && <AgeSlider item={age} marker={marker} />}
      <p className="text-[9.5px] text-[#615c75]">Everything else held fixed · model sensitivity, not cause</p>
    </div>
  )
}
