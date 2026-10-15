export type ThemeMode = "obsidian" | "cyber" | "nordic" | "emerald" | "aurora"

export interface ThemeConfig {
  id: ThemeMode
  name: string
  accent: string
  bgWorkspace: string
  bgCard: string
  bgHeader: string
  borderCard: string
  borderHighlight: string
  textPrimary: string
  textSecondary: string
  textAccent: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  glowEffect: string
  tagColor: string
}

export const WORKSPACE_THEMES: Record<ThemeMode, ThemeConfig> = {
  // 1. Obsidian / Midnight Stealth (Sleek Apple Pro Dark, ultra-clean, minimal borders)
  obsidian: {
    id: "obsidian",
    name: "Obsidian Stealth",
    accent: "#60a5fa",
    bgWorkspace: "bg-[#050507]",
    bgCard: "bg-[#0d0e12]",
    bgHeader: "bg-[#13151b]",
    borderCard: "border-neutral-800/80 hover:border-neutral-700",
    borderHighlight: "border-blue-500/50",
    textPrimary: "text-white",
    textSecondary: "text-neutral-400",
    textAccent: "text-blue-400",
    badgeBg: "bg-blue-950/40",
    badgeText: "text-blue-300",
    badgeBorder: "border-blue-800/50",
    glowEffect: "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.8)]",
    tagColor: "bg-neutral-800 text-neutral-300",
  },

  // 2. Cyber Cyan / Futuristic PACS (Glowing cyan crosshairs, tactical neuro-oncology look)
  cyber: {
    id: "cyber",
    name: "Cyber Cyan PACS",
    accent: "#06b6d4",
    bgWorkspace: "bg-[#03070d]",
    bgCard: "bg-[#071018]/90",
    bgHeader: "bg-[#0b1824]",
    borderCard: "border-cyan-950/80 hover:border-cyan-700/60",
    borderHighlight: "border-cyan-400",
    textPrimary: "text-slate-100",
    textSecondary: "text-cyan-200/60",
    textAccent: "text-cyan-400",
    badgeBg: "bg-cyan-950/60",
    badgeText: "text-cyan-300",
    badgeBorder: "border-cyan-500/40",
    glowEffect: "shadow-[0_0_25px_-5px_rgba(6,182,212,0.15)]",
    tagColor: "bg-cyan-950/80 text-cyan-300 border border-cyan-800/50",
  },

  // 3. Nordic Clinical Slate (Clean, muted surgical hospital gray, minimal fatigue)
  nordic: {
    id: "nordic",
    name: "Nordic Hospital Slate",
    accent: "#94a3b8",
    bgWorkspace: "bg-[#090b10]",
    bgCard: "bg-[#11141c]",
    bgHeader: "bg-[#171b26]",
    borderCard: "border-slate-800 hover:border-slate-600",
    borderHighlight: "border-slate-400",
    textPrimary: "text-slate-50",
    textSecondary: "text-slate-400",
    textAccent: "text-slate-200",
    badgeBg: "bg-slate-800/70",
    badgeText: "text-slate-200",
    badgeBorder: "border-slate-600",
    glowEffect: "shadow-[0_4px_16px_rgba(0,0,0,0.6)]",
    tagColor: "bg-slate-800 text-slate-300",
  },

  // 4. Emerald Matrix / Precision Bio (Medical genomics, laboratory green luminescence)
  emerald: {
    id: "emerald",
    name: "Emerald Precision",
    accent: "#10b981",
    bgWorkspace: "bg-[#020905]",
    bgCard: "bg-[#05130b]/90",
    bgHeader: "bg-[#091c11]",
    borderCard: "border-emerald-950/80 hover:border-emerald-700/60",
    borderHighlight: "border-emerald-400",
    textPrimary: "text-emerald-50",
    textSecondary: "text-emerald-300/60",
    textAccent: "text-emerald-400",
    badgeBg: "bg-emerald-950/60",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-600/40",
    glowEffect: "shadow-[0_0_25px_-5px_rgba(16,185,129,0.18)]",
    tagColor: "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50",
  },

  // 5. Aurora Velvet / Deep Violet (Deep space, luxury dark violet-crimson glow)
  aurora: {
    id: "aurora",
    name: "Aurora Velvet",
    accent: "#a855f7",
    bgWorkspace: "bg-[#07030c]",
    bgCard: "bg-[#0e0717]/90",
    bgHeader: "bg-[#160c24]",
    borderCard: "border-purple-950/80 hover:border-purple-700/60",
    borderHighlight: "border-purple-400",
    textPrimary: "text-purple-50",
    textSecondary: "text-purple-300/60",
    textAccent: "text-purple-400",
    badgeBg: "bg-purple-950/60",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-600/40",
    glowEffect: "shadow-[0_0_25px_-5px_rgba(168,85,247,0.18)]",
    tagColor: "bg-purple-950/80 text-purple-300 border border-purple-800/50",
  },
}
