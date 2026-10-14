import { useEffect, useMemo, useState } from "react"
import { api } from "../api/client"
import type { MriSequence } from "../api/types"
import { ErrorNotice } from "./ErrorNotice"
import { RealNiiVueViewport, type LoadedVolume, type SliceMode } from "./RealNiiVueViewport"

export type Plane2D="sagittal" | "axial" | "coronal"

const SEQUENCE_LABELS: Record<Exclude<MriSequence, "seg">, string>={
  t1c: "T1 contrast",
  flair: "FLAIR",
  t2: "T2",
  t1: "T1",
}
// Contrast-enhanced T1 shows the enhancing rim best, so it opens first when present.
const DISPLAY_ORDER: Exclude<MriSequence, "seg">[]=["t1c", "flair", "t2", "t1"]

type Loaded={ key: string; volumes: LoadedVolume[]; available: MriSequence[]; error: unknown }

export function ClinicalMriStudio({
  studyId,
  leftComponent="3d",
  onSwap,
}: {
  studyId: string
  leftComponent?: "2d" | "3d"
  onSwap?: ()=>void
}) {
  const [selectedPlane, setSelectedPlane]=useState<Plane2D>("axial")
  const [contrast, setContrast]=useState(115)
  const [brightness, setBrightness]=useState(105)
  const [mri3dMode, setMri3dMode]=useState<SliceMode>("multiplanar")
  const [chosen, setChosen]=useState<MriSequence | null>(null)
  const [showTumor, setShowTumor]=useState(true)

  // Each result remembers which request it answers, so a stale load never shows for a newer one.
  const [loaded, setLoaded]=useState<Loaded | null>(null)
  const key=JSON.stringify([studyId, chosen])

  useEffect(()=>{
    let cancelled=false
    ;(async ()=>{
      try {
        const { sequences }=await api.listVolumes(studyId)
        const display=chosen && sequences.includes(chosen) ? chosen : DISPLAY_ORDER.find((s)=>sequences.includes(s))
        const volumes: LoadedVolume[]=[]
        if (display) {
          volumes.push({ name: `${display}.nii.gz`, data: await api.volume(studyId, display) })
          if (sequences.includes("seg")) {
            volumes.push({ name: "seg.nii.gz", data: await api.volume(studyId, "seg"), colormap: "warm", opacity: 0.45 })
          }
        }
        if (!cancelled) setLoaded({ key, volumes, available: sequences, error: null })
      } catch (error) {
        if (!cancelled) setLoaded({ key, volumes: [], available: [], error })
      }
    })()
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, chosen])

  const loading=loaded?.key!==key
  const anatomical=loaded?.available.filter((s): s is Exclude<MriSequence, "seg">=>s!=="seg") ?? []
  const current=loaded?.volumes[0]?.name.replace(".nii.gz", "") as Exclude<MriSequence, "seg"> | undefined
  const volumes=useMemo(
    ()=>(loaded?.volumes ?? []).map((v)=>(v.name==="seg.nii.gz" ? { ...v, opacity: showTumor ? 0.45 : 0 } : v)),
    [loaded, showTumor],
  )

  const sequencePicker=anatomical.length>0 && (
    <div className="flex items-center gap-1">
      {anatomical.map((s)=>(
        <button
          key={s}
          onClick={()=>setChosen(s)}
          className={`rounded-lg px-2 py-0.5 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
            current===s ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-bold" : "text-neutral-400 hover:text-white"
          }`}
        >
          {SEQUENCE_LABELS[s]}
        </button>
      ))}
      {loaded?.available.includes("seg") && (
        <button
          onClick={()=>setShowTumor((v)=>!v)}
          aria-pressed={showTumor}
          className={`ml-1 rounded-lg px-2 py-0.5 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
            showTumor ? "bg-orange-950/80 text-orange-300 border border-orange-800/80 font-bold" : "text-neutral-400 hover:text-white"
          }`}
        >
          Tumor overlay
        </button>
      )}
    </div>
  )

  const stage=(mode: SliceMode, style?: React.CSSProperties)=>{
    if (loaded?.error) {
      return <div className="p-4"><ErrorNotice error={loaded.error} /></div>
    }
    if (!loading && volumes.length===0) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center font-mono text-xs text-neutral-500">
          No MRI volumes are stored for this case.
        </div>
      )
    }
    if (loading && volumes.length===0) {
      return (
        <div className="flex h-full items-center justify-center font-mono text-xs text-cyan-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mr-2.5" />
          Downloading volumes…
        </div>
      )
    }
    return (
      <div className={`h-full w-full ${loading ? "opacity-60" : ""}`} style={style}>
        <RealNiiVueViewport volumes={volumes} sliceType={mode} />
      </div>
    )
  }

  const swapGrip=(dot: string, title: string)=>(
    <div onClick={onSwap} className="flex items-center gap-2 cursor-pointer group" title="Click to swap position">
      <span className="text-neutral-500 group-hover:text-cyan-400 font-bold transition-colors">⠿</span>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors">{title}</span>
      <span className="text-[10px] text-neutral-500 rounded bg-[#181818] px-1.5 py-0.5 border border-neutral-800">
        [Click to Swap]
      </span>
    </div>
  )

  const render2DPanel=()=>(
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808]">
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-2 text-[11px] font-mono select-none">
        {swapGrip("bg-cyan-400 animate-pulse", "2D Slice")}
        <div className="flex items-center gap-1.5">
          {(["sagittal", "axial", "coronal"] as const).map((plane)=>(
            <button
              key={plane}
              onClick={()=>setSelectedPlane(plane)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                selectedPlane===plane
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {plane}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 bg-black">
        {stage(selectedPlane, { filter: `contrast(${contrast}%) brightness(${brightness}%)` })}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3.5 py-2 text-[10.5px] font-mono text-neutral-400">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Contrast:</span>
            <input type="range" min="70" max="160" value={contrast}
              onChange={(e)=>setContrast(Number(e.target.value))} className="h-1 w-16 cursor-pointer accent-cyan-400" />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Bright:</span>
            <input type="range" min="70" max="150" value={brightness}
              onChange={(e)=>setBrightness(Number(e.target.value))} className="h-1 w-16 cursor-pointer accent-cyan-400" />
          </label>
        </div>
        <span className="text-neutral-500">{current ? SEQUENCE_LABELS[current] : "—"}</span>
      </div>
    </div>
  )

  const render3DPanel=()=>(
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808]">
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-2 text-[11px] font-mono select-none">
        {swapGrip("bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]", "3D Volume")}
        <div className="flex items-center gap-1">
          {(["multiplanar", "render3d", "axial", "sagittal"] as const).map((m)=>(
            <button
              key={m}
              onClick={()=>setMri3dMode(m)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                mri3dMode===m
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {m==="render3d" ? "3D Vol" : m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 bg-black">{stage(mri3dMode)}</div>

      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3.5 py-2 text-[10.5px] font-mono text-neutral-400">
        {sequencePicker || <span />}
        <span className="text-cyan-400">Click &amp; drag crosshair · Scroll to scrub slices</span>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-full w-full gap-3 overflow-hidden bg-black p-1">
      {leftComponent==="3d" ? (
        <>
          {render3DPanel()}
          {render2DPanel()}
        </>
      ) : (
        <>
          {render2DPanel()}
          {render3DPanel()}
        </>
      )}
    </div>
  )
}
