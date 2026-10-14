import { useState, useEffect } from "react"
import { ArrowDown } from "lucide-react"
import Lenis from "lenis"
import { NovaCell3DScene } from "../components/NovaCell3DScene"
import { SpecularButton } from "../components/SpecularButton"
import { TechText } from "../components/TechText"
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
    <div className="relative w-full min-h-screen bg-[#c8e8f8] text-[#0f172a] font-sans selection:bg-[#38bdf8]/30 overflow-x-hidden">
      
      {/* 
        HERO SECTION: 100vh & 100vw full bleed edge-to-edge.
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
          Only front hero cell contains the 3D tumor spheroid model; 
          all other surrounding cells are clear glass liquid vesicles.
        */}
        <NovaCell3DScene />

        {/* TOP NAVBAR: Edge-to-edge */}
        <header className="relative z-30 flex items-center justify-between px-8 sm:px-14 lg:px-20 pt-8 sm:pt-10">
          
          {/* TechText vector wordmark for NovaCell on the top left */}
          <div className="w-48 sm:w-60 h-12 flex items-center">
            <TechText
              text="NovaCell"
              fontWeight={800}
              fontSize={34}
              color="#082f49"
              accentColor="#0284c7"
              letterSpacing={-0.03}
              reach={100}
              softness={0.7}
              strokeWidth={1.4}
              speed={1}
              lineStyle="dashed"
              selection={true}
              labels={false}
              draggable={true}
              sweep={true}
            />
          </div>

          {/* React Bits Specular Button for Login */}
          <SpecularButton
            size="md"
            radius={16}
            tint="#ffffff"
            tintOpacity={0.96}
            textColor="#082f49"
            lineColor="#38bdf8"
            baseColor="#cbd5e1"
            intensity={1.2}
            idleIntensity={0.4}
            shineSize={12}
            shineFade={36}
            thickness={1.4}
            glow={1.2}
            followMouse={true}
            proximity={250}
            onClick={() => {
              window.location.href = "/viewer"
            }}
          >
            Login
          </SpecularButton>
        </header>

        {/* HERO CONTENT: Full 100vh layout with headline on bottom left and CircularText on bottom right */}
        <div className="relative z-20 flex-1 flex flex-col lg:flex-row items-end justify-between px-8 sm:px-14 lg:px-20 pb-10 sm:pb-14 gap-8">
          
          {/* Bold Display Headline with Plus Jakarta Sans */}
          <div className="max-w-2xl">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-extrabold tracking-tight text-[#082f49] leading-[1.04] transition-transform duration-200"
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

          {/* Bottom Right: Circular Rotating Text with Down Arrow in center */}
          <div 
            onClick={scrollToNextSection}
            className="relative flex items-center justify-center cursor-pointer group select-none self-end pb-2"
          >
            <CircularText
              text="SCROLL DOWN • EXPLORE COHORT • "
              spinDuration={16}
              onHover="speedUp"
              className="font-bold text-[#082f49]"
            />
            {/* Center Down Arrow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-white flex items-center justify-center text-[#082f49] group-hover:scale-110 group-hover:bg-[#0284c7] group-hover:text-white transition-all duration-300">
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </div>
            </div>
          </div>

        </div>

      </section>

      {/* 
        SECTION 2: 100vh Multiplicity & Genomic Cohort Explorer with smooth Lenis scroll
      */}
      <section className="relative w-full min-h-screen bg-gradient-to-b from-[#b7e3f8] via-[#c6e9fa] to-[#d9f2fd] px-8 sm:px-14 lg:px-20 py-16 flex flex-col justify-center">
        <div className="relative w-full max-w-7xl mx-auto rounded-[2.5rem] bg-white/75 backdrop-blur-xl border border-white/95 p-8 sm:p-12 shadow-[0_20px_60px_-15px_rgba(2,132,199,0.12)]">
          
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0284c7]/10 text-[#0284c7] text-xs font-bold uppercase tracking-wider mb-3">
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
            <div className="rounded-2xl bg-white/85 p-6 border border-white shadow-sm flex flex-col justify-between">
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

            <div className="rounded-2xl bg-white/85 p-6 border border-white shadow-sm flex flex-col justify-between">
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

            <div className="rounded-2xl bg-white/85 p-6 border border-white shadow-sm flex flex-col justify-between">
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
            <a
              href="/viewer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#082f49] text-white font-bold text-sm shadow hover:bg-[#0284c7] transition duration-200"
            >
              <span>Launch 3D DICOM PACS Viewer</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
