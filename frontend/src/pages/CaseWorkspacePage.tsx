import { useEffect, useState, type CSSProperties, type DragEvent } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api/client"
import type { Case, Readiness } from "../api/types"
import { AppShell } from "../components/AppShell"
import { ErrorNotice } from "../components/ErrorNotice"
import { RealNiiVueViewport, type SliceMode } from "../components/RealNiiVueViewport"
import { SEQUENCE_LABELS, useCaseVolumes, type AnatomicalSequence } from "../components/useCaseVolumes"
import { ProfilePanel } from "../components/ProfilePanel"
import { ProvenanceBadge } from "../components/ProvenanceBadge"

export type Plane2D = "sagittal" | "axial" | "coronal"

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
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null)

  // 2D Controls
  const [selectedPlane, setSelectedPlane] = useState<Plane2D>("sagittal")

  // 3D Controls
  const [mri3dMode, setMri3dMode] = useState<"multiplanar" | "render3d" | "axial" | "sagittal">("multiplanar")

  // The case's own MRI volumes, shared by the 3D and 2D blocks
  const [chosenSequence, setChosenSequence] = useState<AnatomicalSequence | null>(null)
  const [showTumor, setShowTumor] = useState(true)
  const mri = useCaseVolumes(caseId, chosenSequence)

  useEffect(() => {
    if (!caseId) return
    api.getCase(caseId).then(setStudy).catch(setError)
    api.readiness().then(setReadiness).catch(setError)
  }, [caseId])

  // Renders the case's volumes in one projection, or why they can't be shown
  const mriStage = (mode: SliceMode, style?: CSSProperties) => {
    if (mri.error) return <div className="p-4"><ErrorNotice error={mri.error} /></div>
    if (mri.volumes.length === 0) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center font-mono text-xs text-neutral-500">
          {mri.loading ? "Downloading volumes…" : "No MRI volumes are stored for this case."}
        </div>
      )
    }
    return (
      <div className={`h-full w-full ${mri.loading ? "opacity-60" : ""}`} style={style}>
        <RealNiiVueViewport volumes={mri.volumes} sliceType={mode} overlayOpacity={showTumor ? 0.45 : 0} />
      </div>
    )
  }

  const sequencePicker = mri.anatomical.length > 0 && (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {mri.anatomical.map((s) => (
        <button
          key={s}
          onClick={() => setChosenSequence(s)}
          className={`rounded px-1.5 py-0.5 text-[9.5px] uppercase transition-colors cursor-pointer ${
            mri.current === s ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold" : "text-neutral-400 hover:text-white"
          }`}
        >
          {SEQUENCE_LABELS[s]}
        </button>
      ))}
      {mri.hasTumorMask && (
        <button
          onClick={() => setShowTumor((v) => !v)}
          aria-pressed={showTumor}
          className={`ml-1 rounded px-1.5 py-0.5 text-[9.5px] uppercase transition-colors cursor-pointer ${
            showTumor ? "bg-orange-950/80 text-orange-300 border border-orange-800 font-bold" : "text-neutral-400 hover:text-white"
          }`}
        >
          Tumor overlay
        </button>
      )}
    </div>
  )

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

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragTargetIndex !== index) {
      setDragTargetIndex(index)
    }
  }

  const handleDragLeave = (_e: DragEvent<HTMLDivElement>, index: number) => {
    if (dragTargetIndex === index) {
      setDragTargetIndex(null)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      swapBlocks(draggedIndex, targetIndex)
    }
    setDraggedIndex(null)
    setDragTargetIndex(null)
  }

  // Component 1: 3D GPU Viewport
  const render3DViewport = (index: number) => (
    <div
      key="3d_viewport"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
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
        {mriStage(mri3dMode)}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3 py-1.5 text-[10px] font-mono text-neutral-400">
        {sequencePicker}
        <span className="text-cyan-400">Drag to slice · Shift+drag to rotate 3D</span>
      </div>
    </div>
  )

  // Component 2: 2D True Voxel Slice
  const render2DSlice = (index: number) => (
    <div
      key="2d_slice"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
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
            2D Slice
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

      <div className="relative flex-1 overflow-hidden bg-black">
        {mriStage(selectedPlane)}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-850 bg-[#0c0c0c] px-3 py-1.5 text-[10px] font-mono text-neutral-400">
        <span className="text-cyan-400">Interactive NiiVue {selectedPlane.toUpperCase()} cross-section</span>
        <span className="text-neutral-500">{mri.current ? SEQUENCE_LABELS[mri.current] : "—"}</span>
      </div>
    </div>
  )

  // Component 3: Molecular Profile
  const renderMolecularProfile = (index: number) => (
    <div
      key="molecular_profile"
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
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
    let content = null
    switch (blockId) {
      case "3d_viewport":
        content = render3DViewport(index)
        break
      case "2d_slice":
        content = render2DSlice(index)
        break
      case "molecular_profile":
        content = renderMolecularProfile(index)
        break
      case "evidence_doubt":
        content = renderEvidenceDoubt(index)
        break
    }

    const isBeingDragged = draggedIndex === index
    const isDropTarget = dragTargetIndex === index && draggedIndex !== null && draggedIndex !== index

    return (
      <div
        key={`slot-${index}-${blockId}`}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={(e) => handleDragLeave(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        className={`relative h-full w-full rounded-2xl transition-all duration-200 ${
          isBeingDragged
            ? "border-2 border-dashed border-cyan-500/50 bg-[#0a1018]/40 opacity-40 scale-[0.98]"
            : isDropTarget
            ? "border-2 border-dashed border-cyan-400 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.25)] scale-[1.01]"
            : "border border-neutral-850/80 bg-transparent"
        }`}
      >
        {isDropTarget && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-cyan-950/40 backdrop-blur-[2px] border-2 border-dashed border-cyan-400">
            <span className="font-mono text-xs font-bold text-cyan-300 uppercase tracking-widest bg-black/80 px-3 py-1 rounded-lg border border-cyan-500/50">
              ⇄ Drop to Swap Here
            </span>
          </div>
        )}
        <div className="h-full w-full">{content}</div>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="w-full bg-black text-white">
        {/* =========================================================================
            SECTION 1 (First 100vh): Pure High-Resolution Radiologic Neuroimaging
            - 3D NIfTI GPU Viewport & 2D True Voxel Slice side-by-side
            - Full height utilization without feeling cramped
           ========================================================================= */}
        <section className="flex h-[calc(100vh-3.25rem)] w-full flex-col px-4 py-2 space-y-2">
          {/* Top Case Header */}
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
              <a
                href="#molecular-section"
                className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-[#141414] px-2.5 py-1 text-[11px] text-neutral-300 hover:border-cyan-700 hover:text-cyan-300 transition-colors"
              >
                <span>↓ Molecular & Evidence (Scroll to Section 2)</span>
              </a>
              <span className="rounded-full bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                ● Active Session
              </span>
            </div>
          </div>

          {error !== null && <ErrorNotice error={error} />}

          {/* Section 1 Grid: Exactly fills 100vh with the 2 MRI viewers side by side */}
          <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-3 min-h-0 overflow-hidden">
            {renderBlock(blocks[0] ?? "3d_viewport", 0)}
            {renderBlock(blocks[1] ?? "2d_slice", 1)}
          </div>
        </section>

        {/* =========================================================================
            SECTION 2 (Second 100vh): Molecular Profile, Multiplicity & Evidence
            - Deep diagnostic inference, stability flags, WHO 2021 criteria
           ========================================================================= */}
        <section
          id="molecular-section"
          className="flex min-h-[calc(100vh-3.25rem)] w-full flex-col border-t border-neutral-850 px-4 py-4 space-y-3 bg-[#050505]"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-850 pb-2 px-1">
            <div className="flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Molecular Biomarker & Clinical Evidence Analysis
              </h2>
              <span className="rounded bg-[#161616] border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">
                WHO 2021 CNS Taxonomy · Platt Calibrated Multiplicity
              </span>
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              className="text-[11px] font-mono text-neutral-400 hover:text-white transition-colors"
            >
              ↑ Back to Neuroimaging Viewports
            </a>
          </div>

          <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-h-[550px]">{renderBlock(blocks[2] ?? "molecular_profile", 2)}</div>
            <div className="min-h-[550px]">{renderBlock(blocks[3] ?? "evidence_doubt", 3)}</div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
