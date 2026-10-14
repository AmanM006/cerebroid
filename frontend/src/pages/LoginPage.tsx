import { useState, useEffect, type FormEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "../auth/AuthContext"
import { LiquidAuroraCanvas } from "../components/LiquidAuroraCanvas"

const carouselSlides = [
  {
    title: (
      <>
        Welcome Back,
        <br />
        Innovator.
      </>
    ),
    desc: "The molecular platform awaits. Log in to access your genomic cases and PACS cohort.",
  },
  {
    title: (
      <>
        Resume Your
        <br />
        Analysis.
      </>
    ),
    desc: "Non-invasive virtual biopsy and multiplicity deep phenotyping from mpMRI volumes.",
  },
  {
    title: (
      <>
        Ready to
        <br />
        Diagnose?
      </>
    ),
    desc: "Your pass to the UCSF-PDGM clinical ecosystem is ready. Let's get started.",
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
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
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
    <div className="flex items-center justify-center min-h-screen w-full bg-[#050505] font-sans p-0 md:p-4 selection:bg-cyan-500/30">
      
      {/* Outer Card with Rounded Corners matching mes26 exactly */}
      <div className="relative w-full h-[100dvh] md:w-[96vw] md:max-w-[1600px] md:h-[92vh] bg-[#0a0a0a] md:rounded-[30px] overflow-hidden flex flex-col lg:flex-row shadow-2xl md:border border-white/5">
        
        {/* LEFT SECTION (60%): Interactive Liquid Shader + Carousel Text */}
        <div className="relative w-full h-[38vh] lg:h-full lg:w-[60%] bg-black flex-shrink-0 overflow-hidden">
          
          {/* Back to website Pill Button matching reference */}
          <Link
            to="/"
            className="absolute top-6 left-6 lg:top-8 lg:left-auto lg:right-8 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-all duration-300 group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden lg:inline">Back to website</span>
            <span className="lg:hidden">Home</span>
          </Link>

          {/* WebGL Fluid Liquid Aurora Canvas */}
          <div className="absolute inset-0 opacity-90 lg:scale-105">
            <LiquidAuroraCanvas />
          </div>

          {/* Vignette Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 lg:bg-gradient-to-t lg:from-black/60 lg:to-black/20 pointer-events-none" />

          {/* Desktop Left Carousel Content */}
          <div className="hidden lg:block absolute bottom-12 left-12 z-20 max-w-lg">
            <div className="h-[150px] flex items-end">
              <div key={currentSlide} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
                <h2
                  className="text-5xl xl:text-6xl italic font-bold mb-3 text-white leading-tight"
                  style={{ fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif" }}
                >
                  {carouselSlides[currentSlide]?.title}
                </h2>
                <p className="text-gray-400 text-sm xl:text-base leading-relaxed max-w-sm">
                  {carouselSlides[currentSlide]?.desc}
                </p>
              </div>
            </div>

            {/* Pill Carousel Indicator Lines matching reference */}
            <div className="flex gap-2 mt-8">
              {carouselSlides.map((_, idx) => (
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
              className="text-4xl italic font-bold text-white leading-none drop-shadow-lg"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              NovaCell
            </h1>
            <p className="text-cyan-200/90 text-xs mt-1.5 font-medium tracking-wide flex items-center gap-2">
              <span className="w-6 h-[1px] bg-cyan-400" />
              Virtual Molecular Biopsy
            </p>
          </div>
        </div>

        {/* RIGHT SECTION (40%): Minimalist High-End Dark Sign In Form */}
        <div className="relative flex-1 w-full lg:w-[40%] bg-[#0e0e0e] flex flex-col px-6 md:px-14 lg:px-16 pt-10 pb-6 lg:py-8 rounded-t-[35px] lg:rounded-none -mt-8 lg:mt-0 z-10 overflow-y-auto border-t border-white/10 lg:border-none shadow-[0_-10px_40px_rgba(0,0,0,0.5)] lg:shadow-none justify-center">
          
          <div className="lg:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mb-8 flex-shrink-0" />

          <div className="w-full max-w-sm mx-auto my-auto">
            
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                Sign In
              </h2>
              <p className="text-gray-500 text-sm">
                Don't have an account?{" "}
                <Link
                  to="/"
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors underline decoration-cyan-400/30 underline-offset-4"
                >
                  Create one
                </Link>
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-xs font-medium border bg-red-500/10 border-red-500/20 text-red-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form using our robust internal useAuth */}
            <form onSubmit={onSubmit} className="space-y-5">
              
              {/* Floating-Label Email Input matching MES26 */}
              <div className="w-full">
                <div className="relative group">
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="peer w-full rounded-xl px-4 py-4 pt-6 pb-2 text-base md:text-sm bg-[#151515] border border-[#252525] text-white placeholder-transparent focus:outline-none focus:border-cyan-500 focus:bg-[#1a1a1a] transition-all duration-200"
                  />
                  <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-600 peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-cyan-400 pointer-events-none">
                    Personal Email
                  </label>
                </div>
              </div>

              {/* Floating-Label Password Input */}
              <div className="space-y-1">
                <div className="w-full">
                  <div className="relative group">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="peer w-full rounded-xl px-4 py-4 pt-6 pb-2 text-base md:text-sm bg-[#151515] border border-[#252525] text-white placeholder-transparent focus:outline-none focus:border-cyan-500 focus:bg-[#1a1a1a] transition-all duration-200"
                    />
                    <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-600 peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-cyan-400 pointer-events-none">
                      Password
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault()
                      alert("Evaluators: Use demo credentials (evaluator / eval2026) or your assigned hospital account.")
                    }}
                    className="text-xs text-gray-500 hover:text-white transition-colors py-1 cursor-pointer"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              {/* Glowing Cyan CTA Button */}
              <button
                type="submit"
                disabled={submitting}
                className="group w-full mt-4 bg-gradient-to-r from-[#00a8e8] to-[#007ea7] hover:from-[#00b4d8] hover:to-[#0096c7] text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_24px_rgba(0,168,232,0.35)] hover:shadow-[0_0_35px_rgba(0,168,232,0.55)] active:scale-[0.99] cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>ACCESS DASHBOARD</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-4 border-t border-white/5 text-center">
              <span className="text-[11px] text-gray-600 font-mono">
                SECURED BY VBX MULTIMODAL AUTH GATEWAY
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
