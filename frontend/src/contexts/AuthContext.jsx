import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const cfg = await api.authConfig()
        setAuthEnabled(cfg.enabled)

        if (!cfg.enabled) {
          // No auth — create a local admin user object
          setUser({ id: 0, email: 'local@machine', name: 'Local User', picture: null, role: 'admin' })
          return
        }

        const token = localStorage.getItem('hr_token')
        if (token) {
          try {
            const me = await fetch('/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => (r.ok ? r.json() : null))
            if (me) setUser(me)
            else localStorage.removeItem('hr_token')
          } catch {
            localStorage.removeItem('hr_token')
          }
        }
      } catch {
        // Backend unreachable — leave user as null
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  function login(token, userData) {
    localStorage.setItem('hr_token', token)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('hr_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authEnabled,
        loading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
