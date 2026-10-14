import { useState } from "react"
import { RealNiiVueViewport } from "./RealNiiVueViewport"

export type Plane2D = "sagittal" | "axial" | "coronal"

const PLANE_IMAGES: Record<Plane2D, string> = {
  sagittal: "/assets/real_sagittal.png",
  axial: "/assets/real_axial.png",
  coronal: "/assets/real_coronal.png",
}

export function ClinicalMriStudio({
  leftComponent = "3d",
  onSwap,
}: {
  leftComponent?: "2d" | "3d"
  onSwap?: () => void
}) {
  const [selectedPlane, setSelectedPlane] = useState<Plane2D>("sagittal")
  const [contrast, setContrast] = useState(115)
  const [brightness, setBrightness] = useState(105)
  const [mri3dMode, setMri3dMode] = useState<"multiplanar" | "render3d" | "axial" | "sagittal">("multiplanar")

  const render2DPanel = () => (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808]">
      {/* 2D Slice Header Bar with Drag/Swap Grip */}
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-2 text-[11px] font-mono select-none">
        <div
          onClick={onSwap}
          className="flex items-center gap-2 cursor-pointer group"
          title="Click to swap position"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold transition-colors">⠿</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
            2D True Voxel Slice
          </span>
          <span className="text-[10px] text-neutral-500 rounded bg-[#181818] px-1.5 py-0.2 border border-neutral-800">
            [Click to Swap]
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["sagittal", "axial", "coronal"] as const).map((plane) => (
            <button
              key={plane}
              onClick={() => setSelectedPlane(plane)}
              className={`rounded-lg px-2 py-0.8 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                selectedPlane === plane
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {plane}
            </button>
          ))}
        </div>
      </div>

      {/* 2D Real Voxel Canvas Stage with Crosshairs */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-3">
        <img
          src={PLANE_IMAGES[selectedPlane]}
          alt={`Real 2D MRI ${selectedPlane} slice`}
          style={{
            filter: `contrast(${contrast}%) brightness(${brightness}%)`,
          }}
          className="h-full max-h-[62vh] w-auto max-w-full rounded-lg object-contain transition-all"
        />

        {/* Anatomical Orientation Tags */}
        <span className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[9.5px] text-neutral-500 font-bold">S (SUPERIOR)</span>
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9.5px] text-neutral-500 font-bold">I (INFERIOR)</span>
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[9.5px] text-neutral-500 font-bold">A</span>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[9.5px] text-neutral-500 font-bold">P</span>

        {/* Medical Crosshair Overlay */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px border-b border-cyan-500/25 border-dashed" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-r border-cyan-500/25 border-dashed" />
        </div>
      </div>

      {/* 2D Controls footer */}
      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3.5 py-2 text-[10.5px] font-mono text-neutral-400">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Contrast:</span>
            <input
              type="range"
              min="70"
              max="160"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="h-1 w-16 cursor-pointer accent-cyan-400"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-neutral-500">Bright:</span>
            <input
              type="range"
              min="70"
              max="150"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="h-1 w-16 cursor-pointer accent-cyan-400"
            />
          </label>
        </div>
        <span className="text-neutral-500">Direct NIfTI Voxel Matrix</span>
      </div>
    </div>
  )

  const render3DPanel = () => (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808]">
      {/* 3D Header Bar with Clickable Swap Grip */}
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-2 text-[11px] font-mono select-none">
        <div
          onClick={onSwap}
          className="flex items-center gap-2 cursor-pointer group"
          title="Click to swap position"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold transition-colors">⠿</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
            Interactive 3D NIfTI GPU Viewport
          </span>
          <span className="text-[10px] text-neutral-500 rounded bg-[#181818] px-1.5 py-0.2 border border-neutral-800">
            [Click to Swap]
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["multiplanar", "render3d", "axial", "sagittal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMri3dMode(m)}
              className={`rounded-lg px-2 py-0.8 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                mri3dMode === m
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {m === "render3d" ? "3D Vol" : m}
            </button>
          ))}
        </div>
      </div>

      {/* Real NiiVue WebGL Volume Stage */}
      <div className="relative flex-1 bg-black">
        <RealNiiVueViewport
          volumes={[{ url: "/assets/mni152.nii.gz", name: "mni152.nii.gz", colormap: "gray" }]}
          sliceType={mri3dMode}
        />
      </div>

      {/* 3D Controls footer */}
      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3.5 py-2 text-[10.5px] font-mono text-neutral-400">
        <span className="text-cyan-400">Click &amp; drag crosshair · Scroll to scrub slices</span>
        <span className="text-neutral-500">207 × 256 × 215 True 3D Voxels</span>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-full w-full gap-3 overflow-hidden bg-black p-1">
      {leftComponent === "3d" ? (
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
