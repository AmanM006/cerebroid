/**
 * NiiVue WebGL viewer. Volumes are downloaded through the API client (so the
 * request is authenticated and an expired token is refreshed), then handed to
 * NiiVue as in-memory buffers. The first volume is the anatomy; later ones are
 * drawn on top as overlays, e.g. the tumor segmentation.
 */
import { useEffect, useRef, useState } from "react"
import { Niivue } from "@niivue/niivue"
import { api } from "../api/client"
import { ErrorNotice } from "./ErrorNotice"

export interface ViewerVolume {
  /** File name; the extension tells NiiVue the format (e.g. "t1c.nii.gz"). */
  name: string
  /** API path returning the raw file. */
  path: string
  colormap?: string
  opacity?: number
}

/**
 * Servers may send .nii.gz with Content-Encoding: gzip, in which case the browser
 * has already decompressed the bytes. NiiVue picks the decoder from the file name,
 * so the name must match what the bytes actually are.
 */
function nameMatchingBytes(name: string, buffer: ArrayBuffer): string {
  const bytes=new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))
  const gzipped=bytes[0]===0x1f && bytes[1]===0x8b
  return !gzipped && name.endsWith(".gz") ? name.slice(0, -3) : name
}

export function MriViewer({ volumes }: { volumes: ViewerVolume[] }) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const [state, setState]=useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError]=useState<unknown>(null)

  useEffect(()=>{
    const canvas=canvasRef.current
    if (!canvas || volumes.length===0) return
    let cancelled=false
    const nv=new Niivue({ backColor: [0.02, 0.03, 0.06, 1], show3Dcrosshair: true })

    ;(async ()=>{
      setState("loading")
      try {
        await nv.attachToCanvas(canvas)
        const buffers=await Promise.all(volumes.map((v)=>api.getBytes(v.path)))
        if (cancelled) return
        // loadVolumes() re-downloads by URL (unauthenticated) even when given a
        // buffer, so in-memory bytes go through loadFromArrayBuffer instead.
        for (const [i, v] of volumes.entries()) {
          await nv.loadFromArrayBuffer(buffers[i]!, nameMatchingBytes(v.name, buffers[i]!))
          if (cancelled) return
          const volume=nv.volumes[i]
          if (volume) {
            volume.colormap=v.colormap ?? "gray"
            volume.opacity=v.opacity ?? 1
          }
        }
        nv.updateGLVolume()
        nv.setSliceType(nv.sliceTypeMultiplanar)
        if (!cancelled) setState("ready")
      } catch (err) {
        if (!cancelled) {
          setError(err)
          setState("error")
        }
      }
    })()

    return ()=>{
      cancelled=true
    }
  }, [volumes])

  if (volumes.length===0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-sm text-slate-400">
        No imaging is attached to this case.
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-slate-800 bg-black">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="MRI viewer" />
      {state==="loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-slate-300">
          Loading volumes…
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
