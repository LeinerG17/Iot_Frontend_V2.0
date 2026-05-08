import { useEffect, useRef, useState, useCallback } from 'react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { useNavigate } from 'react-router-dom'

export default function StudentPortalPage() {
  const { estudiante, logout, apiEst } = useStudentAuth()
  const navigate = useNavigate()

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const rutaLayers = useRef([])
  const mapReady = useRef(false)
  const rutaPendiente = useRef(null)

  const [rutas, setRutas] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Espera a que window.L esté disponible (Leaflet carga desde index.html)
  const esperarLeaflet = (cb, n = 0) => {
    if (window.L) { cb(); return }
    if (n > 30) return
    setTimeout(() => esperarLeaflet(cb, n + 1), 150)
  }

  useEffect(() => {
    const initMap = () => {
      const L = window.L
      const container = document.getElementById('student-map')
      if (!L || !container || mapInstance.current) return

      mapInstance.current = L.map(container, {
        center: [11.5444, -72.9072],
        zoom: 13
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapInstance.current)

      setTimeout(() => {
        mapInstance.current?.invalidateSize()
        mapReady.current = true
        if (rutaPendiente.current) {
          dibujarRuta(rutaPendiente.current)
          rutaPendiente.current = null
        }
      }, 300)
    }

    // Intentar cada 200ms hasta que Leaflet esté listo
    const interval = setInterval(() => {
      if (window.L && document.getElementById('student-map')) {
        clearInterval(interval)
        initMap()
      }
    }, 200)

    return () => clearInterval(interval)
  }, [])

  const limpiarCapas = () => { rutaLayers.current.forEach(l => l.remove()); rutaLayers.current = [] }

  const dibujarRuta = (ruta) => {
    if (!mapReady.current || !mapInstance.current || !window.L) {
      rutaPendiente.current = ruta; return
    }
    const L = window.L
    limpiarCapas()
    const paradas = (ruta.paradas ?? []).filter(p => p.latitud && p.longitud).sort((a, b) => a.orden - b.orden)
    if (!paradas.length) return

    const coords = paradas.map(p => [p.latitud, p.longitud])
    const poly = L.polyline(coords, { color: '#3b82f6', weight: 5, opacity: .9 }).addTo(mapInstance.current)
    rutaLayers.current.push(poly)

    paradas.forEach((p, i) => {
      const ini = i === 0, fin = i === paradas.length - 1
      const color = ini ? '#22c55e' : fin ? '#ef4444' : '#3b82f6'
      const label = ini ? '▶' : fin ? '■' : String(i + 1)
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${ini || fin ? color : '#1e2535'};color:${ini || fin ? '#fff' : '#60a5fa'};border:2px solid ${color};border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.4)">${label}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      })
      const m = L.marker([p.latitud, p.longitud], { icon }).addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:6px;min-width:150px"><div style="font-weight:700;margin-bottom:4px">📍 ${p.nombre}</div>${p.descripcion ? `<div style="color:#666;font-size:12px">${p.descripcion}</div>` : ''}<div style="font-size:11px;color:#888;margin-top:4px">Parada ${i + 1} de ${paradas.length}</div></div>`)
      rutaLayers.current.push(m)
    })
    mapInstance.current.fitBounds(poly.getBounds(), { padding: [50, 50] })
  }

  const seleccionarRuta = useCallback((ruta) => { setRutaActiva(ruta); dibujarRuta(ruta) }, [])

  const cargarRutas = useCallback(async () => {
    try {
      const { data } = await apiEst.get('/estudiante/rutas/')
      const lista = data.rutas ?? []
      setRutas(lista)
      if (lista.length > 0) { setRutaActiva(lista[0]); dibujarRuta(lista[0]) }
    } catch (err) {
      if (err.response?.status === 401) { logout(); navigate('/estudiante/login') }
      else setError('No se pudieron cargar las rutas.')
    } finally { setCargando(false) }
  }, [apiEst, logout, navigate])

  useEffect(() => { cargarRutas() }, [cargarRutas])

  const handleLogout = () => { logout(); navigate('/estudiante/login') }
  const tieneCoords = (rutaActiva?.paradas ?? []).some(p => p.latitud && p.longitud)

  if (cargando) return (
    <div style={s.loading}><div className="spinner" /> Cargando...</div>
  )

  return (
    <div style={s.layout}>
      {/* SIDEBAR */}
      <div style={{ ...s.sidebar, width: sidebarOpen ? 300 : 0 }}>
        <div style={s.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🚌</span>
            <div>
              <div style={s.sidebarTitle}>Mis Rutas</div>
              <div style={s.sidebarSub}>Portal Estudiantil</div>
            </div>
          </div>
          <div style={s.userBadge}>
            <div style={s.avatar}>{(estudiante?.nombre || estudiante?.username || 'E')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{estudiante?.nombre || estudiante?.username}</div>
              <div style={s.userRol}>Estudiante</div>
            </div>
            <button onClick={handleLogout} style={s.btnLogout} title="Cerrar sesión">⏏</button>
          </div>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}
        <div style={s.secLabel}>RUTAS — {rutas.length}</div>
        {rutas.length === 0 && <div style={s.empty}>Sin rutas activas.</div>}

        {rutas.map(r => (
          <div key={r.id} style={{ ...s.rutaCard, ...(rutaActiva?.id === r.id ? s.rutaActiva : {}) }} onClick={() => seleccionarRuta(r)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🗺</span>
              <div style={{ flex: 1 }}>
                <div style={s.rutaNombre}>{r.nombre}</div>
                <div style={s.rutaMeta}>{r.total_paradas} paradas</div>
              </div>
              {rutaActiva?.id === r.id && <span style={s.badge}>Activa</span>}
            </div>
            {r.conductor ? (
              <div style={s.conductorBox}>
                <div style={s.conductorLbl}>CONDUCTOR</div>
                <div style={s.conductorNombre}>{r.conductor.nombre}</div>
                {r.conductor.vehiculo && (
                  <div style={s.conductorTel}>🚌 {r.conductor.vehiculo}</div>
                )}
              </div>
            ) : <div style={s.noConductor}>Sin conductor asignado</div>}
          </div>
        ))}

        {rutaActiva && <>
          <div style={s.secLabel}>PARADAS — {rutaActiva.nombre}</div>
          {(rutaActiva.paradas ?? []).length === 0 && <div style={s.empty}>Sin paradas.</div>}
          {(rutaActiva.paradas ?? []).map((p, i) => {
            const ini = i === 0, fin = i === rutaActiva.paradas.length - 1
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 14px' }}>
                <div style={{ ...s.paradaNum, background: ini ? 'rgba(34,197,94,.18)' : fin ? 'rgba(239,68,68,.18)' : 'rgba(59,130,246,.12)', color: ini ? '#22c55e' : fin ? '#ef4444' : '#60a5fa' }}>
                  {ini ? '▶' : fin ? '■' : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{p.nombre}</div>
                  {p.descripcion && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.descripcion}</div>}
                </div>
              </div>
            )
          })}
        </>}
        <div style={{ height: 40 }} />
      </div>

      {/* TOGGLE */}
      <button onClick={() => { setSidebarOpen(v => !v); setTimeout(() => mapInstance.current?.invalidateSize(), 300) }} style={s.toggle}>
        {sidebarOpen ? '◀' : '▶'}
      </button>

      {/* MAPA — position:absolute inset:0 garantiza altura */}
      <div style={s.mapaWrapper}>
        <div ref={mapRef} id="student-map" style={s.mapaDiv} />
        {rutaActiva && !tieneCoords && (
          <div style={s.overlay}>
            <span style={{ fontSize: 28 }}>📍</span>
            <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Sin coordenadas</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>Las paradas no tienen ubicación GPS.</div>
          </div>
        )}
        {!rutaActiva && rutas.length > 0 && (
          <div style={s.overlay}>
            <span style={{ fontSize: 28 }}>👈</span>
            <div style={{ fontWeight: 600, color: '#e2e8f0' }}>Selecciona una ruta</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>para ver el recorrido</div>
          </div>
        )}
        {rutaActiva && tieneCoords && (
          <div style={s.infoBadge}>
            <span>🗺</span>
            <span style={{ fontWeight: 600 }}>{rutaActiva.nombre}</span>
            <span style={{ color: '#64748b' }}>·</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{rutaActiva.total_paradas} paradas</span>
            <button onClick={() => { limpiarCapas(); setRutaActiva(null) }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>✕</button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: '#94a3b8', background: '#0f1117', fontSize: 14 },
  layout: { display: 'flex', height: '100vh', width: '100vw', background: '#0f1117', overflow: 'hidden' },
  sidebar: { background: '#161b27', borderRight: '1px solid #2a3348', flexShrink: 0, transition: 'width .25s ease', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '18px 14px', borderBottom: '1px solid #2a3348', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 },
  sidebarTitle: { fontSize: 15, fontWeight: 700, color: '#e2e8f0' },
  sidebarSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  userBadge: { display: 'flex', alignItems: 'center', gap: 10, background: '#1e2535', borderRadius: 10, padding: '9px 11px' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRol: { fontSize: 11, color: '#64748b' },
  btnLogout: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15, padding: 2 },
  secLabel: { padding: '14px 14px 6px', fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '1.5px', flexShrink: 0 },
  empty: { padding: '10px 14px', color: '#64748b', fontSize: 13 },
  errorBox: { margin: '10px 14px', padding: '10px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 8, color: '#fca5a5', fontSize: 13, border: '1px solid rgba(239,68,68,.2)' },
  rutaCard: { margin: '4px 10px', padding: '11px 12px', borderRadius: 12, border: '1px solid #2a3348', cursor: 'pointer', transition: 'all .15s' },
  rutaActiva: { borderColor: '#3b82f6', background: 'rgba(59,130,246,.07)' },
  rutaNombre: { fontSize: 13.5, fontWeight: 700, color: '#e2e8f0' },
  rutaMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  badge: { fontSize: 10, fontWeight: 700, background: 'rgba(59,130,246,.18)', color: '#60a5fa', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(59,130,246,.3)' },
  conductorBox: { background: '#1e2535', borderRadius: 8, padding: '8px 10px' },
  conductorLbl: { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 1, marginBottom: 4 },
  conductorNombre: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
  conductorTel: { display: 'block', fontSize: 12, color: '#60a5fa', textDecoration: 'none', marginTop: 4 },
  noConductor: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  paradaNum: { width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 },
  toggle: { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 1000, background: '#161b27', border: '1px solid #2a3348', borderLeft: 'none', borderRadius: '0 8px 8px 0', color: '#94a3b8', cursor: 'pointer', padding: '12px 6px', fontSize: 12 },
  mapaWrapper: { flex: 1, position: 'relative', minWidth: 0 },
  mapaDiv: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(22,27,39,.92)', backdropFilter: 'blur(8px)', border: '1px solid #2a3348', borderRadius: 16, padding: '28px 36px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 500, pointerEvents: 'none' },
  infoBadge: { position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(22,27,39,.95)', backdropFilter: 'blur(8px)', border: '1px solid #2a3348', borderRadius: 12, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', zIndex: 500, fontSize: 13.5, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.4)' },
}
