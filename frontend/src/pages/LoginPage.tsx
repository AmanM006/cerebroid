import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"
import { ErrorNotice } from "../components/ErrorNotice"

export function LoginPage() {
  const { user, login }=useAuth()
  const [username, setUsername]=useState("")
  const [password, setPassword]=useState("")
  const [submitting, setSubmitting]=useState(false)
  const [error, setError]=useState<unknown>(null)

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <h1 className="text-lg font-semibold">VBX</h1>
          <p className="text-sm text-slate-400">Pre-operative molecular profile of diffuse gliomas</p>
        </div>
        <label className="block text-sm">
          <span className="text-slate-300">Username</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-sky-600"
            autoComplete="username"
            maxLength={64}
            required
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Password</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-sky-600"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            required
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
          />
        </label>
        {error!==null && <ErrorNotice error={error} />}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-sky-700 px-3 py-2 text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-slate-500">
          Research decision-support prototype. Not a diagnostic device.
        </p>
      </form>
    </main>
  )
}
