import { useState, useEffect, type FormEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "../auth/AuthContext"
import { LiquidAuroraCanvas } from "../components/LiquidAuroraCanvas"

const professionalSlides = [
  {
    title: (
      <>
        Clinical Portal
        <br />
        Authentication
      </>
    ),
    desc: "Authorized diagnostic access for neuro-oncology specialists, radiologists, and molecular pathologists.",
  },
  {
    title: (
      <>
        Virtual Molecular
        <br />
        Biopsy System
      </>
    ),
    desc: "Non-invasive multiparametric MRI deep phenotyping: IDH1/2 mutation, 1p/19q codeletion, and MGMT methylation.",
  },
  {
    title: (
      <>
        Multiplicity Model
        <br />
        Concordance
      </>
    ),
    desc: "Empowering clinical decision support with cross-validated stability metrics across the UCSF-PDGM cohort.",
  },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)

  // Carousel slide timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % professionalSlides.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  if (user) return <Navigate to="/cases" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err?.message || "Invalid credentials or server error.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // Outermost canvas background is slightly brighter charcoal (#1a1a1e)
    <div className="flex items-center justify-center min-h-screen w-full bg-[#1a1a1e] font-sans p-0 md:p-5 selection:bg-neutral-800 selection:text-white">
      
      {/* Outer Card with Exact Mes26 Dark Palette #0a0a0a */}
      <div className="relative w-full h-[100dvh] md:w-[96vw] md:max-w-[1600px] md:h-[92vh] bg-[#0a0a0a] md:rounded-[30px] overflow-hidden flex flex-col lg:flex-row shadow-[0_25px_70px_rgba(0,0,0,0.6)] md:border border-white/5">
        
        {/* LEFT SECTION (60%): Interactive Liquid Shader + Carousel Text */}
        <div className="relative w-full h-[38vh] lg:h-full lg:w-[60%] bg-black flex-shrink-0 overflow-hidden">
          
          {/* Back to website Pill Button */}
          <Link
            to="/"
            className="absolute top-6 left-6 lg:top-8 lg:left-auto lg:right-8 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15 transition-all duration-300 group cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden lg:inline">Back to website</span>
            <span className="lg:hidden">Home</span>
          </Link>

          {/* Exact MES26 WebGL Fluid Aurora Canvas: autonomous, glowing crimson waves, no mouse warp */}
          <div className="absolute inset-0 opacity-90 lg:scale-110">
            <LiquidAuroraCanvas
              colors={["#ef4444", "#dc2626", "#000000"]}
              speed={0.2}
              frequency={1}
              noise={0.1}
            />
          </div>

          {/* Vignette Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 lg:bg-gradient-to-t lg:from-black/70 lg:to-black/30 pointer-events-none" />

          {/* Desktop Left Carousel Content: Clean, Non-Italic, Professional Medical Doctor Portal Copy */}
          <div className="hidden lg:block absolute bottom-12 left-12 z-20 max-w-lg">
            <div className="h-[150px] flex items-end">
              <div key={currentSlide} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
                <h2
                  className="text-4xl xl:text-5xl font-extrabold not-italic mb-3 text-white leading-tight tracking-tight"
                  style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
                >
                  {professionalSlides[currentSlide]?.title}
                </h2>
                <p className="text-neutral-300 text-sm xl:text-base leading-relaxed max-w-md font-normal">
                  {professionalSlides[currentSlide]?.desc}
                </p>
              </div>
            </div>

            {/* Pill Carousel Indicator Lines */}
            <div className="flex gap-2 mt-8">
              {professionalSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${
                    idx === currentSlide ? "w-8 bg-white" : "w-2 bg-white/30 hover:bg-white/60"
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Mobile Bottom Title */}
          <div className="lg:hidden absolute bottom-8 left-6 z-20">
            <h1
              className="text-3xl font-extrabold not-italic text-white leading-none drop-shadow-lg"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              NovaCell
            </h1>
            <p className="text-red-200/90 text-xs mt-1.5 font-medium tracking-wide flex items-center gap-2">
              <span className="w-6 h-[1px] bg-red-400" />
              Clinical Neuro-Oncology Gateway
            </p>
          </div>
        </div>

        {/* RIGHT SECTION (40%): Original Dark #0e0e0e Container with Red Inputs and White Button */}
        <div className="relative flex-1 w-full lg:w-[40%] bg-[#0e0e0e] flex flex-col px-6 md:px-14 lg:px-16 pt-10 pb-6 lg:py-8 rounded-t-[35px] lg:rounded-none -mt-8 lg:mt-0 z-10 overflow-y-auto border-t border-white/10 lg:border-none shadow-[0_-10px_40px_rgba(0,0,0,0.5)] lg:shadow-none justify-center">
          
          <div className="lg:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-8 flex-shrink-0" />

          <div className="w-full max-w-sm mx-auto my-auto">
            
            {/* Header: Clean Sign In */}
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                Sign In
              </h2>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-xs font-medium border bg-red-500/10 border-red-500/20 text-red-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={onSubmit} className="space-y-5">
              
              {/* Floating-Label Username / ID Input with Deep Crimson-Red Tint Base */}
              <div className="w-full">
                <div className="relative group">
                  <input
                    type="text"
                    required
                    placeholder="doctor"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="peer w-full rounded-xl px-4 py-4 pt-6 pb-2 text-base md:text-sm bg-[#2b1115] border border-red-900/60 text-white placeholder-transparent focus:outline-none focus:border-red-500 focus:bg-[#36141a] transition-all duration-200 shadow-inner"
                  />
                  <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-red-400/80 transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-red-300/60 peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-red-400 pointer-events-none">
                    Username / Clinical ID
                  </label>
                </div>
              </div>

              {/* Floating-Label Password Input with Deep Crimson-Red Tint Base */}
              <div className="space-y-1">
                <div className="w-full">
                  <div className="relative group">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="peer w-full rounded-xl px-4 py-4 pt-6 pb-2 text-base md:text-sm bg-[#2b1115] border border-red-900/60 text-white placeholder-transparent focus:outline-none focus:border-red-500 focus:bg-[#36141a] transition-all duration-200 shadow-inner"
                    />
                    <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-red-400/80 transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-red-300/60 peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-red-400 pointer-events-none">
                      Password
                    </label>
                  </div>
                </div>
              </div>

              {/* Clean White Background Button with Black Text */}
              <button
                type="submit"
                disabled={submitting}
                className="group w-full mt-5 bg-white hover:bg-neutral-100 text-black py-4 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_4px_24px_rgba(255,255,255,0.2)] hover:shadow-[0_6px_32px_rgba(255,255,255,0.35)] active:scale-[0.99] cursor-pointer border border-white"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                ) : (
                  <>
                    <span>ACCESS CLINICAL DASHBOARD</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-black" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Test Accounts for Evaluators */}
            <div className="mt-6 pt-4 border-t border-white/10 text-center font-mono">
              <p className="text-[11px] text-neutral-400 mb-2">Test / Evaluator Access:</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("doctor")
                    setPassword("doctor-clinical-demo-2026")
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-xs text-neutral-300 transition-colors cursor-pointer"
                >
                  Fill: <span className="text-white font-bold">doctor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("evaluator")
                    setPassword("vbx-eval-fcd664d1")
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-xs text-neutral-300 transition-colors cursor-pointer"
                >
                  Fill: <span className="text-white font-bold">evaluator</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
