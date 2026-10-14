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
}: {
  volumes: LoadedVolume[]
  sliceType?: SliceMode
}) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const nvRef=useRef<Niivue | null>(null)
  const sliceTypeRef=useRef(sliceType)
  const [state, setState]=useState<"loading" | "ready" | "error">("loading")
  const [error, setError]=useState<unknown>(null)

  useEffect(()=>{
    sliceTypeRef.current=sliceType
  }, [sliceType])

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
            volume.colormap=v.colormap ?? "gray"
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

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
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
