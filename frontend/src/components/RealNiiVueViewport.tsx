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
  volumes = [{ url: "/assets/mni152_fast.nii.gz", name: "mni152_fast.nii.gz", colormap: "red" }],
  sliceType = "multiplanar",
}: {
  volumes?: DirectVolume[]
  sliceType?: "multiplanar" | "axial" | "coronal" | "sagittal" | "render3d"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nvRef = useRef<Niivue | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState<unknown>(null)
  const [selectedColormap, setSelectedColormap] = useState<string>("red")

  // Initialize NiiVue once on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false

    const nv = new Niivue({
      backColor: [0, 0, 0, 1],
      show3Dcrosshair: true,
      crosshairColor: [0, 0.9, 1, 0.85],
      loadingText: "Initializing GPU Pipeline...",
      dragMode: 1, // Drag to slice or rotate in 3D
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
          colormap: selectedColormap,
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

  // React to projection mode changes without reloading the volume buffer
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

  // Change colormap instantly on GPU
  const changeColor = (cmap: string) => {
    setSelectedColormap(cmap)
    const nv = nvRef.current
    if (nv && nv.volumes.length > 0 && nv.volumes[0]) {
      nv.setColorMap(nv.volumes[0].id, cmap)
      nv.updateGLVolume()
      nv.drawScene()
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Colormap Quick Selector Strip */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 rounded-lg border border-neutral-800 bg-[#0c0c0c]/90 px-2 py-1 backdrop-blur-sm">
        <span className="font-mono text-[9px] text-neutral-400 mr-1">TISSUE:</span>
        {[
          { id: "red", label: "Red", color: "#ef4444" },
          { id: "hot", label: "Thermal", color: "#f97316" },
          { id: "copper", label: "Copper", color: "#b45309" },
          { id: "plasma", label: "Plasma", color: "#a855f7" },
          { id: "gray", label: "Gray", color: "#9ca3af" },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => changeColor(c.id)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono transition-colors cursor-pointer ${
              selectedColormap === c.id
                ? "bg-neutral-800 text-white font-bold border border-neutral-650"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair touch-none"
        aria-label="3D NiiVue MRI Volume"
      />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 font-mono text-xs text-cyan-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mr-2.5" />
          Binding High-Speed GPU Texture Buffer…
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
