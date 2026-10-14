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

function nameMatchingBytes(name: string, buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  return !gzipped && name.endsWith(".gz") ? name.slice(0, -3) : name
}

export function MriViewer({ volumes }: { volumes: ViewerVolume[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || volumes.length === 0) return
    let cancelled = false
    const nv = new Niivue({ backColor: [0.03, 0.02, 0.04, 1], show3Dcrosshair: true })

    ;(async () => {
      setState("loading")
      try {
        await nv.attachToCanvas(canvas)
        const buffers = await Promise.all(volumes.map((v) => api.getBytes(v.path)))
        if (cancelled) return
        for (const [i, v] of volumes.entries()) {
          await nv.loadFromArrayBuffer(buffers[i]!, nameMatchingBytes(v.name, buffers[i]!))
          if (cancelled) return
          const volume = nv.volumes[i]
          if (volume) {
            volume.colormap = v.colormap ?? "gray"
            volume.opacity = v.opacity ?? 1
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

    return () => {
      cancelled = true
    }
  }, [volumes])

  if (volumes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#050409] p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#221f30] bg-[#12101b] text-[#6d6883] mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <p className="font-mono text-xs font-semibold text-slate-300">PACS Multiparametric Viewport</p>
        <p className="mt-1 font-mono text-[11px] text-[#615c75] max-w-xs">
          Select or load 3D multiparametric NIfTI volumes (T1, T1-Gd, T2, FLAIR) to activate multiplanar crosshair exploration.
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" aria-label="MRI viewer" />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 font-mono text-xs text-slate-300">
          Loading 3D imaging volumes…
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-x-4 top-4">
          <ErrorNotice error={error} />
        </div>
      )}
    </div>
  )
}
