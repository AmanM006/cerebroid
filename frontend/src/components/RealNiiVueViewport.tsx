import { useEffect, useRef, useState } from "react"
import { Niivue } from "@niivue/niivue"
import { ErrorNotice } from "./ErrorNotice"

export interface DirectVolume {
  url: string
  name: string
  colormap?: string
  opacity?: number
}

export function RealNiiVueViewport({
  volumes = [{ url: "/assets/mni152.nii.gz", name: "mni152.nii.gz", colormap: "gray" }],
  sliceType = "multiplanar",
}: {
  volumes?: DirectVolume[]
  sliceType?: "multiplanar" | "axial" | "coronal" | "sagittal" | "render3d"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nvRef = useRef<Niivue | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || volumes.length === 0) return
    let cancelled = false

    const nv = new Niivue({
      backColor: [0.03, 0.02, 0.05, 1],
      show3Dcrosshair: true,
      crosshairColor: [0, 0.8, 0.9, 0.8],
      loadingText: "Decoding NIfTI voxel buffer...",
    })
    nvRef.current = nv

    ;(async () => {
      setState("loading")
      try {
        await nv.attachToCanvas(canvas)
        if (cancelled) return

        const volumeList = volumes.map((v) => ({
          url: v.url,
          colormap: v.colormap ?? "gray",
          opacity: v.opacity ?? 1,
        }))

        await nv.loadVolumes(volumeList)
        if (cancelled) return

        if (sliceType === "multiplanar") {
          nv.setSliceType(nv.sliceTypeMultiplanar)
        } else if (sliceType === "render3d") {
          nv.setSliceType(nv.sliceTypeRender)
        } else if (sliceType === "axial") {
          nv.setSliceType(nv.sliceTypeAxial)
        } else if (sliceType === "sagittal") {
          nv.setSliceType(nv.sliceTypeSagittal)
        } else if (sliceType === "coronal") {
          nv.setSliceType(nv.sliceTypeCoronal)
        }

        nv.updateGLVolume()
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
  }, [volumes, sliceType])

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" aria-label="3D NiiVue MRI Volume" />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 font-mono text-xs text-cyan-300">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mr-2.5" />
          Streaming 3D NIfTI Volume &amp; Compiling WebGL Shaders…
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
