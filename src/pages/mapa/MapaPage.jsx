import { useEffect, useRef, useState, useCallback } from 'react'
import { getUbicacionTiempoReal, getRutas, getRutaDetalle } from '../../services/api'
import Badge from '../../components/ui/Badge'

export default function MapaPage() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const vehiculoMarkers = useRef([])
  const rutaLayers = useRef([])
  const intervalRef = useRef(null)

  const [rutas, setRutas] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [rutaDetalle, setRutaDetalle] = useState(null)
  const [loadingRuta, setLoadingRuta] = useState(false)

  // Inicializar mapa
  useEffect(() => {
    if (mapInstance.current) return
    const L = window.L
    if (!L) return

    mapInstance.current = L.map(mapRef.current).setView([11.5444, -72.9072], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(mapInstance.current)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Cargar rutas
  useEffect(() => {
    getRutas().then(r => {
      const d = r.data
      setRutas(d?.resultados ?? d?.results ?? (Array.isArray(d) ? d : []))
    })
  }, [])

  // Cargar ubicaciones y actualizar cada 15s
  const cargarUbicaciones = useCallback(() => {
    getUbicacionTiempoReal().then(r => {
      setVehiculos(r.data?.vehiculos ?? [])
      actualizarVehiculos(r.data?.vehiculos ?? [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    cargarUbicaciones()
    intervalRef.current = setInterval(cargarUbicaciones, 15000)
    return () => clearInterval(intervalRef.current)
  }, [cargarUbicaciones])

  const actualizarVehiculos = (lista) => {
    const L = window.L
    if (!L || !mapInstance.current) return

    vehiculoMarkers.current.forEach(m => m.remove())
    vehiculoMarkers.current = []

    lista.forEach(v => {
      if (!v.ultima_ubicacion) return
      const { latitud, longitud, velocidad_kmh, timestamp } = v.ultima_ubicacion
      const enLinea = v.estado_dispositivo === 'en_linea' || v.estado_dispositivo === 'reciente'
      const color = enLinea ? '#22c55e' : '#94a3b8'

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);font-size:18px;">🚌</div>`,
        iconSize: [38, 38], iconAnchor: [19, 19]
      })

      const fecha = new Date(timestamp).toLocaleString('es-CO')
      const m = L.marker([latitud, longitud], { icon })
        .addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:DM Sans,sans-serif;min-width:180px;padding:4px">
          <div style="font-size:15px;font-weight:700;margin-bottom:6px">🚌 ${v.placa}</div>
          <div style="color:#555;margin-bottom:8px">${v.modelo}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span>Velocidad</span><strong>${velocidad_kmh} km/h</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span>Estado</span><strong style="color:${color}">${enLinea ? '● En línea' : '○ Desconectado'}</strong>
          </div>
          <div style="font-size:11px;color:#888">${fecha}</div>
        </div>`)

      vehiculoMarkers.current.push(m)
    })
  }

  const seleccionarRuta = async (ruta) => {
    if (rutaActiva?.id === ruta.id) {
      limpiarRuta(); return
    }
    setRutaActiva(ruta)
    setLoadingRuta(true)
    try {
      const { data } = await getRutaDetalle(ruta.id)
      setRutaDetalle(data)
      dibujarRuta(data)
    } finally {
      setLoadingRuta(false)
    }
  }

  const dibujarRuta = (detalle) => {
    const L = window.L
    if (!L || !mapInstance.current) return
    limpiarCapasRuta()

    const paradas = (detalle.paradas ?? [])
      .filter(p => p.parada_latitud && p.parada_longitud)
      .sort((a, b) => a.orden - b.orden)

    if (paradas.length === 0) return

    const coords = paradas.map(p => [p.parada_latitud, p.parada_longitud])

    const poly = L.polyline(coords, { color: '#3b82f6', weight: 5, opacity: 0.85 })
      .addTo(mapInstance.current)
    rutaLayers.current.push(poly)

    paradas.forEach((p, i) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#1e2535;color:#60a5fa;border:2px solid #3b82f6;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${i + 1}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      })
      const m = L.marker([p.parada_latitud, p.parada_longitud], { icon })
        .addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:4px">
          <strong>Parada #${i + 1}</strong><br/>${p.parada_nombre}
          <br/><small style="color:#888">${p.parada_latitud?.toFixed(5)}, ${p.parada_longitud?.toFixed(5)}</small>
        </div>`)
      rutaLayers.current.push(m)
    })

    mapInstance.current.fitBounds(poly.getBounds(), { padding: [40, 40] })
  }

  const limpiarCapasRuta = () => {
    rutaLayers.current.forEach(l => l.remove())
    rutaLayers.current = []
  }

  const limpiarRuta = () => {
    limpiarCapasRuta()
    setRutaActiva(null)
    setRutaDetalle(null)
  }

  const enLinea = vehiculos.filter(v => v.estado_dispositivo === 'en_linea' || v.estado_dispositivo === 'reciente').length

  return (
    <div className="mapa-layout">
      {/* SIDEBAR */}
      <div className="mapa-sidebar">
        <div className="mapa-sidebar-header">
          <h2>🛰 Mapa en Vivo</h2>
          <p>Actualiza cada 15 segundos</p>
        </div>

        <div className="mapa-stats">
          <div className="mapa-stat"><strong>{vehiculos.length}</strong><span>Vehículos</span></div>
          <div className="mapa-stat"><strong style={{ color: 'var(--success)' }}>{enLinea}</strong><span>En línea</span></div>
          <div className="mapa-stat"><strong>{rutas.length}</strong><span>Rutas</span></div>
        </div>

        {/* RUTAS */}
        <div className="mapa-section">Rutas</div>
        {rutas.map(r => (
          <div key={r.id} className={`ruta-item${rutaActiva?.id === r.id ? ' activa' : ''}`}
            onClick={() => seleccionarRuta(r)}>
            <span style={{ fontSize: 20 }}>🗺</span>
            <div className="ruta-item-info" style={{ flex: 1 }}>
              <strong>{r.nombre}</strong>
              <span>{r.total_paradas ?? 0} paradas</span>
            </div>
            <Badge tipo={r.activa ? 'success' : 'danger'}>{r.activa ? 'Activa' : 'Inactiva'}</Badge>
          </div>
        ))}
        {rutas.length === 0 && <p style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>Sin rutas.</p>}

        {/* PARADAS DE LA RUTA SELECCIONADA */}
        {rutaDetalle && (
          <>
            <div className="mapa-section">Paradas — {rutaDetalle.nombre}</div>
            {loadingRuta
              ? <div className="loading-state"><div className="spinner"></div></div>
              : (rutaDetalle.paradas ?? []).map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', color: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: 13 }}>{p.parada_nombre}</span>
                </div>
              ))
            }
          </>
        )}

        {/* VEHÍCULOS */}
        <div className="mapa-section">Vehículos</div>
        {vehiculos.map(v => (
          <div key={v.id} className="vehiculo-item">
            <div className={`vehiculo-dot${v.estado_dispositivo === 'en_linea' ? ' online' : ''}`}></div>
            <div className="vehiculo-info">
              <strong>{v.placa}</strong>
              <span>{v.ultima_ubicacion ? `${v.ultima_ubicacion.velocidad_kmh} km/h` : 'Sin señal'}</span>
            </div>
            <Badge tipo={v.estado_dispositivo === 'en_linea' ? 'success' : v.estado_dispositivo === 'reciente' ? 'warning' : 'gray'} >
              {v.estado_dispositivo === 'en_linea' ? 'Live' : v.estado_dispositivo === 'reciente' ? '~' : 'Off'}
            </Badge>
          </div>
        ))}
        {vehiculos.length === 0 && <p style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>Sin vehículos activos.</p>}
      </div>

      {/* MAPA */}
      <div className="mapa-main">
        <div id="map" ref={mapRef}></div>
        {rutaActiva && (
          <div className="limpiar-ruta">
            <button className="btn btn-secondary btn-sm" onClick={limpiarRuta}>✕ Limpiar ruta</button>
          </div>
        )}
      </div>
    </div>
  )
}
