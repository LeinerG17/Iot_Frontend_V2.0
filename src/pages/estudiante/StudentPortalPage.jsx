import { useEffect, useRef, useState, useCallback } from 'react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { useNavigate } from 'react-router-dom'
import { getParadaCercana } from '../../services/api'

export default function StudentPortalPage() {
  const { estudiante, logout, apiEst } = useStudentAuth()
  const navigate = useNavigate()

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const rutaLayers = useRef([])
  const mapReady = useRef(false)
  const rutaPendiente = useRef(null)
  const geoMarkerRef = useRef(null)
  const geoCircleRef = useRef(null)
  const nearbyLayerRef = useRef(null)

  const [rutas, setRutas] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [geoActivo, setGeoActivo] = useState(false)
  const [paradaCercana, setParadaCercana] = useState(null)

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

    const interval = setInterval(() => {
      if (window.L && document.getElementById('student-map')) {
        clearInterval(interval)
        initMap()
      }
    }, 200)

    return () => clearInterval(interval)
  }, [])

  const limpiarCapas = () => { rutaLayers.current.forEach(l => l.remove()); rutaLayers.current = [] }

  const dibujarRuta = async (ruta) => {
    if (!mapReady.current || !mapInstance.current || !window.L) {
      rutaPendiente.current = ruta; return
    }
    const L = window.L
    limpiarCapas()

    if (nearbyLayerRef.current) { mapInstance.current.removeLayer(nearbyLayerRef.current); nearbyLayerRef.current = null }

    const paradas = (ruta.paradas ?? []).filter(p => p.latitud && p.longitud).sort((a, b) => a.orden - b.orden)
    if (!paradas.length) return

    const coords = paradas.map(p => [p.latitud, p.longitud])

    const osrmCoords = paradas.map(p => `${p.longitud},${p.latitud}`).join(';')
    try {
      const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`)
      const osrmData = await resp.json()
      if (osrmData.code === 'Ok' && osrmData.routes?.length) {
        const routeCoords = osrmData.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
        const poly = L.polyline(routeCoords, { color: '#3b82f6', weight: 5, opacity: .9 }).addTo(mapInstance.current)
        rutaLayers.current.push(poly)
        mapInstance.current.fitBounds(poly.getBounds(), { padding: [50, 50] })
      } else {
        throw new Error('OSRM fallback')
      }
    } catch {
      const poly = L.polyline(coords, { color: '#3b82f6', weight: 5, opacity: 0.6, dashArray: '8,8' }).addTo(mapInstance.current)
      rutaLayers.current.push(poly)
      mapInstance.current.fitBounds(poly.getBounds(), { padding: [50, 50] })
    }

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

  const activarGeolocalizacion = () => {
    const L = window.L
    if (!L || !mapInstance.current || !navigator.geolocation) return

    setGeoActivo(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords

        if (geoMarkerRef.current) mapInstance.current.removeLayer(geoMarkerRef.current)
        if (geoCircleRef.current) mapInstance.current.removeLayer(geoCircleRef.current)

        const icon = L.divIcon({
          className: '',
          html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
          iconSize: [16, 16], iconAnchor: [8, 8]
        })
        geoMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(mapInstance.current)
          .bindPopup('<div style="font-family:DM Sans,sans-serif;padding:4px"><strong>📍 Tu ubicación</strong></div>')

        geoCircleRef.current = L.circle([latitude, longitude], {
          radius: 50, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 2
        }).addTo(mapInstance.current)

        mapInstance.current.setView([latitude, longitude], 15)

        try {
          const { data } = await getParadaCercana(latitude, longitude)
          if (data.parada) {
            setParadaCercana(data)
            const nearIcon = L.divIcon({
              className: '',
              html: '<div style="width:28px;height:28px;background:#f59e0b;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
              iconSize: [28, 28], iconAnchor: [14, 14]
            })
            if (nearbyLayerRef.current) mapInstance.current.removeLayer(nearbyLayerRef.current)
            nearbyLayerRef.current = L.marker([data.parada.latitud, data.parada.longitud], { icon: nearIcon })
              .addTo(mapInstance.current)
              .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:6px"><strong>📍 ${data.parada.nombre}</strong><br/><span style="color:#64748b">A ${data.distancia_m} m</span></div>`)
          }
        } catch {}
      },
      () => { setGeoActivo(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (cargando) return (
    <div style={s.loading}><div className="spinner" /> Cargando...</div>
  )

  return (
    <div style={s.layout}>
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
        <div style={s.secLabel}>RUTAS DISPONIBLES — {rutas.length}</div>
        {rutas.length === 0 && <div style={s.empty}>Sin rutas activas.</div>}

        {rutas.map(r => (
          <div key={r.id} style={{ ...s.rutaCard, ...(rutaActiva?.id === r.id ? s.rutaActiva : {}) }} onClick={() => seleccionarRuta(r)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🗺</span>
              <div style={{ flex: 1 }}>
                <div style={s.rutaNombre}>{r.nombre}</div>
                <div style={s.rutaMeta}>{r.total_paradas} paradas</div>
              </div>
              <span className={`operational-badge ${r.operativa ? 'online' : 'offline'}`}>
                {r.operativa ? '🟢 Operativa' : '⚪ Sin servicio'}
              </span>
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
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{p.nombre}</div>
                  {p.descripcion && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.descripcion}</div>}
                </div>
              </div>
            )
          })}
        </>}
        <div style={{ height: 40 }} />
      </div>

      <button onClick={() => { setSidebarOpen(v => !v); setTimeout(() => mapInstance.current?.invalidateSize(), 300) }} style={s.toggle}>
        {sidebarOpen ? '◀' : '▶'}
      </button>

      <div style={s.mapaWrapper}>
        <div ref={mapRef} id="student-map" style={s.mapaDiv} />

        {paradaCercana && (
          <div className="nearby-stop-badge">
            <span>📍</span>
            <div>
              <span className="stop-name">{paradaCercana.parada.nombre}</span>
              <span className="stop-dist"> · A {paradaCercana.distancia_m} m</span>
            </div>
            <span className="stop-close" onClick={() => { setParadaCercana(null); if (nearbyLayerRef.current) { mapInstance.current?.removeLayer(nearbyLayerRef.current); nearbyLayerRef.current = null } }}>✕</span>
          </div>
        )}

        <button className={`geo-btn${geoActivo ? ' active' : ''}`} onClick={activarGeolocalizacion} title="Mostrar mi ubicación">
          🎯
        </button>

        {rutaActiva && !tieneCoords && (
          <div style={s.overlay}>
            <span style={{ fontSize: 28 }}>📍</span>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>Sin coordenadas</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Las paradas no tienen ubicación GPS.</div>
          </div>
        )}
        {!rutaActiva && rutas.length > 0 && (
          <div style={s.overlay}>
            <span style={{ fontSize: 28 }}>👈</span>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>Selecciona una ruta</div>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>para ver el recorrido</div>
          </div>
        )}
        {rutaActiva && tieneCoords && (
          <div style={s.infoBadge}>
            <span>🗺</span>
            <span style={{ fontWeight: 600 }}>{rutaActiva.nombre}</span>
            <span style={{ color: 'var(--text3)' }}>·</span>
            <span style={{ color: 'var(--text2)', fontSize: 12 }}>{rutaActiva.total_paradas} paradas</span>
            <span className={`operational-badge ${rutaActiva.operativa ? 'online' : 'offline'}`} style={{ marginLeft: 4 }}>
              {rutaActiva.operativa ? '🟢 Operativa' : '⚪ Sin servicio'}
            </span>
            <button onClick={() => { limpiarCapas(); setRutaActiva(null) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>✕</button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: 'var(--text3)', background: 'var(--bg)', fontSize: 14 },
  layout: { display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg)', overflow: 'hidden' },
  sidebar: { background: 'var(--bg2)', borderRight: '1px solid var(--border)', flexShrink: 0, transition: 'width .25s ease', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '18px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 },
  sidebarTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  sidebarSub: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  userBadge: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', borderRadius: 10, padding: '9px 11px' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 },
  userName: { fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRol: { fontSize: 11, color: 'var(--text3)' },
  btnLogout: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 15, padding: 2 },
  secLabel: { padding: '14px 14px 6px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '1.5px', flexShrink: 0 },
  empty: { padding: '10px 14px', color: 'var(--text3)', fontSize: 13 },
  errorBox: { margin: '10px 14px', padding: '10px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 8, color: '#fca5a5', fontSize: 13, border: '1px solid rgba(239,68,68,.2)' },
  rutaCard: { margin: '4px 10px', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all .15s' },
  rutaActiva: { borderColor: '#3b82f6', background: 'rgba(59,130,246,.07)' },
  rutaNombre: { fontSize: 13.5, fontWeight: 700, color: 'var(--text)' },
  rutaMeta: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  conductorBox: { background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' },
  conductorLbl: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, marginBottom: 4 },
  conductorNombre: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  conductorTel: { display: 'block', fontSize: 12, color: '#60a5fa', textDecoration: 'none', marginTop: 4 },
  noConductor: { fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' },
  paradaNum: { width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 },
  toggle: { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 1000, background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 8px 8px 0', color: 'var(--text3)', cursor: 'pointer', padding: '12px 6px', fontSize: 12 },
  mapaWrapper: { flex: 1, position: 'relative', minWidth: 0 },
  mapaDiv: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 36px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 500, pointerEvents: 'none' },
  infoBadge: { position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', zIndex: 500, fontSize: 13.5, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.15)' },
}
