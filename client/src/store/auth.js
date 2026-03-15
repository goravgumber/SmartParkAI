import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { api, publicApi } from '../services/api'
import { connectSocket, disconnectSocket, syncSocketAuth } from '../lib/socket'

const AuthContext = createContext(null)

const initialState = {
  user: null,
  token: localStorage.getItem('smartpark_token') || null,
  isAuthenticated: Boolean(localStorage.getItem('smartpark_token')),
  loading: true
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false
      }
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const logout = useCallback(() => {
    localStorage.removeItem('smartpark_token')
    localStorage.removeItem('smartpark_user')
    syncSocketAuth()
    disconnectSocket()
    dispatch({ type: 'LOGOUT' })
  }, [])

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await publicApi.post('/auth/login', { email, password })
      const payload = response.data.data
      localStorage.setItem('smartpark_token', payload.token)
      localStorage.setItem('smartpark_user', JSON.stringify(payload.user))
      connectSocket()

      dispatch({ type: 'LOGIN', payload })
      return payload
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false })
      throw error
    }
  }, [])

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('smartpark_token')
    if (!token) {
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }

    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const response = await api.get('/auth/me')
      const user = response.data.data
      localStorage.setItem('smartpark_user', JSON.stringify(user))
      connectSocket()
      dispatch({ type: 'LOGIN', payload: { user, token } })
    } catch (_error) {
      logout()
    }
  }, [logout])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
      checkAuth
    }),
    [state, login, logout, checkAuth]
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
