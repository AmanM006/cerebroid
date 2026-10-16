import { useEffect, useState, type CSSProperties, type DragEvent, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { api, ApiError } from "../api/client"
import type { Case, Readiness } from "../api/types"
import { AppShell } from "../components/AppShell"
import { ErrorNotice } from "../components/ErrorNotice"
import { ExplainFocusContext, regionColors, type RegionFocus } from "../components/ExplainFocus"
import { RealNiiVueViewport, type SliceMode } from "../components/RealNiiVueViewport"
import { SEQUENCE_LABELS, useCaseVolumes, type AnatomicalSequence } from "../components/useCaseVolumes"
import { NextStepPanel } from "../components/NextStepPanel"
import { ProfilePanel } from "../components/ProfilePanel"
import type { KnownResults } from "../components/KnownResultsForm"
import { ProvenanceBadge } from "../components/ProvenanceBadge"
import { SafeUsePanel } from "../components/SafeUsePanel"
import { WORKSPACE_THEMES } from "../theme/workspaceThemes"

export type Plane2D = "sagittal" | "axial" | "coronal"

// 4 Modular Drag-and-Drop / Click-to-Swap Components
type BlockId = "3d_viewport" | "2d_slice" | "molecular_profile" | "evidence_doubt"

export function CaseWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>()
  const [study, setStudy] = useState<Case | null>(null)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [known, setKnown] = useState<KnownResults>({})
  const [error, setError] = useState<unknown>(null)

  // OLED Stealth Architecture UI
  const currentTheme = WORKSPACE_THEMES.oled

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
  const [showCrosshairs, setShowCrosshairs] = useState(false)

  // The case's own MRI volumes, shared by the 3D and 2D blocks
  const [chosenSequence, setChosenSequence] = useState<AnatomicalSequence | null>(null)
  const [showTumor, setShowTumor] = useState(true)
  const mri = useCaseVolumes(caseId, chosenSequence)

  // LIME region map shared between a marker's "Why" tab and the MRI viewers (null = normal overlay).
  const [focus, setFocus] = useState<RegionFocus | null>(null)
  const regionMap = useMemo(() => (focus ? regionColors(focus) : null), [focus])

  useEffect(() => {
    if (!caseId) return
    setStudy(null)
    setError(null)
    setChosenSequence(null)
    setKnown({})
    setFocus(null)
    // Ignore responses for a case the user has already left, so a slow reply never shows the wrong patient.
    let current=true
    api.getCase(caseId).then((s)=>current && setStudy(s)).catch((e)=>current && setError(e))
    api.readiness().then((r)=>current && setReadiness(r)).catch((e)=>current && setError(e))
    return ()=>{
      current=false
    }
  }, [caseId])

  // Renders the case's volumes in one projection, or why they can't be shown
  const mriStage = (mode: SliceMode, style?: CSSProperties, showCrosshair: boolean = true) => {
    if (mri.error) return <div className="p-4"><ErrorNotice error={mri.error} /></div>
    if (mri.volumes.length === 0) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center font-mono text-xs text-neutral-500">
          {mri.loading ? "Downloading volumes…" : "No MRI volumes are stored for this case."}
        </div>
      )
    }
    return (
      <div className={`relative h-full w-full ${mri.loading ? "opacity-60" : ""}`} style={style}>
        <RealNiiVueViewport
          volumes={mri.volumes}
          sliceType={mode}
          overlayOpacity={showTumor ? 0.45 : 0}
          showCrosshair={showCrosshair}
          regionColors={showTumor ? regionMap : null}
        />
        {focus && showTumor && (
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] text-neutral-200">
            LIME · {focus.marker} {focus.call}:{" "}
            <span className="text-orange-300">warm = supports</span> ·{" "}
            <span className="text-sky-300">blue = against</span> · grey = little effect
          </div>
        )}
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

  // Reticle HUD corner brackets for Cyberpunk and Bio-Matrix
  const renderCornerReticles = () => {
    if (!currentTheme.hasReticles) return null
    return (
      <>
        <span className="pointer-events-none absolute top-1 left-1 h-2.5 w-2.5 border-t-2 border-l-2 border-current opacity-80" />
        <span className="pointer-events-none absolute top-1 right-1 h-2.5 w-2.5 border-t-2 border-r-2 border-current opacity-80" />
        <span className="pointer-events-none absolute bottom-1 left-1 h-2.5 w-2.5 border-b-2 border-l-2 border-current opacity-80" />
        <span className="pointer-events-none absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-current opacity-80" />
      </>
    )
  }

  // Component 1: 3D NIfTI GPU Viewport
  const render3DViewport = (index: number) => (
    <div
      key="3d_viewport"
      style={{ color: currentTheme.accent }}
      className={`relative flex h-full flex-col overflow-hidden ${currentTheme.cardRadius} border ${currentTheme.borderCard} ${currentTheme.bgCard} ${currentTheme.glowEffect} transition-all duration-300 ${currentTheme.fontFamily}`}
    >
      {renderCornerReticles()}
      {currentTheme.hasScanlines && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25" />
      )}
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        className={`flex items-center justify-between border-b border-white/10 ${currentTheme.bgHeader} px-3.5 py-1.5 text-[11px] cursor-grab active:cursor-grabbing select-none`}
      >
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2 group cursor-pointer"
          title="Drag handle or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold">⠿</span>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentTheme.accent }} />
          <span className={`font-bold tracking-wider uppercase ${currentTheme.textPrimary}`}>
            {currentTheme.id === "pacs" ? "SYS_VIEWPORT_3D" : currentTheme.id === "cyberpunk" ? "► 3D NEURO_HUD" : "3D GPU Viewport"}
          </span>
          <span className="text-[9px] text-neutral-400 rounded bg-black/50 px-1 py-0.2 border border-white/10">
            [SWAP]
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
              className={`px-2 py-0.5 text-[10px] uppercase transition-all cursor-pointer ${currentTheme.cardRadius} ${
                mri3dMode === m
                  ? `${currentTheme.badgeBg} ${currentTheme.badgeText} border ${currentTheme.badgeBorder} font-bold shadow-sm`
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {m === "render3d" ? "3D Vol" : m}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowCrosshairs((prev) => !prev)
            }}
            title="Toggle 3D coordinate crosshairs"
            className={`ml-1 px-2 py-0.5 text-[10px] uppercase transition-all cursor-pointer border ${currentTheme.cardRadius} ${
              showCrosshairs
                ? `${currentTheme.badgeBg} ${currentTheme.badgeText} ${currentTheme.badgeBorder} font-bold`
                : "border-white/10 text-neutral-400 hover:text-white"
            }`}
          >
            {showCrosshairs ? "Crosshair: ON" : "Crosshair: OFF"}
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        {currentTheme.hasPacsGrid && (
          <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-2 grid-rows-2 border border-slate-700/30">
            <span className="absolute top-2 left-2 text-[10px] font-mono text-slate-500 font-bold">R</span>
            <span className="absolute top-2 right-2 text-[10px] font-mono text-slate-500 font-bold">L</span>
            <span className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-500 font-bold">A</span>
            <span className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-500 font-bold">P</span>
          </div>
        )}
        {mriStage(mri3dMode, undefined, showCrosshairs)}
      </div>

      <div className={`flex shrink-0 items-center justify-between border-t border-white/10 ${currentTheme.bgHeader} px-3 py-1.5 text-[11px] ${currentTheme.textSecondary}`}>
        {sequencePicker}
        <span style={{ color: currentTheme.accent }} className="font-semibold tracking-wide">
          {currentTheme.id === "cyberpunk" ? "TACTICAL ORBIT // DRAG TO ROTATE" : "Drag to slice · Shift+drag to rotate 3D"}
        </span>
      </div>
    </div>
  )

  // Component 2: 2D True Voxel Slice
  const render2DSlice = (index: number) => (
    <div
      key="2d_slice"
      style={{ color: currentTheme.accent }}
      className={`relative flex h-full flex-col overflow-hidden ${currentTheme.cardRadius} border ${currentTheme.borderCard} ${currentTheme.bgCard} ${currentTheme.glowEffect} transition-all duration-300 ${currentTheme.fontFamily}`}
    >
      {renderCornerReticles()}
      {currentTheme.hasScanlines && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25" />
      )}
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        className={`flex items-center justify-between border-b border-white/10 ${currentTheme.bgHeader} px-3.5 py-1.5 text-[11px] cursor-grab active:cursor-grabbing select-none`}
      >
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2 group cursor-pointer"
          title="Drag handle or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-cyan-400 font-bold">⠿</span>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentTheme.accent }} />
          <span className={`font-bold tracking-wider uppercase ${currentTheme.textPrimary}`}>
            {currentTheme.id === "pacs" ? `DICOM_SLICE [${selectedPlane.toUpperCase()}]` : currentTheme.id === "cyberpunk" ? `► 2D RETICLE [${selectedPlane.toUpperCase()}]` : "2D Slice"}
          </span>
          <span className="text-[9px] text-neutral-400 rounded bg-black/50 px-1 py-0.2 border border-white/10">
            [SWAP]
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
              className={`px-2 py-0.5 text-[10px] uppercase transition-all cursor-pointer ${currentTheme.cardRadius} ${
                selectedPlane === plane
                  ? `${currentTheme.badgeBg} ${currentTheme.badgeText} border ${currentTheme.badgeBorder} font-bold shadow-sm`
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {plane}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        {currentTheme.hasPacsGrid && (
          <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-2 grid-rows-2 border border-slate-700/30">
            <span className="absolute top-2 left-2 text-[10px] font-mono text-slate-500 font-bold">S</span>
            <span className="absolute top-2 right-2 text-[10px] font-mono text-slate-500 font-bold">I</span>
            <span className="absolute bottom-2 left-2 text-[10px] font-mono text-slate-500 font-bold">A</span>
            <span className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-500 font-bold">P</span>
          </div>
        )}
        {mriStage(selectedPlane, undefined, false)}
      </div>

      <div className={`flex shrink-0 items-center justify-between border-t border-white/10 ${currentTheme.bgHeader} px-3 py-1.5 text-[11px] ${currentTheme.textSecondary}`}>
        {sequencePicker}
        <span style={{ color: currentTheme.accent }} className="font-semibold tracking-wide">
          {currentTheme.id === "cyberpunk" ? `VOXEL RETICLE // ${selectedPlane.toUpperCase()}` : `Interactive ${selectedPlane.toUpperCase()}`}
        </span>
      </div>
    </div>
  )

  // Component 3: Molecular Profile
  const renderMolecularProfile = (index: number) => (
    <div
      key="molecular_profile"
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#09090b] shadow-2xl transition-all duration-300 hover:border-neutral-700"
    >
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        className="flex items-center justify-between border-b border-neutral-800 bg-[#111114] px-4 py-2 text-xs font-mono cursor-grab active:cursor-grabbing select-none"
      >
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2.5 group cursor-pointer"
          title="Drag handle or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-white font-bold">⠿</span>
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          <span className="font-bold tracking-wider uppercase text-white group-hover:text-cyan-300">
            Tumor markers
          </span>
          <span className="text-[10px] text-neutral-400 rounded bg-black/60 px-1.5 py-0.5 border border-neutral-800">
            [SWAP]
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050507]">
        {caseId && (
          <ProfilePanel
            studyId={caseId}
            readiness={readiness}
            known={known}
            onKnownChange={setKnown}
          />
        )}
      </div>
    </div>
  )

  // Component 4: Next Step & Evidence
  const renderEvidenceDoubt = (index: number) => (
    <div
      key="evidence_doubt"
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#09090b] shadow-2xl transition-all duration-300 hover:border-neutral-700"
    >
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        className="flex items-center justify-between border-b border-neutral-800 bg-[#111114] px-4 py-2 text-xs font-mono cursor-grab active:cursor-grabbing select-none"
      >
        <div
          onClick={() => swapBlocks(index, (index + 1) % 4)}
          className="flex items-center gap-2.5 group cursor-pointer"
          title="Drag handle or click to swap block"
        >
          <span className="text-neutral-500 group-hover:text-white font-bold">⠿</span>
          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          <span className="font-bold tracking-wider uppercase text-white group-hover:text-amber-300">
            Next Step
          </span>
          <span className="text-[10px] text-neutral-400 rounded bg-black/60 px-1.5 py-0.5 border border-neutral-800">
            [SWAP]
          </span>
        </div>
        <span className="text-xs font-semibold text-neutral-400">Decision Support</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-[#050507]">
        {caseId && <NextStepPanel studyId={caseId} known={known} />}
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
        className={`relative h-full w-full min-h-0 overflow-hidden rounded-2xl transition-all duration-200 ${
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
        <div className="h-full w-full min-h-0 overflow-hidden">{content}</div>
      </div>
    )
  }

  // A malformed or unknown case link gets one clear message instead of every panel failing on its own.
  if (error instanceof ApiError && (error.status===404 || error.status===422)) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg space-y-3 px-4 py-16 text-center">
          <p className="text-lg font-bold text-white">Case not found</p>
          <p className="text-sm text-neutral-400">
            This case does not exist or you do not have access to it.
          </p>
          <Link to="/cases" className="inline-block rounded-lg border border-neutral-700 px-4 py-2 text-sm text-white hover:bg-white/10">
            ← Back to cases
          </Link>
          <p className="text-[10px] text-neutral-600">request {error.requestId}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <ExplainFocusContext.Provider value={{ focus, setFocus }}>
    <AppShell>
      <div className="w-full bg-black text-white">
        {/* =========================================================================
            SECTION 1 (First 100vh): Pure High-Resolution Radiologic Neuroimaging
            - 3D NIfTI GPU Viewport & 2D True Voxel Slice side-by-side
            - Full height utilization without feeling cramped
           ========================================================================= */}
        <section className={`flex h-[calc(100vh-3.25rem)] w-full flex-col px-4 py-2 space-y-2 ${currentTheme.bgWorkspace} transition-colors duration-300`}>
          {/* Top Case Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 pb-1.5 px-1">
            <div className="flex items-center gap-3">
              <Link
                to="/cases"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-1 text-xs font-mono text-neutral-300 hover:border-neutral-500 hover:text-white transition-all cursor-pointer"
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

            {/* Clean OLED stealth navigation */}
            <div className="flex items-center gap-3">
              {caseId && (
                <Link
                  to={`/cases/${caseId}/briefing${Object.keys(known).length ? `?known=${Object.entries(known).map(([m, v])=>`${m}:${v}`).join(",")}` : ""}`}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-[#0d0d0f] px-3 py-1.5 text-xs font-mono text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
                >
                  <span>⎙ Print briefing</span>
                </Link>
              )}
              <a
                href="#molecular-section"
                className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-[#0d0d0f] px-3 py-1.5 text-xs font-mono text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
              >
                <span>↓ Molecular</span>
              </a>
              <span className="rounded-full bg-emerald-950/80 border border-emerald-700/60 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                ● Live
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
          className={`flex min-h-[calc(100vh-3.25rem)] w-full flex-col border-t border-white/5 px-4 py-4 space-y-3 ${currentTheme.bgWorkspace} transition-colors duration-300`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 pb-2 px-1">
            <div className="flex items-center gap-2 font-mono">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Tumor profile
              </h2>
              <span className="text-[11px] text-neutral-500">
                Predicted from the MRI, age and sex · each result is checked by a panel of equally good models
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

          <SafeUsePanel />

          <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-h-[550px]">{renderBlock(blocks[2] ?? "molecular_profile", 2)}</div>
            <div className="min-h-[550px]">{renderBlock(blocks[3] ?? "evidence_doubt", 3)}</div>
          </div>
        </section>
      </div>
    </AppShell>
    </ExplainFocusContext.Provider>
  )
}
