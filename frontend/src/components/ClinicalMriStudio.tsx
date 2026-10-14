import { useState } from "react"
import { RealNiiVueViewport } from "./RealNiiVueViewport"

export type ViewMode = "side_by_side" | "2d_only" | "3d_only"
export type Plane2D = "sagittal" | "axial" | "coronal"

const PLANE_IMAGES: Record<Plane2D, string> = {
  sagittal: "/assets/real_sagittal.png",
  axial: "/assets/real_axial.png",
  coronal: "/assets/real_coronal.png",
}

export function ClinicalMriStudio() {
  const [viewMode, setViewMode] = useState<ViewMode>("side_by_side")
  const [is2dFirst, setIs2dFirst] = useState(true)
  const [selectedPlane, setSelectedPlane] = useState<Plane2D>("sagittal")
  const [contrast, setContrast] = useState(115)
  const [brightness, setBrightness] = useState(105)
  const [selectedSequence, setSelectedSequence] = useState<"T1" | "T1-Gd" | "T2" | "FLAIR">("T1-Gd")
  const [mri3dMode, setMri3dMode] = useState<"multiplanar" | "render3d" | "axial" | "sagittal">("multiplanar")

  const render2DPanel = () => (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-[#1e1b2b] bg-[#050409]">
      {/* 2D Slice Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1b1926] bg-[#0c0a13] px-3 py-1.5 text-[10.5px] font-mono text-[#8c889e]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-white">2D True Voxel Slice</span>
          <span className="text-[#615c75]">[{selectedSequence}]</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(["sagittal", "axial", "coronal"] as const).map((plane) => (
            <button
              key={plane}
              onClick={() => setSelectedPlane(plane)}
              className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase transition-colors cursor-pointer ${
                selectedPlane === plane
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold"
                  : "text-[#6d6883] hover:text-white"
              }`}
            >
              {plane}
            </button>
          ))}
        </div>
      </div>

      {/* 2D Real Voxel Canvas Stage with Crosshairs */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-2">
        <img
          src={PLANE_IMAGES[selectedPlane]}
          alt={`Real 2D MRI ${selectedPlane} slice`}
          style={{
            filter: `contrast(${contrast}%) brightness(${brightness}%)`,
          }}
          className="h-full max-h-[58vh] w-auto max-w-full rounded-lg object-contain transition-all"
        />

        {/* Anatomical Orientation Tags */}
        <span className="absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[9px] text-[#6d6883] font-bold">S (SUPERIOR)</span>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] text-[#6d6883] font-bold">I (INFERIOR)</span>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[#6d6883] font-bold">A</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[#6d6883] font-bold">P</span>

        {/* Medical Crosshair Overlay */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px border-b border-cyan-500/20 border-dashed" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-r border-cyan-500/20 border-dashed" />
        </div>
      </div>

      {/* 2D Controls footer */}
      <div className="flex items-center justify-between border-t border-[#1b1926] bg-[#08070d] px-3 py-2 text-[10px] font-mono text-[#8c889e]">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span className="text-[#615c75]">Contrast:</span>
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
            <span className="text-[#615c75]">Bright:</span>
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
        <span className="text-[#555068]">Direct NIfTI Voxel Matrix</span>
      </div>
    </div>
  )

  const render3DPanel = () => (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-[#1e1b2b] bg-[#050409]">
      {/* 3D Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1b1926] bg-[#0c0a13] px-3 py-1.5 text-[10.5px] font-mono text-[#8c889e]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-semibold text-white">Interactive 3D NIfTI GPU Viewport</span>
          <span className="text-emerald-400 text-[10px]">[MNI152 Full Matrix]</span>
        </div>
        <div className="flex items-center gap-1">
          {(["multiplanar", "render3d", "axial", "sagittal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMri3dMode(m)}
              className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase transition-colors cursor-pointer ${
                mri3dMode === m
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold"
                  : "text-[#6d6883] hover:text-white"
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
      <div className="flex items-center justify-between border-t border-[#1b1926] bg-[#08070d] px-3 py-2 text-[10px] font-mono text-[#8c889e]">
        <span className="text-cyan-400">Click &amp; drag crosshair · Scroll to scrub slices</span>
        <span className="text-[#555068]">207 × 256 × 215 True 3D Voxels</span>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#000000]">
      {/* Top Clinical Sequence & Layout Selector Strip */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#1b1926] bg-[#0c0a13] px-3.5 py-2 text-[11px] font-mono">
        {/* Modality Sequences */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#615c75] mr-1">Sequence:</span>
          {(["T1", "T1-Gd", "T2", "FLAIR"] as const).map((seq) => (
            <button
              key={seq}
              onClick={() => setSelectedSequence(seq)}
              className={`rounded-md px-2 py-0.8 text-[10px] font-semibold transition-all cursor-pointer ${
                selectedSequence === seq
                  ? "border border-cyan-500/60 bg-cyan-950/40 text-cyan-300 shadow-sm"
                  : "border border-[#232030] bg-[#12101b] text-[#8c889e] hover:text-white hover:border-[#38334d]"
              }`}
            >
              {seq}
            </button>
          ))}
        </div>

        {/* View Layout Controls & Swap Button */}
        <div className="flex items-center gap-2">
          {/* Swap Reorder Button */}
          {viewMode === "side_by_side" && (
            <button
              onClick={() => setIs2dFirst((prev) => !prev)}
              className="flex items-center gap-1 rounded-md border border-[#232030] bg-[#12101b] px-2 py-0.8 text-[10px] text-[#8c889e] hover:text-white hover:border-[#38334d] transition-all cursor-pointer"
              title="Reorder Left/Right"
            >
              <span>⇄ Swap Order</span>
            </button>
          )}

          {/* Mode Tabs */}
          <div className="flex items-center rounded-lg border border-[#232030] bg-[#12101b] p-0.5">
            <button
              onClick={() => setViewMode("side_by_side")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                viewMode === "side_by_side" ? "bg-[#1f1b2e] text-white" : "text-[#716c87] hover:text-slate-300"
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode("2d_only")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                viewMode === "2d_only" ? "bg-[#1f1b2e] text-white" : "text-[#716c87] hover:text-slate-300"
              }`}
            >
              2D Slice
            </button>
            <button
              onClick={() => setViewMode("3d_only")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                viewMode === "3d_only" ? "bg-[#1f1b2e] text-white" : "text-[#716c87] hover:text-slate-300"
              }`}
            >
              3D NIfTI
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div className="flex flex-1 gap-2.5 overflow-hidden p-2.5">
        {viewMode === "side_by_side" && (
          <>
            {is2dFirst ? render2DPanel() : render3DPanel()}
            {is2dFirst ? render3DPanel() : render2DPanel()}
          </>
        )}
        {viewMode === "2d_only" && render2DPanel()}
        {viewMode === "3d_only" && render3DPanel()}
      </div>
    </div>
  )
}
