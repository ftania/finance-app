import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/api'
import { AuthContext } from './AuthContext'

const TOKEN_KEY = 'finance_token'
const storedToken = () => localStorage.getItem(TOKEN_KEY)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(storedToken)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(storedToken()))

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    let shouldIgnore = false

    if (!token) {
      return undefined
    }

    async function loadUser() {
      try {
        const { data } = await api.get('/auth/me')

        if (!shouldIgnore) {
          setUser(data.user)
        }
      } catch {
        if (!shouldIgnore) {
          clearSession()
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      shouldIgnore = true
    }
  }, [clearSession, token])

  useEffect(() => {
    window.addEventListener('auth:logout', clearSession)

    return () => {
      window.removeEventListener('auth:logout', clearSession)
    }
  }, [clearSession])

  const persistSession = useCallback((authToken, authUser) => {
    localStorage.setItem(TOKEN_KEY, authToken)
    setToken(authToken)
    setUser(authUser)
    setIsLoading(false)
  }, [])

  const login = useCallback(async (payload) => {
    const { data } = await api.post('/auth/login', payload)
    persistSession(data.token, data.user)
    return data.user
  }, [persistSession])

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    persistSession(data.token, data.user)
    return data.user
  }, [persistSession])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    setUser(data.user)
    return data.user
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout: clearSession,
      refreshUser,
    }),
    [token, user, isLoading, login, register, clearSession, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
