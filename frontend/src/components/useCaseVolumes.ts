import { useEffect, useState } from "react"
import { api } from "../api/client"
import type { MriSequence } from "../api/types"
import type { LoadedVolume } from "./RealNiiVueViewport"

export type AnatomicalSequence=Exclude<MriSequence, "seg">

export const SEQUENCE_LABELS: Record<AnatomicalSequence, string>={
  t1c: "T1 contrast",
  flair: "FLAIR",
  t2: "T2",
  t1: "T1",
}
// Contrast-enhanced T1 shows the enhancing rim best, so it opens first when present.
const DISPLAY_ORDER: AnatomicalSequence[]=["t1c", "flair", "t2", "t1"]

// Stable empty list, so the viewer doesn't reload on every render.
const NO_VOLUMES: LoadedVolume[]=[]

type Loaded={ key: string; volumes: LoadedVolume[]; available: MriSequence[]; error: unknown }

/**
 * Fetches a case's MRI volume (the chosen sequence, else the best available one)
 * plus its tumor segmentation, through the authenticated API client.
 */
export function useCaseVolumes(studyId: string | undefined, chosen: AnatomicalSequence | null) {
  // Each result remembers which request it answers, so a stale load never shows for a newer one.
  const [loaded, setLoaded]=useState<Loaded | null>(null)
  const key=JSON.stringify([studyId, chosen])

  useEffect(()=>{
    if (!studyId) return
    let cancelled=false
    ;(async ()=>{
      try {
        const { sequences }=await api.listVolumes(studyId)
        const display=chosen && sequences.includes(chosen) ? chosen : DISPLAY_ORDER.find((s)=>sequences.includes(s))
        const volumes: LoadedVolume[]=[]
        if (display) {
          volumes.push({ name: `${display}.nii.gz`, data: await api.volume(studyId, display) })
          if (sequences.includes("seg")) {
            volumes.push({ name: "seg.nii.gz", data: await api.volume(studyId, "seg"), colormap: "warm", opacity: 0.45 })
          }
        }
        if (!cancelled) setLoaded({ key, volumes, available: sequences, error: null })
      } catch (error) {
        if (!cancelled) setLoaded({ key, volumes: [], available: [], error })
      }
    })()
    return ()=>{
      cancelled=true
    }
  }, [key, studyId, chosen])

  return {
    loading: loaded?.key!==key,
    error: loaded?.error ?? null,
    volumes: loaded?.volumes ?? NO_VOLUMES,
    anatomical: (loaded?.available ?? []).filter((s): s is AnatomicalSequence=>s!=="seg"),
    hasTumorMask: loaded?.available.includes("seg") ?? false,
    current: loaded?.volumes[0]?.name.replace(".nii.gz", "") as AnatomicalSequence | undefined,
  }
}
