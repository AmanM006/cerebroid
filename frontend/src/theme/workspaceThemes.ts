export type ThemeMode = "cyberpunk" | "oled" | "pacs" | "matrix"

export interface ThemeConfig {
  id: ThemeMode
  name: string
  subtitle: string
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
  cardRadius: string
  fontFamily: string
  hasScanlines: boolean
  hasReticles: boolean
  hasPacsGrid: boolean
}

export const WORKSPACE_THEMES: Record<ThemeMode, ThemeConfig> = {
  // 1. Cyberpunk Tactical HUD
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk HUD",
    subtitle: "Tactical HUD · Reticles · Scanlines",
    accent: "#00f0ff",
    bgWorkspace: "bg-[#03060a]",
    bgCard: "bg-[#070d14]/95",
    bgHeader: "bg-[#0c1622]",
    borderCard: "border-cyan-500/40 hover:border-cyan-400",
    borderHighlight: "border-cyan-400",
    textPrimary: "text-cyan-100",
    textSecondary: "text-cyan-400/70",
    textAccent: "text-[#00f0ff]",
    badgeBg: "bg-cyan-950/80",
    badgeText: "text-cyan-300",
    badgeBorder: "border-cyan-500/60",
    glowEffect: "shadow-[0_0_20px_-3px_rgba(0,240,255,0.25)]",
    tagColor: "bg-cyan-950/90 text-cyan-300 border border-cyan-500/50",
    cardRadius: "rounded-none",
    fontFamily: "font-mono",
    hasScanlines: true,
    hasReticles: true,
    hasPacsGrid: false,
  },

  // 2. Pure Pitch Black OLED Stealth
  oled: {
    id: "oled",
    name: "OLED Stealth",
    subtitle: "True #000000 · High Contrast · Floating Minimalist",
    accent: "#ffffff",
    bgWorkspace: "bg-black",
    bgCard: "bg-[#000000]",
    bgHeader: "bg-[#080808]",
    borderCard: "border-neutral-800 hover:border-neutral-600",
    borderHighlight: "border-white",
    textPrimary: "text-white",
    textSecondary: "text-neutral-400",
    textAccent: "text-white",
    badgeBg: "bg-neutral-900",
    badgeText: "text-white",
    badgeBorder: "border-neutral-700",
    glowEffect: "shadow-none",
    tagColor: "bg-neutral-900 text-neutral-200 border border-neutral-800",
    cardRadius: "rounded-2xl",
    fontFamily: "font-sans",
    hasScanlines: false,
    hasReticles: false,
    hasPacsGrid: false,
  },

  // 3. Clinical Hospital PACS
  pacs: {
    id: "pacs",
    name: "Clinical PACS",
    subtitle: "Diagnostic Workstation · Hospital Slate · Density",
    accent: "#38bdf8",
    bgWorkspace: "bg-[#0b0f14]",
    bgCard: "bg-[#111720]",
    bgHeader: "bg-[#18202c]",
    borderCard: "border-slate-700/80 hover:border-slate-500",
    borderHighlight: "border-sky-400",
    textPrimary: "text-slate-100",
    textSecondary: "text-slate-400",
    textAccent: "text-sky-400",
    badgeBg: "bg-sky-950/80",
    badgeText: "text-sky-300",
    badgeBorder: "border-sky-600/50",
    glowEffect: "shadow-[0_2px_8px_rgba(0,0,0,0.5)]",
    tagColor: "bg-slate-800 text-slate-300 border border-slate-600",
    cardRadius: "rounded-md",
    fontFamily: "font-mono",
    hasScanlines: false,
    hasReticles: false,
    hasPacsGrid: true,
  },

  // 4. Bio-Genomic Matrix
  matrix: {
    id: "matrix",
    name: "Bio-Matrix",
    subtitle: "Laboratory Luminescence · Deep Emerald · Bio-Telemetry",
    accent: "#00ff66",
    bgWorkspace: "bg-[#010803]",
    bgCard: "bg-[#031307]/90",
    bgHeader: "bg-[#071c0d]",
    borderCard: "border-emerald-500/40 hover:border-emerald-400",
    borderHighlight: "border-emerald-400",
    textPrimary: "text-emerald-50",
    textSecondary: "text-emerald-400/70",
    textAccent: "text-[#00ff66]",
    badgeBg: "bg-emerald-950/80",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-500/50",
    glowEffect: "shadow-[0_0_20px_-3px_rgba(0,255,102,0.22)]",
    tagColor: "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50",
    cardRadius: "rounded-lg",
    fontFamily: "font-mono",
    hasScanlines: true,
    hasReticles: true,
    hasPacsGrid: false,
  },
}
