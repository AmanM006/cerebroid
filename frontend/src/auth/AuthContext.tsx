import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { api, setSessionExpiredHandler } from "../api/client"
import type { User } from "../api/types"

interface AuthState {
  user: User | null
  /** true until the initial session-restore attempt finishes */
  restoring: boolean
  login: (username: string, password: string)=>Promise<void>
  logout: ()=>Promise<void>
}

const AuthContext=createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]=useState<User | null>(null)
  const [restoring, setRestoring]=useState(true)

  useEffect(()=>{
    setSessionExpiredHandler(()=>setUser(null))
    api.resume()
      .then(setUser)
      .catch(()=>setUser(null))
      .finally(()=>setRestoring(false))
  }, [])

  const login=useCallback(async (username: string, password: string)=>{
    setUser(await api.login(username, password))
  }, [])

  const logout=useCallback(async ()=>{
    await api.logout()
    setUser(null)
  }, [])

  const value=useMemo(()=>({ user, restoring, login, logout }), [user, restoring, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context=useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}
