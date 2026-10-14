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
  if (item.curve.length===0) return 0
  let best=0
  item.curve.forEach((p, i)=>{
    if (Math.abs(p.value-value)<Math.abs(item.curve[best]!.value-value)) best=i
  })
  return best
}

/** One input: the tipping sentence plus a slider that shows the call at any plausible value. */
function TippingRow({ item, marker }: { item: TippingItem; marker: MarkerName }) {
  const [index, setIndex]=useState(()=>nearestIndex(item, item.current))
  if (item.curve.length===0) return null
  const safeIndex=Math.min(Math.max(0, index), item.curve.length-1)
  const point=item.curve[safeIndex]!
  const labels=MARKER_LABELS[marker]
  const call=point.positive_fraction>=0.5 ? labels.positive : labels.negative
  const share=Math.round(Math.max(point.positive_fraction, 1-point.positive_fraction)*100)

  return (
    <li className="space-y-1 font-mono text-[10.5px]">
      <p className="text-[#c9c5d8]">
        {item.label}: <span className="text-white">{format(item, item.current)}</span>
        {item.flip_at!=null ? (
          <span className="text-amber-200"> · flips to {item.flips_to} at {format(item, item.flip_at)}</span>
        ) : (
          <span className="text-emerald-300"> · no plausible value flips this call</span>
        )}
      </p>
      <input
        type="range"
        min={0}
        max={item.curve.length-1}
        value={safeIndex}
        onChange={(e)=>setIndex(Number(e.target.value))}
        aria-label={`Try another ${item.label.toLowerCase()}`}
        className="h-1 w-full cursor-pointer accent-cyan-400"
      />
      <p className="text-[9.5px] text-[#716c87]">
        At {format(item, point.value)}: <span className="capitalize text-[#c9c5d8]">{call}</span> ({share}% of models)
      </p>
    </li>
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

  return (
    <div className="space-y-2">
      <ul className="space-y-2.5">
        {tipping.items.map((item)=>(
          <TippingRow key={`${item.input}:${item.current}:${item.flip_at}`} item={item} marker={marker} />
        ))}
      </ul>
      <p className="border-t border-[#1e1b2b] pt-1.5 font-mono text-[9.5px] text-[#615c75]" title={tipping.method}>
        Everything else held fixed. Shows how sensitive the models are, not what would change the tumor.
      </p>
    </div>
  )
}
