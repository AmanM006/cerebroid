import { createContext, useContext, useState, type ReactNode } from "react"
import type { MarkerName, TumorRegion } from "../api/types"

/** Which marker's LIME region map the MRI viewer should paint onto the tumor, if any. */
export interface RegionFocus {
  marker: MarkerName
  call: string
  /** Signed effect toward the call per region (+ supports the call, - against it). */
  regions: Record<TumorRegion, number>
}

export const ExplainFocusContext=createContext<{ focus: RegionFocus | null; setFocus: (f: RegionFocus | null)=>void }>({
  focus: null,
  setFocus: ()=>{},
})

export function ExplainFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus]=useState<RegionFocus | null>(null)
  return <ExplainFocusContext.Provider value={{ focus, setFocus }}>{children}</ExplainFocusContext.Provider>
}

export function useExplainFocus() {
  return useContext(ExplainFocusContext)
}

/** Below this the strongest region moves the probability too little to colour anything. */
export const MIN_REGION_EFFECT=0.02

/** RGB per segmentation label (1 necrotic core, 2 edema, 4 enhancing): warm supports, blue opposes. */
export function regionColors(focus: RegionFocus): Record<1 | 2 | 4, [number, number, number]> {
  const strongest=Math.max(MIN_REGION_EFFECT, ...Object.values(focus.regions).map(Math.abs))
  const colour=(effect: number): [number, number, number]=>{
    const t=Math.min(1, Math.abs(effect)/strongest)
    if (Math.abs(effect)<MIN_REGION_EFFECT/4) return [90, 90, 90]
    return effect>0
      ? [Math.round(120+135*t), Math.round(90+70*(1-t)), 40]
      : [40, Math.round(110+60*(1-t)), Math.round(140+115*t)]
  }
  return { 1: colour(focus.regions.ncr), 2: colour(focus.regions.ed), 4: colour(focus.regions.et) }
}
