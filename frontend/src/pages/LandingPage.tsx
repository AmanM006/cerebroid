import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
  Dna,
  Activity,
  ArrowRight,
} from "lucide-react"
import { NovaCell3DScene } from "../components/NovaCell3DScene"

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      setMousePos({
        x: (e.clientX / innerWidth - 0.5) * 20,
        y: (e.clientY / innerHeight - 0.5) * 20,
      })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <div className="relative w-full min-h-screen bg-[#c8e8f8] text-[#0f172a] font-sans selection:bg-[#38bdf8]/30 overflow-x-hidden">
      
      {/* 
        HERO SECTION: Exact 100vh & 100vw edge-to-edge full bleed screen.
        Zero inner margins or nested card borders that cut it off.
      */}
      <section className="relative w-full h-screen overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#d9f2fd] via-[#c6e9fa] to-[#b7e3f8]">
        
        {/* Soft radial ambient highlights across the canvas */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_35%_25%,rgba(255,255,255,0.85)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-white/45 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-[#38bdf8]/20 rounded-full blur-3xl pointer-events-none" />

        {/* 
          HUGE WATERMARK TEXT "MEET CELL" 
          Spanning full viewport width in ultra-faint display typography
        */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0 transition-transform duration-300 ease-out"
          style={{
            transform: `translate(calc(-50% + ${mousePos.x * 0.3}px), calc(-50% + ${mousePos.y * 0.3}px))`,
          }}
        >
          <span className="text-[14vw] font-black tracking-wider text-[#95c9e4]/30 uppercase whitespace-nowrap block">
            MEET CELL
          </span>
        </div>

        {/* 
          3D INTERACTIVE WEBGL SCENE: 
          Transparent fluid cell vesicle encapsulating the 3D lobulated organic tumor spheroid with mouse/scroll parallax
        */}
        <NovaCell3DScene />

        {/* TOP NAVBAR: Edge-to-edge with clean responsive padding */}
        <header className="relative z-30 flex items-center justify-between px-8 sm:px-14 lg:px-20 pt-8 sm:pt-10">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#082f49]">
              NovaCell
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7] inline-block animate-pulse" />
          </Link>

          {/* Menu button: dark rounded pill/rectangle with white bars */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-12 h-12 rounded-2xl bg-[#092338] hover:bg-[#0c2f4a] active:scale-95 transition-all duration-200 flex items-center justify-center shadow-lg group cursor-pointer"
            aria-label="Navigation Menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white stroke-[2.5]" />
            )}
          </button>
        </header>

        {/* Dropdown Menu Modal */}
        {mobileMenuOpen && (
          <div className="absolute top-24 right-8 sm:right-14 z-50 w-72 rounded-3xl bg-white/95 backdrop-blur-2xl p-6 shadow-2xl border border-white/80 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="space-y-4">
              <div className="text-xs font-semibold tracking-wider text-[#0284c7] uppercase">
                Clinical Modules
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  to="/viewer"
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold text-[#082f49] hover:bg-[#e0f2fe] transition"
                >
                  <span>DICOM 3D PACS Viewer</span>
                  <ArrowUpRight className="w-4 h-4 text-[#0284c7]" />
                </Link>
                <Link
                  to="/batch"
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold text-[#082f49] hover:bg-[#e0f2fe] transition"
                >
                  <span>Multimodal Ingestion</span>
                  <ArrowUpRight className="w-4 h-4 text-[#0284c7]" />
                </Link>
                <Link
                  to="/system"
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold text-[#082f49] hover:bg-[#e0f2fe] transition"
                >
                  <span>Multiplicity Model Specs</span>
                  <ArrowUpRight className="w-4 h-4 text-[#0284c7]" />
                </Link>
              </div>
              <hr className="border-[#bae6fd]" />
              <Link
                to="/viewer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#082f49] text-white text-sm font-semibold shadow hover:bg-[#0c3c5f] transition"
              >
                <span>Launch PACS Viewer</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* HERO CONTENT: Full 100vh layout with top-right card and bottom text */}
        <div className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 px-8 sm:px-14 lg:px-20 py-4 sm:py-6">
          
          {/* Top-Right Glass Card: "Leverage artificial intelligence..." */}
          <div className="lg:col-span-12 flex justify-end items-start pt-2">
            <div
              className="w-full max-w-sm sm:max-w-md rounded-3xl bg-white/65 backdrop-blur-xl border border-white/95 p-4 sm:p-5 shadow-[0_12px_36px_rgba(2,132,199,0.1)] flex items-center gap-4 transition-transform duration-300 ease-out"
              style={{
                transform: `translate(${mousePos.x * -0.35}px, ${mousePos.y * -0.35}px)`,
              }}
            >
              <div className="flex-1">
                <p className="text-sm sm:text-base font-semibold leading-snug text-[#082f49]">
                  Leverage artificial intelligence to foster next-level neuro-oncology innovation.
                </p>
              </div>
              
              {/* Graphic container with robotic micro-gripper */}
              <div className="w-24 sm:w-28 h-20 rounded-2xl bg-gradient-to-br from-[#e0f2fe] to-[#bae6fd] border border-white flex items-center justify-center overflow-hidden relative shadow-inner">
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:6px_6px]" />
                <div className="relative flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] shadow-md flex items-center justify-center ring-2 ring-white">
                    <div className="w-3 h-3 rounded-full bg-white/90" />
                  </div>
                  <div className="w-7 h-2.5 bg-slate-400 rounded-sm shadow border border-slate-300 ml-1.5 flex items-center justify-around px-0.5">
                    <div className="w-1 h-1 bg-slate-700 rounded-full" />
                    <div className="w-1 h-1 bg-slate-700 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center spacer where 3D cell & tumor model floats */}
          <div className="hidden lg:block lg:col-span-12 flex-1 pointer-events-none min-h-[140px]" />

          {/* Bottom Left: Huge Headline */}
          <div className="lg:col-span-7 flex flex-col justify-end pb-8 sm:pb-12">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-extrabold tracking-tight text-[#082f49] leading-[1.06] transition-transform duration-200"
              style={{
                transform: `translate(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px)`,
              }}
            >
              Your Intelligent <br />
              Biotech Partner in <br />
              Health & Innovation
            </h1>
          </div>

          {/* Bottom Right: Description + Tech badges + Explore Now button */}
          <div className="lg:col-span-5 flex flex-col justify-end pb-8 sm:pb-12 sm:pl-8">
            <p className="text-sm sm:text-base font-medium text-[#1e4a68] leading-relaxed max-w-md">
              Streamline complex neuro-oncology experiments and clinical workflows with intuitive biotech tools designed for multi-parametric MRI efficiency. From genomics to therapies, shape the future of patient care.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Badges capsule */}
              <div className="flex items-center -space-x-1 p-1 bg-white/75 backdrop-blur-md rounded-full border border-white/80 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-[#082f49] flex items-center justify-center text-white shadow-sm ring-2 ring-white">
                  <Sparkles className="w-4 h-4 text-[#38bdf8]" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#0284c7] flex items-center justify-center text-white font-black text-xs shadow-sm ring-2 ring-white">
                  R
                </div>
                <div className="w-8 h-8 rounded-full bg-[#38bdf8] flex items-center justify-center text-white shadow-sm ring-2 ring-white">
                  <Dna className="w-4 h-4 text-[#082f49]" />
                </div>
              </div>

              {/* Explore Now Button */}
              <Link
                to="/viewer"
                className="group inline-flex items-center gap-3 text-sm sm:text-base font-bold text-[#082f49] hover:text-[#0284c7] transition duration-200 cursor-pointer"
              >
                <span>Explore Now</span>
                <div className="w-10 h-10 rounded-full bg-[#082f49] group-hover:bg-[#0284c7] transition-all duration-200 flex items-center justify-center text-white shadow-md">
                  <ArrowUpRight className="w-4.5 h-4.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom edge metadata bar */}
        <div className="relative z-20 px-8 sm:px-14 lg:px-20 pb-4 pt-2 flex items-center justify-between text-xs text-[#3b759a] font-medium border-t border-[#9ecce6]/35">
          <div>© 2026 NovaCell Neuro-Oncology. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>UCSF-PDGM Multiplicity Protocol</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">WHO CNS5 Molecular Subtyping</span>
          </div>
        </div>
      </section>

      {/* 
        SECTION 2: 100vh Multiplicity & Genomic Cohort Explorer
      */}
      <section className="relative w-full min-h-screen bg-gradient-to-b from-[#b7e3f8] via-[#c6e9fa] to-[#d9f2fd] px-8 sm:px-14 lg:px-20 py-16 flex flex-col justify-center">
        <div className="relative w-full max-w-7xl mx-auto rounded-[2.5rem] bg-white/70 backdrop-blur-xl border border-white/90 p-8 sm:p-12 shadow-[0_20px_60px_-15px_rgba(2,132,199,0.12)]">
          
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0284c7]/10 text-[#0284c7] text-xs font-bold uppercase tracking-wider mb-3">
              <Activity className="w-3.5 h-3.5" />
              <span>Multi-Modal Deep Phenotyping</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#082f49] tracking-tight">
              Clinical Multiplicity & Model Concordance
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#1e4a68] font-medium leading-relaxed">
              Explore out-of-fold cross-validation predictions for IDH1/2 mutation, 1p/19q codeletion, and MGMT methylation across 9 authentic UCSF-PDGM test cases.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white/80 p-6 border border-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-[#0284c7] uppercase tracking-wider">Modality E1</div>
                <h3 className="text-lg font-bold text-[#082f49] mt-1">Fused (Imaging + Clinical)</h3>
                <p className="text-xs text-[#1e4a68] mt-2">
                  Joint latent cross-attention fusing deep 3D ResNet volume features with age and sex biomarkers.
                </p>
              </div>
              <div className="mt-6 flex items-baseline justify-between pt-4 border-t border-[#e0f2fe]">
                <span className="text-xs font-semibold text-[#082f49]">Out-of-Fold AUC</span>
                <span className="text-xl font-black text-[#0284c7]">0.963</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/80 p-6 border border-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-[#0284c7] uppercase tracking-wider">Modality E2</div>
                <h3 className="text-lg font-bold text-[#082f49] mt-1">Imaging Only (Zero Prior)</h3>
                <p className="text-xs text-[#1e4a68] mt-2">
                  Unbiased radiomic deep learning directly from T1ce, T2, and FLAIR skull-stripped NIfTI volumes.
                </p>
              </div>
              <div className="mt-6 flex items-baseline justify-between pt-4 border-t border-[#e0f2fe]">
                <span className="text-xs font-semibold text-[#082f49]">Out-of-Fold AUC</span>
                <span className="text-xl font-black text-[#0284c7]">0.941</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/80 p-6 border border-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-[#0284c7] uppercase tracking-wider">Modality E4</div>
                <h3 className="text-lg font-bold text-[#082f49] mt-1">Fused Given Known IDH</h3>
                <p className="text-xs text-[#1e4a68] mt-2">
                  Conditional probability Bayesian inference predicting 1p/19q codeletion conditioned on verified IDH status.
                </p>
              </div>
              <div className="mt-6 flex items-baseline justify-between pt-4 border-t border-[#e0f2fe]">
                <span className="text-xs font-semibold text-[#082f49]">Out-of-Fold AUC</span>
                <span className="text-xl font-black text-[#0284c7]">0.982</span>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[#9ecce6]/40">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#082f49]">9 Pre-loaded Benchmark Scans</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#0284c7]/15 text-[#0284c7] font-bold">240×240×155</span>
            </div>
            <Link
              to="/viewer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#082f49] text-white font-bold text-sm shadow hover:bg-[#0284c7] transition duration-200"
            >
              <span>Launch 3D DICOM PACS Viewer</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
