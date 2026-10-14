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

  // Initialize NiiVue once on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false

    const nv = new Niivue({
      backColor: [0, 0, 0, 1],
      show3Dcrosshair: true,
      crosshairColor: [0, 0.85, 0.95, 0.8],
      loadingText: "Initializing GPU Pipeline...",
      dragMode: 1, // Slicing drag mode
      isColorbar: false,
      textHeight: 0.03,
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

        nv.setSliceType(
          sliceType === "render3d"
            ? nv.sliceTypeRender
            : sliceType === "axial"
            ? nv.sliceTypeAxial
            : sliceType === "sagittal"
            ? nv.sliceTypeSagittal
            : sliceType === "coronal"
            ? nv.sliceTypeCoronal
            : nv.sliceTypeMultiplanar
        )

        nv.updateGLVolume()
        if (!cancelled) setState("ready")
      } catch (err) {
        if (!cancelled) {
          setError(err)
          setState("error")
        }
      }
    })()

    // Smooth Canvas Resize Observer so resizing panels never causes WebGL blur/chopping
    const ro = new ResizeObserver(() => {
      if (nvRef.current && canvas) {
        nvRef.current.resizeListener()
        nvRef.current.drawScene()
      }
    })
    ro.observe(canvas)

    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [volumes])

  // React to projection mode changes without reloading the 4MB volume
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || state !== "ready") return

    if (sliceType === "render3d") {
      nv.setSliceType(nv.sliceTypeRender)
    } else if (sliceType === "axial") {
      nv.setSliceType(nv.sliceTypeAxial)
    } else if (sliceType === "sagittal") {
      nv.setSliceType(nv.sliceTypeSagittal)
    } else if (sliceType === "coronal") {
      nv.setSliceType(nv.sliceTypeCoronal)
    } else {
      nv.setSliceType(nv.sliceTypeMultiplanar)
    }
    nv.drawScene()
  }, [sliceType, state])

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair touch-none"
        aria-label="3D NiiVue MRI Volume"
      />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 font-mono text-xs text-cyan-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mr-2.5" />
          Binding GPU Texture Buffer…
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
