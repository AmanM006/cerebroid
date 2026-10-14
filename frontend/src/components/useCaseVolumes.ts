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

const DISPLAY_ORDER: AnatomicalSequence[]=["t1c", "flair", "t2", "t1"]
const NO_VOLUMES: LoadedVolume[]=[]

// Cache volume list and ArrayBuffers for the currently open study so switching T1c/FLAIR/T2 is instant.
let cachedStudyId: string | null=null
let cachedSequences: MriSequence[] | null=null
const cachedBytes=new Map<string, ArrayBuffer>()

type Loaded={ key: string; volumes: LoadedVolume[]; available: MriSequence[]; error: unknown }

export function useCaseVolumes(studyId: string | undefined, chosen: AnatomicalSequence | null) {
  const [loaded, setLoaded]=useState<Loaded | null>(null)
  const key=JSON.stringify([studyId, chosen])

  useEffect(()=>{
    if (!studyId) return
    let cancelled=false
    ;(async ()=>{
      try {
        if (cachedStudyId!==studyId) {
          cachedStudyId=studyId
          cachedSequences=null
          cachedBytes.clear()
        }
        const sequences=cachedSequences ?? (await api.listVolumes(studyId)).sequences
        cachedSequences=sequences
        const display=chosen && sequences.includes(chosen) ? chosen : DISPLAY_ORDER.find((s)=>sequences.includes(s))
        const volumes: LoadedVolume[]=[]
        if (display) {
          const getVol=async (seq: MriSequence)=>{
            const k=`${studyId}:${seq}`
            const hit=cachedBytes.get(k)
            if (hit) return hit
            const buf=await api.volume(studyId, seq)
            cachedBytes.set(k, buf)
            return buf
          }
          volumes.push({ name: `${display}.nii.gz`, data: await getVol(display) })
          if (sequences.includes("seg")) {
            volumes.push({ name: "seg.nii.gz", data: await getVol("seg"), colormap: "warm", opacity: 0.45 })
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
