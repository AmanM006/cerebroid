import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { ArrowDown } from "lucide-react"
import Lenis from "lenis"
import { NovaCell3DScene } from "../components/NovaCell3DScene"
import { CircularText } from "../components/CircularText"

export function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

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

  const scrollToNextSection = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative w-full min-h-screen bg-[#000000] text-white font-sans selection:bg-white/20 overflow-x-hidden">
      
      {/* 
        HERO SECTION: 100vh & 100vw full bleed edge-to-edge in pure luxury black & obsidian
      */}
      <section className="relative w-full h-screen overflow-hidden flex flex-col justify-between bg-black">
        
        {/* Soft radial ambient highlights across the deep black canvas */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_35%_25%,rgba(255,255,255,0.06)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

        {/* 
          HUGE WATERMARK TEXT "MEET CELL" 
          Spanning full viewport width in ultra-faint white display typography
        */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0 transition-transform duration-300 ease-out"
          style={{
            transform: `translate(calc(-50% + ${mousePos.x * 0.3}px), calc(-50% + ${mousePos.y * 0.3}px))`,
          }}
        >
          <span className="text-[14vw] font-black tracking-wider text-white/[0.04] uppercase whitespace-nowrap block">
            MEET CELL
          </span>
        </div>

        {/* 
          3D INTERACTIVE WEBGL SCENE: 
          Pure white glass balls for satellites, and central hero glass vesicle containing the vibrant organic RED tumor.
        */}
        <NovaCell3DScene />

        {/* TOP NAVBAR: Edge-to-edge */}
        <header className="relative z-30 flex items-center justify-between px-8 sm:px-14 lg:px-20 pt-8 sm:pt-10">
          
          {/* Clean normal bold NovaCell wordmark on the top left */}
          <a href="/" className="flex items-center gap-2 group">
            <span
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
            >
              NovaCell
            </span>
          </a>

          {/* Balanced Rectangular Login Button linking to /login */}
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-2 rounded-none bg-white hover:bg-neutral-100 text-black font-bold text-sm tracking-wider uppercase shadow-[0_2px_14px_rgba(255,255,255,0.18)] hover:shadow-[0_4px_20px_rgba(255,255,255,0.3)] border border-white active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Login
          </Link>
        </header>

        {/* HERO CONTENT: Full 100vh layout with headline on bottom left and CircularText pushed all the way to bottom right */}
        <div className="relative z-20 flex-1 flex flex-col lg:flex-row items-end justify-between px-8 sm:px-14 lg:px-20 pb-8 sm:pb-12 gap-8">
          
          {/* Bold Display Headline in pure white */}
          <div className="max-w-2xl">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-extrabold tracking-tight text-white leading-[1.04] transition-transform duration-200"
              style={{
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                transform: `translate(${mousePos.x * 0.2}px, ${mousePos.y * 0.2}px)`,
              }}
            >
              Your Intelligent <br />
              Biotech Partner in <br />
              Health & Innovation
            </h1>
          </div>

          {/* Bottom Right: Circular Rotating Text with Down Arrow in center - pushed tight to bottom right */}
          <div 
            onClick={scrollToNextSection}
            className="relative flex items-center justify-center cursor-pointer group select-none self-end mb-1 mr-[-8px] sm:mr-0"
          >
            <CircularText
              text="SCROLL DOWN • EXPLORE COHORT • "
              spinDuration={16}
              onHover="speedUp"
              className="font-bold text-white/90"
            />
            {/* Center Down Arrow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md shadow-sm border border-white/30 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-white group-hover:text-black transition-all duration-300">
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
              </div>
            </div>
          </div>

        </div>

      </section>

      {/* 
        SECTION 2: 100vh Multiplicity & Genomic Cohort Explorer in Black & Slate
      */}
      <section className="relative w-full min-h-screen bg-black px-8 sm:px-14 lg:px-20 py-16 flex flex-col justify-center border-t border-neutral-900">
        <div className="relative w-full max-w-7xl mx-auto rounded-[2.5rem] bg-neutral-950/80 backdrop-blur-xl border border-neutral-800 p-8 sm:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-3">
              <span>Multi-Modal Deep Phenotyping</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Clinical Multiplicity & Model Concordance
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-400 font-medium leading-relaxed">
              Explore out-of-fold cross-validation predictions for IDH1/2 mutation, 1p/19q codeletion, and MGMT methylation across 9 authentic UCSF-PDGM test cases.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-neutral-900/60 p-6 border border-neutral-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Modality E1</div>
                <h3 className="text-lg font-bold text-white mt-1">Fused (Imaging + Clinical)</h3>
                <p className="text-xs text-neutral-400 mt-2">
                  Joint latent cross-attention fusing deep 3D ResNet volume features with age and sex biomarkers.
                </p>
              </div>
              <div className="mt-6 flex items-baseline justify-between pt-4 border-t border-neutral-800">
                <span className="text-xs font-semibold text-neutral-400">Out-of-Fold AUC</span>
                <span className="text-xl font-black text-red-400">0.963</span>
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-900/60 p-6 border border-neutral-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Modality E2</div>
                <h3 className="text-lg font-bold text-white mt-1">Imaging Only (Zero Prior)</h3>
                <p className="text-xs text-neutral-400 mt-2">
                  Unbiased radiomic deep learning directly from T1ce, T2, and FLAIR skull-stripped NIfTI volumes.
                </p>
              </div>
              <div className="mt-6 flex items-baseline justify-between pt-4 border-t border-neutral-800">
                <span className="text-xs font-semibold text-neutral-400">Out-of-Fold AUC</span>
                <span className="text-xl font-black text-red-400">0.941</span>
              </div>
            </div>

            <div className="rounded-2xl bg-neutral-900/60 p-6 border border-neutral-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Modality E4</div>
                <h3 className="text-lg font-bold text-white mt-1">Fused Given Known IDH</h3>
                <p className="text-xs text-neutral-400 mt-2">
                  Conditional probability Bayesian inference predicting 1p/19q codeletion conditioned on verified IDH status.
                </p>
              </div>
              <div className="mt-6 flex items-baseline justify-between pt-4 border-t border-neutral-800">
                <span className="text-xs font-semibold text-neutral-400">Out-of-Fold AUC</span>
                <span className="text-xl font-black text-red-400">0.982</span>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-neutral-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-neutral-400">9 Pre-loaded Benchmark Scans</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-bold">240×240×155</span>
            </div>
            <a
              href="/viewer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm shadow hover:bg-neutral-200 transition duration-200"
            >
              <span>Launch 3D DICOM PACS Viewer</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
