import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const StudentAuthContext = createContext(null)

export function StudentAuthProvider({ children }) {
  const [estudiante, setEstudiante] = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('est_usuario')
      if (stored) setEstudiante(JSON.parse(stored))
    } catch { /* token corrupto */ }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const { data } = await axios.post(`${API_URL}/estudiante/login/`, { username, password })
    localStorage.setItem('est_access',  data.access)
    localStorage.setItem('est_refresh', data.refresh)
    localStorage.setItem('est_usuario', JSON.stringify(data.usuario))
    setEstudiante(data.usuario)
    return data
  }

  const registro = async (form) => {
    await axios.post(`${API_URL}/estudiante/registro/`, form)
  }

  const logout = () => {
    localStorage.removeItem('est_access')
    localStorage.removeItem('est_refresh')
    localStorage.removeItem('est_usuario')
    setEstudiante(null)
  }

  const apiEst = axios.create({ baseURL: API_URL })
  apiEst.interceptors.request.use(cfg => {
    const token = localStorage.getItem('est_access')
    if (token) cfg.headers.Authorization = `Bearer ${token}`
    return cfg
  })
  apiEst.interceptors.response.use(
    res => res,
    async err => {
      const orig = err.config
      if (err.response?.status === 401 && !orig._retry) {
        orig._retry = true
        try {
          const refresh = localStorage.getItem('est_refresh')
          const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh })
          localStorage.setItem('est_access', data.access)
          orig.headers.Authorization = `Bearer ${data.access}`
          return apiEst(orig)
        } catch {
          logout()
          window.location.href = '/estudiante/login'
        }
      }
      return Promise.reject(err)
    }
  )

  return (
    <StudentAuthContext.Provider value={{ estudiante, login, registro, logout, loading, apiEst }}>
      {children}
    </StudentAuthContext.Provider>
  )
}

export const useStudentAuth = () => useContext(StudentAuthContext)
