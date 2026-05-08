import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// AUTH
export const login = (username, password) =>
  api.post('/auth/login/', { username, password })

// RUTAS
export const getRutas        = ()      => api.get('/rutas/')
export const getRutaDetalle  = (id)    => api.get(`/rutas/${id}/paradas/`)
export const crearRuta       = (data)  => api.post('/rutas/', data)
export const actualizarRuta  = (id, d) => api.put(`/rutas/${id}/`, d)
export const eliminarRuta    = (id)    => api.delete(`/rutas/${id}/`)

// PARADAS
export const getParadas       = ()      => api.get('/paradas/')
export const crearParada      = (data)  => api.post('/paradas/', data)
export const actualizarParada = (id, d) => api.put(`/paradas/${id}/`, d)
export const eliminarParada   = (id)    => api.delete(`/paradas/${id}/`)

// RUTA-PARADAS (relación M2M)
export const getRutaParadas     = (rutaId) => api.get(`/ruta-paradas/?ruta=${rutaId}&ordering=orden`)
export const agregarParadaRuta  = (data)   => api.post('/ruta-paradas/', data)
export const actualizarOrdenRP  = (id, d)  => api.patch(`/ruta-paradas/${id}/`, d)
export const eliminarParadaRuta = (id)     => api.delete(`/ruta-paradas/${id}/`)

// VEHÍCULOS
export const getVehiculos       = ()      => api.get('/vehiculos/')
export const crearVehiculo      = (data)  => api.post('/vehiculos/', data)
export const actualizarVehiculo = (id, d) => api.put(`/vehiculos/${id}/`, d)
export const eliminarVehiculo   = (id)    => api.delete(`/vehiculos/${id}/`)

// CONDUCTORES
export const getConductores       = ()      => api.get('/conductores/')
export const crearConductor       = (data)  => api.post('/conductores/', data)
export const actualizarConductor  = (id, d) => api.put(`/conductores/${id}/`, d)
export const eliminarConductor    = (id)    => api.delete(`/conductores/${id}/`)

// ASIGNACIONES
export const getAsignaciones      = ()      => api.get('/asignaciones/')
export const crearAsignacion      = (data)  => api.post('/asignaciones/', data)
export const actualizarAsignacion = (id, d) => api.put(`/asignaciones/${id}/`, d)
export const eliminarAsignacion   = (id)    => api.delete(`/asignaciones/${id}/`)

// DISPOSITIVOS
export const getDevices       = ()      => api.get('/devices/')
export const crearDevice      = (data)  => api.post('/devices/register/', data)
export const actualizarDevice = (id, d) => api.put(`/devices/${id}/`, d)
export const eliminarDevice   = (id)    => api.delete(`/devices/${id}/`)

// UBICACIÓN
export const getUbicacionTiempoReal = () => api.get('/ubicacion/tiempo-real/')
export const getReadings = (deviceId) =>
  api.get(`/readings/list/${deviceId ? `?device=${deviceId}` : ''}`)

// COMANDOS
export const enviarComando = (data) => api.post('/commands/', data)
export const getComandos   = ()     => api.get('/commands/list/')

// HISTORIAL / ALERTAS
export const getHistorial = () => api.get('/recorridos/')
export const getAlertas   = () => api.get('/alertas/')

// DASHBOARD
export const getDashboardStats = async () => {
  const [vehiculos, rutas, conductores, alertas, ubicacion] = await Promise.all([
    api.get('/vehiculos/'),
    api.get('/rutas/'),
    api.get('/conductores/'),
    api.get('/alertas/'),
    api.get('/ubicacion/tiempo-real/'),
  ])
  const norm = d => d?.resultados ?? d?.results ?? (Array.isArray(d) ? d : [])
  return {
    vehiculos:   norm(vehiculos.data),
    rutas:       norm(rutas.data),
    conductores: norm(conductores.data),
    alertas:     norm(alertas.data),
    ubicacion:   ubicacion.data,
  }
}

export default api
