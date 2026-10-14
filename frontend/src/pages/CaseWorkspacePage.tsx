import { useEffect, useState, type DragEvent } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api/client"
import type { Case, Readiness } from "../api/types"
import { AppShell } from "../components/AppShell"
import { ErrorNotice } from "../components/ErrorNotice"
import { RealNiiVueViewport } from "../components/RealNiiVueViewport"
import { ProfilePanel } from "../components/ProfilePanel"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

export type Plane2D = "sagittal" | "axial" | "coronal"

const PLANE_IMAGES: Record<Plane2D, string> = {
  sagittal: "/assets/real_sagittal.png",
  axial: "/assets/real_axial.png",
  coronal: "/assets/real_coronal.png",
}

// 4 Modular Drag-and-Drop / Click-to-Swap Components
type BlockId = "3d_viewport" | "2d_slice" | "molecular_profile" | "evidence_doubt"

export function CaseWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>()
  const [study, setStudy] = useState<Case | null>(null)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [error, setError] = useState<unknown>(null)

  // Block positions in a modular 2x2 grid (all 4 fit immediately in the 100vh viewport)
  const [blocks, setBlocks] = useState<BlockId[]>([
    "3d_viewport",
    "2d_slice",
    "molecular_profile",
    "evidence_doubt",
  ])

  // Drag-and-Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // 2D Controls
  const [selectedPlane, setSelectedPlane] = useState<Plane2D>("sagittal")
  const [contrast, setContrast] = useState(115)
  const [brightness, setBrightness] = useState(105)

  // 3D Controls
  const [mri3dMode, setMri3dMode] = useState<"multiplanar" | "render3d" | "axial" | "sagittal">("multiplanar")

  useEffect(() => {
    if (!caseId) return
    api.getCase(caseId).then(setStudy).catch(setError)
    api.readiness().then(setReadiness).catch(setError)
  }, [caseId])

  // Swap any two blocks by index
  const swapBlocks = (indexA: number, indexB: number) => {
    if (indexA === indexB) return
    setBlocks((prev) => {
      const next = [...prev]
      const a = next[indexA]
      const b = next[indexB]
      if (a && b) {
        next[indexA] = b
        next[indexB] = a
      }
      return next
    })
  }

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.setData("text/plain", index.toString())
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      swapBlocks(draggedIndex, targetIndex)
    }
    setDraggedIndex(null)
  }

  // Component 1: 3D GPU Viewport
  const render3DViewport = (index: number) => (
    <div
      key="3d_viewport"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, index)}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808] transition-all hover:border-neutral-700"
    >
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-1.5 text-[11px] font-mono cursor-grab active:cursor-grabbing select-none">
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2 group cursor-pointer"
          title="Drag or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold">⠿</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-semibold text-white group-hover:text-cyan-300">
            3D NIfTI GPU Viewport
          </span>
          <span className="text-[9px] text-neutral-500 rounded bg-[#181818] px-1 py-0.2 border border-neutral-800">
            [Drag / Swap]
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["multiplanar", "render3d", "axial", "sagittal"] as const).map((m) => (
            <button
              key={m}
              onClick={(e) => {
                e.stopPropagation()
                setMri3dMode(m)
              }}
              className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase transition-colors cursor-pointer ${
                mri3dMode === m
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {m === "render3d" ? "3D Vol" : m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 bg-black">
        <RealNiiVueViewport
          volumes={[{ url: "/assets/mni152_fast.nii.gz", name: "mni152_fast.nii.gz", colormap: "red" }]}
          sliceType={mri3dMode}
        />
      </div>

      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3 py-1.5 text-[10px] font-mono text-neutral-400">
        <span className="text-cyan-400">Drag to slice · Shift+drag to rotate 3D</span>
        <span className="text-neutral-500">207×256×215 GPU Matrix</span>
      </div>
    </div>
  )

  // Component 2: 2D True Voxel Slice
  const render2DSlice = (index: number) => (
    <div
      key="2d_slice"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, index)}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808] transition-all hover:border-neutral-700"
    >
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-1.5 text-[11px] font-mono cursor-grab active:cursor-grabbing select-none">
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2 group cursor-pointer"
          title="Drag or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold">⠿</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-white group-hover:text-cyan-300">
            2D True Voxel Slice
          </span>
          <span className="text-[9px] text-neutral-500 rounded bg-[#181818] px-1 py-0.2 border border-neutral-800">
            [Drag / Swap]
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["sagittal", "axial", "coronal"] as const).map((plane) => (
            <button
              key={plane}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPlane(plane)
              }}
              className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase transition-colors cursor-pointer ${
                selectedPlane === plane
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {plane}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-2">
        <img
          src={PLANE_IMAGES[selectedPlane]}
          alt={`Real 2D MRI ${selectedPlane} slice`}
          style={{
            filter: `contrast(${contrast}%) brightness(${brightness}%)`,
          }}
          className="h-full max-h-[38vh] w-auto max-w-full rounded-lg object-contain transition-all"
        />

        <span className="absolute top-2 left-1/2 -translate-x-1/2 font-mono text-[9px] text-neutral-500 font-bold">S (SUPERIOR)</span>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] text-neutral-500 font-bold">I (INFERIOR)</span>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-neutral-500 font-bold">A</span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-neutral-500 font-bold">P</span>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-px border-b border-cyan-500/20 border-dashed" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-r border-cyan-500/20 border-dashed" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3 py-1.5 text-[10px] font-mono text-neutral-400">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1">
            <span className="text-neutral-500">Contrast:</span>
            <input
              type="range"
              min="70"
              max="160"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="h-1 w-14 cursor-pointer accent-cyan-400"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-neutral-500">Bright:</span>
            <input
              type="range"
              min="70"
              max="150"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="h-1 w-14 cursor-pointer accent-cyan-400"
            />
          </label>
        </div>
        <span className="text-neutral-500">True NIfTI Voxel</span>
      </div>
    </div>
  )

  // Component 3: Molecular Profile
  const renderMolecularProfile = (index: number) => (
    <div
      key="molecular_profile"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, index)}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808] transition-all hover:border-neutral-700"
    >
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-1.5 text-[11px] font-mono cursor-grab active:cursor-grabbing select-none">
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2 group cursor-pointer"
          title="Drag or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold">⠿</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="font-semibold text-white group-hover:text-cyan-300">
            Molecular Profile (Multiplicity)
          </span>
          <span className="text-[9px] text-neutral-500 rounded bg-[#181818] px-1 py-0.2 border border-neutral-800">
            [Drag / Swap]
          </span>
        </div>
        <span className="text-[10px] text-emerald-400">WHO 2021 CNS</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {caseId && <ProfilePanel studyId={caseId} readiness={readiness} />}
      </div>
    </div>
  )

  // Component 4: Evidence & Doubt
  const renderEvidenceDoubt = (index: number) => (
    <div
      key="evidence_doubt"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, index)}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#080808] transition-all hover:border-neutral-700"
    >
      <div className="flex items-center justify-between border-b border-neutral-850 bg-[#101010] px-3.5 py-1.5 text-[11px] font-mono cursor-grab active:cursor-grabbing select-none">
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2 group cursor-pointer"
          title="Drag or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold">⠿</span>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="font-semibold text-white group-hover:text-cyan-300">
            Clinical Doubt &amp; Evidence
          </span>
          <span className="text-[9px] text-neutral-500 rounded bg-[#181818] px-1 py-0.2 border border-neutral-800">
            [Drag / Swap]
          </span>
        </div>
        <span className="text-[10px] text-amber-400">Decision Support</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 font-mono text-xs text-neutral-400 space-y-3">
        <div className="rounded-xl border border-neutral-800 bg-[#121212] p-3 text-[11px] text-neutral-300 space-y-1.5">
          <span className="font-bold text-white block">Multiplicity Protocol:</span>
          <p>• Stable markers (&ge;85% consensus): high confidence, non-invasive call.</p>
          <p>• Contested / Arbitrary markers: histology / tissue biopsy mandatory.</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-[#121212] p-3 text-[11px] space-y-1.5">
          <span className="font-bold text-white block">Diagnostic Criteria (WHO 2021):</span>
          <div className="flex items-center justify-between border-b border-neutral-850 pb-1">
            <span>IDH1/2 Mutation</span>
            <span className="text-white font-semibold">Codon 132/172</span>
          </div>
          <div className="flex items-center justify-between border-b border-neutral-850 pb-1">
            <span>1p/19q Co-deletion</span>
            <span className="text-white font-semibold">Oligodendroglioma</span>
          </div>
          <div className="flex items-center justify-between">
            <span>MGMT Promoter</span>
            <span className="text-white font-semibold">Methylated</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBlock = (blockId: BlockId, index: number) => {
    switch (blockId) {
      case "3d_viewport":
        return render3DViewport(index)
      case "2d_slice":
        return render2DSlice(index)
      case "molecular_profile":
        return renderMolecularProfile(index)
      case "evidence_doubt":
        return renderEvidenceDoubt(index)
    }
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.25rem)] w-full flex-col overflow-hidden bg-black px-4 py-2 space-y-2">
        {/* Top Case Subheader */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-850 pb-1.5 px-1">
          <div className="flex items-center gap-3">
            <Link
              to="/cases"
              className="rounded-xl border border-neutral-800 bg-[#121212] px-3 py-1 text-xs font-mono text-neutral-300 hover:border-neutral-600 hover:text-white transition-all cursor-pointer"
            >
              ← Back to Cohort
            </Link>
            <h1 className="text-sm font-mono font-bold text-white tracking-wide">
              {study?.label ?? "Case Workspace"}
            </h1>
            {study && (
              <div className="flex items-center gap-3 font-mono text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  Age <strong className="text-white">{study.age.value ?? "—"}</strong>
                  <ProvenanceBadge provenance={study.age.provenance} />
                </span>
                <span className="flex items-center gap-1.5">
                  Sex <strong className="text-white">{study.sex.value ?? "—"}</strong>
                  <ProvenanceBadge provenance={study.sex.provenance} />
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-[11px] text-neutral-500">
              ⠿ Drag any block header or click to swap positions like Scratch blocks
            </span>
            <span className="rounded-full bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              ● Active Session
            </span>
          </div>
        </div>

        {error !== null && <ErrorNotice error={error} />}

        {/* 2x2 Scratch Grid: Exactly 100vh bounded, fully visible on one screen */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-2 grid-rows-2 gap-2.5 overflow-hidden min-h-0">
          {blocks.map((blockId, index) => renderBlock(blockId, index))}
        </div>
      </div>
    </AppShell>
  )
}
