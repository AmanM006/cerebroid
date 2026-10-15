import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "./auth/AuthContext"
import { CaseWorkspacePage } from "./pages/CaseWorkspacePage"
import { CasesPage } from "./pages/CasesPage"
import { LoginPage } from "./pages/LoginPage"
import { LandingPage } from "./pages/LandingPage"

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, restoring }=useAuth()
  if (restoring) return <p className="p-6 text-sm text-slate-400">Restoring session…</p>
  return user ? children : <Navigate to="/login" replace />
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cases" element={<RequireAuth><CasesPage /></RequireAuth>} />
          <Route path="/cases/:caseId" element={<RequireAuth><CaseWorkspacePage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
