import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"
import { ErrorNotice } from "../components/ErrorNotice"
import { HoloCard } from "../components/HoloCard"

export function LoginPage() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (user) return <Navigate to="/cases" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#07060b] font-sans selection:bg-slate-700 selection:text-white">
      {/* Top Left Brand Logo */}
      <div className="absolute top-8 left-8 sm:top-10 sm:left-12 z-20">
        <span className="font-heading text-2xl font-black tracking-tight text-white">
          VBX
        </span>
      </div>

      {/* Left Form Section (Clean Pitch-Black Center) */}
      <div className="relative z-10 flex h-full w-full flex-col justify-center px-8 sm:px-14 lg:w-[48%] lg:px-16 xl:px-20 bg-[#07060b]">
        <div className="w-full max-w-sm mx-auto translate-x-4 sm:translate-x-8">
          <h1 className="font-heading text-4xl sm:text-[44px] font-bold text-white tracking-tight leading-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-[#8c889e] font-normal leading-relaxed">
            Virtual molecular biopsy and genomic intelligence.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {/* Email / Username */}
            <div>
              <label className="block text-xs font-semibold text-[#b5b0c8] mb-1.5 tracking-wide">
                Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#615c75]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-xl border border-[#232030] bg-[#14121d] py-3 pl-10 pr-3.5 text-sm font-medium text-white placeholder-[#615c75] outline-none transition-all focus:border-slate-500 focus:bg-[#1a1726]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#b5b0c8] mb-1.5 tracking-wide">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-[#615c75]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#232030] bg-[#14121d] py-3 pl-10 pr-3.5 text-sm font-medium text-white placeholder-[#615c75] outline-none transition-all focus:border-slate-500 focus:bg-[#1a1726]"
                />
              </div>
            </div>

            {error !== null && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-2.5 text-xs text-rose-300">
                <ErrorNotice error={error} />
              </div>
            )}

            {/* Log in Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-black shadow-md transition-all hover:bg-slate-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer tracking-wide"
            >
              {submitting ? "Signing in…" : "Log in"}
            </button>
          </form>

          <p className="mt-8 border-t border-[#1f1d2b] pt-4 text-center text-xs text-[#8c889e]">
            Accounts are issued by the team. Evaluators: use the test account listed in the README.
          </p>
        </div>
      </div>

      {/* Right Section: 3D Perspective Viewport */}
      <div className="relative hidden lg:flex lg:w-[52%] items-center justify-center p-8 lg:p-14 overflow-hidden">
        {/* Soft Ambient Radial Glow backdrop */}
        <div className="pointer-events-none absolute h-[500px] w-[500px] rounded-full bg-cyan-950/20 blur-[140px]" />
        <div className="pointer-events-none absolute h-[400px] w-[400px] rounded-full bg-indigo-950/25 blur-[130px]" />

        {/* React Bits Spring-Physics 3D HoloCard */}
        <HoloCard
          imageSrc="/assets/mri_sagittal.png"
          className="w-full max-w-[305px] -translate-x-6"
        />
      </div>
    </div>
  )
}

