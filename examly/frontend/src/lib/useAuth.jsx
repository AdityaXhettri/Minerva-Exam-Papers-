import { createContext, useContext, useState, useEffect } from 'react'
import api from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('examly_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('examly_user')
      }
    }
    setLoading(false)
  }, [])

  async function login(username, password, role) {
    const { data } = await api.post('/auth/login', { username, password })
    if (data.user.role !== role) {
      throw new Error(`This account is not a ${role}. Please use the correct tab.`)
    }
    localStorage.setItem('examly_token', data.token)
    localStorage.setItem('examly_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {}
    localStorage.removeItem('examly_token')
    localStorage.removeItem('examly_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
