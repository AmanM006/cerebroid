import { useEffect, useRef, useState } from "react"
import { Niivue } from "@niivue/niivue"
import { ErrorNotice } from "./ErrorNotice"

/** A volume already fetched through the authenticated API client. */
export interface LoadedVolume {
  /** File name; the extension tells NiiVue the format (e.g. "t1c.nii.gz"). */
  name: string
  data: ArrayBuffer
  colormap?: string
  opacity?: number
}

export type SliceMode="multiplanar" | "axial" | "coronal" | "sagittal" | "render3d"

function nameMatchingBytes(name: string, buffer: ArrayBuffer): string {
  const bytes=new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))
  const gzipped=bytes[0]===0x1f && bytes[1]===0x8b
  return !gzipped && name.endsWith(".gz") ? name.slice(0, -3) : name
}

const COLORMAPS=[
  { id: "gray", label: "Gray", color: "#9ca3af" },
  { id: "red", label: "Red", color: "#ef4444" },
  { id: "hot", label: "Thermal", color: "#f97316" },
  { id: "copper", label: "Copper", color: "#b45309" },
  { id: "plasma", label: "Plasma", color: "#a855f7" },
]

function applySliceType(nv: Niivue, mode: SliceMode) {
  const types: Record<SliceMode, number>={
    render3d: nv.sliceTypeRender,
    axial: nv.sliceTypeAxial,
    sagittal: nv.sliceTypeSagittal,
    coronal: nv.sliceTypeCoronal,
    multiplanar: nv.sliceTypeMultiplanar,
  }
  nv.setSliceType(types[mode])
}

export function RealNiiVueViewport({
  volumes,
  sliceType="multiplanar",
  overlayOpacity=0.45,
}: {
  volumes: LoadedVolume[]
  sliceType?: SliceMode
  /** Opacity of the second volume (the tumor segmentation); 0 hides it. */
  overlayOpacity?: number
}) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const nvRef=useRef<Niivue | null>(null)
  const sliceTypeRef=useRef(sliceType)
  const [state, setState]=useState<"loading" | "ready" | "error">("loading")
  const [error, setError]=useState<unknown>(null)
  const [colormap, setColormap]=useState("gray")

  const colormapRef=useRef(colormap)
  useEffect(()=>{
    sliceTypeRef.current=sliceType
    colormapRef.current=colormap
  }, [sliceType, colormap])

  useEffect(()=>{
    const canvas=canvasRef.current
    if (!canvas || volumes.length===0) return

    let cancelled=false

    const nv=new Niivue({
      backColor: [0, 0, 0, 1],
      show3Dcrosshair: true,
      crosshairColor: [0, 0.85, 0.95, 0.8],
      dragMode: 1,
      isColorbar: false,
      textHeight: 0.03,
    })
    nvRef.current=nv

    ;(async ()=>{
      try {
        await nv.attachToCanvas(canvas)
        for (const [i, v] of volumes.entries()) {
          // NiiVue may take ownership of the buffer, and the same volume feeds both panels.
          const data=v.data.slice(0)
          await nv.loadFromArrayBuffer(data, nameMatchingBytes(v.name, data))
          if (cancelled) return
          const volume=nv.volumes[i]
          if (volume) {
            volume.colormap=i===0 ? colormapRef.current : (v.colormap ?? "gray")
            volume.opacity=v.opacity ?? 1
          }
        }
        nv.updateGLVolume()
        applySliceType(nv, sliceTypeRef.current)
        if (!cancelled) setState("ready")
      } catch (err) {
        if (!cancelled) {
          setError(err)
          setState("error")
        }
      }
    })()

    // Keeps the WebGL canvas sharp when panels are resized or swapped.
    const ro=new ResizeObserver(()=>{
      nv.resizeListener()
      nv.drawScene()
    })
    ro.observe(canvas)

    return ()=>{
      cancelled=true
      ro.disconnect()
    }
  }, [volumes])

  // Changing projection reuses the loaded volumes instead of reloading them.
  useEffect(()=>{
    const nv=nvRef.current
    if (!nv || state!=="ready") return
    applySliceType(nv, sliceType)
    nv.drawScene()
  }, [sliceType, state])

  useEffect(()=>{
    const overlay=nvRef.current?.volumes[1]
    if (!overlay || state!=="ready") return
    nvRef.current!.setOpacity(1, overlayOpacity)
  }, [overlayOpacity, state])

  // Recolours the MRI on the GPU without reloading it.
  const changeColor=(cmap: string)=>{
    setColormap(cmap)
    const nv=nvRef.current
    const base=nv?.volumes[0]
    if (nv && base) {
      nv.setColormap(base.id, cmap)
      nv.updateGLVolume()
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {state==="ready" && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded-lg border border-neutral-800 bg-[#0c0c0c]/90 px-2 py-1 backdrop-blur-sm">
          <span className="font-mono text-[9px] text-neutral-400 mr-1">TISSUE:</span>
          {COLORMAPS.map((c)=>(
            <button
              key={c.id}
              onClick={()=>changeColor(c.id)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono transition-colors cursor-pointer ${
                colormap===c.id ? "bg-neutral-800 text-white font-bold border border-neutral-600" : "text-neutral-400 hover:text-white"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair touch-none"
        aria-label="MRI volume viewer"
      />
      {state==="loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 font-mono text-xs text-cyan-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mr-2.5" />
          Loading volume…
        </div>
      )}
      {state==="error" && (
        <div className="absolute inset-x-4 top-4">
          <ErrorNotice error={error} />
        </div>
      )}
    </div>
  )
}
