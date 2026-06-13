import { useEffect, useRef, useState, useCallback } from 'react'
import { getUbicacionTiempoReal, getRutas, getRutaCoordenadas, getParadaCercana, getDispositivosActivos } from '../../services/api'
import Badge from '../../components/ui/Badge'

const BUS_SVG = (color) => `<svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="10" rx="1.5"/><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="6" y="10" width="3" height="3" rx="0.5" fill="#fff" opacity="0.9"/><rect x="10.5" y="10" width="3" height="3" rx="0.5" fill="#fff" opacity="0.9"/><rect x="15" y="10" width="3" height="3" rx="0.5" fill="#fff" opacity="0.9"/><circle cx="7" cy="18.5" r="2" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="17" cy="18.5" r="2" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`

const HIGHLIGHT_SVG = `<svg viewBox="0 0 24 24" fill="#2563eb" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="10" rx="1.5"/><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="6" y="10" width="3" height="3" rx="0.5" fill="#fff" opacity="0.9"/><rect x="10.5" y="10" width="3" height="3" rx="0.5" fill="#fff" opacity="0.9"/><rect x="15" y="10" width="3" height="3" rx="0.5" fill="#fff" opacity="0.9"/><circle cx="7" cy="18.5" r="2" fill="#2563eb" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="18.5" r="2" fill="#2563eb" stroke="#fff" stroke-width="2.5"/></svg>`

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(m) {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m/1000).toFixed(1)} km`
}

export default function MapaPage() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const vehiculoMarkers = useRef([])
  const vehiculoPosiciones = useRef({})
  const rutaLayers = useRef([])
  const intervalRef = useRef(null)
  const geoMarkerRef = useRef(null)
  const geoCircleRef = useRef(null)
  const nearbyLayerRef = useRef(null)
  const busRouteLayers = useRef([])
  const busStopMarkers = useRef([])
  const highlightCircleRef = useRef(null)
  const followRef = useRef(false)
  const posUsuario = useRef(null)

  const [rutas, setRutas] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [rutaActiva, setRutaActiva] = useState(null)
  const [rutaDetalle, setRutaDetalle] = useState(null)
  const [enLinea, setEnLinea] = useState(0)
  const [geoActivo, setGeoActivo] = useState(false)
  const [paradaCercana, setParadaCercana] = useState(null)
  const [dispositivos, setDispositivos] = useState([])

  const [busSeleccionado, setBusSeleccionado] = useState(null)
  const [busRouteStops, setBusRouteStops] = useState([])
  const [siguienteParada, setSiguienteParada] = useState(null)
  const [distBusUsuario, setDistBusUsuario] = useState(null)

  const INIT_COORDS = [11.5444, -72.9072]

  useEffect(() => {
    if (mapInstance.current) return
    const L = window.L
    if (!L) return
    mapInstance.current = L.map(mapRef.current).setView(INIT_COORDS, 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(mapInstance.current)
  }, [])

  useEffect(() => {
    getRutas().then(r => {
      const d = r.data
      setRutas(d?.resultados ?? d?.results ?? (Array.isArray(d) ? d : []))
    })
    cargarDispositivos()
  }, [])

  const cargarDispositivos = async () => {
    try {
      const { data } = await getDispositivosActivos()
      setDispositivos(data.dispositivos ?? [])
    } catch {}
  }

  const crearIconoBus = (L, color, angulo = 0, highlight = false) => L.divIcon({
    className: '',
    html: `<div class="bus-marker" style="transform:rotate(${angulo}deg)">${highlight ? HIGHLIGHT_SVG : BUS_SVG(color)}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })

  const animarMovimiento = (marker, desde, hasta, duracionMs = 500) => {
    const pasos = 30
    const deltaLat = (hasta[0] - desde[0]) / pasos
    const deltaLng = (hasta[1] - desde[1]) / pasos
    let paso = 0
    const prevInterval = marker._animInterval
    if (prevInterval) clearInterval(prevInterval)
    const timer = setInterval(() => {
      if (paso >= pasos) { clearInterval(timer); return }
      marker.setLatLng([desde[0] + deltaLat * paso, desde[1] + deltaLng * paso])
      paso++
    }, duracionMs / pasos)
    marker._animInterval = timer
  }

  const calcularAngulo = (desde, hasta) => {
    const dLat = hasta[0] - desde[0]
    const dLng = hasta[1] - desde[1]
    return Math.atan2(dLng, dLat) * (180 / Math.PI)
  }

  const limpiarBusRoute = () => {
    busRouteLayers.current.forEach(l => l.remove())
    busRouteLayers.current = []
    busStopMarkers.current.forEach(m => m.remove())
    busStopMarkers.current = []
    if (highlightCircleRef.current) {
      mapInstance.current?.removeLayer(highlightCircleRef.current)
      highlightCircleRef.current = null
    }
  }

  const dibujarRutaBus = async (stops) => {
    const L = window.L
    if (!L || !mapInstance.current) return
    limpiarBusRoute()

    const coords = stops.map(p => [p.lat, p.lng])
    if (coords.length < 2) return

    const osrmCoords = stops.map(p => `${p.lng},${p.lat}`).join(';')
    try {
      const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`)
      const osrmData = await resp.json()
      if (osrmData.code === 'Ok' && osrmData.routes?.length) {
        const routeCoords = osrmData.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
        const poly = L.polyline(routeCoords, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(mapInstance.current)
        busRouteLayers.current.push(poly)
      } else {
        throw new Error()
      }
    } catch {
      const poly = L.polyline(coords, { color: '#2563eb', weight: 5, opacity: 0.6, dashArray: '8,8' }).addTo(mapInstance.current)
      busRouteLayers.current.push(poly)
    }

    stops.forEach((p, i) => {
      const ini = i === 0, fin = i === stops.length - 1
      const bg = ini ? '#16a34a' : fin ? '#dc2626' : '#2563eb'
      const label = ini ? '▶' : fin ? '■' : String(i + 1)
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#fff;color:${bg};border:2px solid ${bg};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${label}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14]
      })
      const m = L.marker([p.lat, p.lng], { icon }).addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:4px"><strong>Parada #${i + 1}</strong><br/>${p.nombre}</div>`)
      busStopMarkers.current.push(m)
    })
  }

  const calcularSiguienteParada = (busPos, stops) => {
    if (!stops?.length) return null
    let minDist = Infinity
    let next = null
    let idx = -1
    stops.forEach((s, i) => {
      const d = haversineKm(busPos[0], busPos[1], s.lat, s.lng) * 1000
      if (d < minDist) {
        minDist = d
        next = { ...s, distancia_m: d, indice: i }
        idx = i
      }
    })
    return next
  }

  const seleccionarBus = async (vehiculo) => {
    limpiarBusRoute()
    limpiarCapasRuta()
    setRutaActiva(null)
    setRutaDetalle(null)

    if (busSeleccionado?.id === vehiculo.id) {
      setBusSeleccionado(null)
      setBusRouteStops([])
      setSiguienteParada(null)
      setDistBusUsuario(null)
      followRef.current = false
      return
    }

    setBusSeleccionado(vehiculo)
    followRef.current = true

    if (vehiculo.ruta_actual) {
      try {
        const { data } = await getRutaCoordenadas(vehiculo.ruta_actual.id)
        const stops = (data.paradas ?? []).filter(p => p.lat && p.lng)
        setBusRouteStops(stops)
        dibujarRutaBus(stops)

        const busPos = vehiculo.ultima_ubicacion
          ? [vehiculo.ultima_ubicacion.latitud, vehiculo.ultima_ubicacion.longitud]
          : null
        if (busPos) {
          const next = calcularSiguienteParada(busPos, stops)
          setSiguienteParada(next)
        }
      } catch {}
    }

    const L = window.L
    if (L && mapInstance.current) {
      const pos = vehiculo.ultima_ubicacion
      if (pos) {
        mapInstance.current.setView([pos.latitud, pos.longitud], 16)
        if (highlightCircleRef.current) mapInstance.current.removeLayer(highlightCircleRef.current)
        highlightCircleRef.current = L.circle([pos.latitud, pos.longitud], {
          radius: 80, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 2
        }).addTo(mapInstance.current)
      }
    }
  }

  const cargarUbicaciones = useCallback(() => {
    getUbicacionTiempoReal().then(r => {
      const lista = r.data?.vehiculos ?? []
      setVehiculos(lista)
      const online = lista.filter(v => v.estado_dispositivo === 'en_linea' || v.estado_dispositivo === 'reciente')
      setEnLinea(online.length)

      const updatedMarkers = actualizarVehiculos(lista)

      if (busSeleccionado) {
        const updated = lista.find(v => v.id === busSeleccionado.id)
        if (updated && updated.ultima_ubicacion) {
          setBusSeleccionado(prev => ({ ...prev, ...updated }))
          const busPos = [updated.ultima_ubicacion.latitud, updated.ultima_ubicacion.longitud]
          if (busRouteStops.length > 0) {
            const next = calcularSiguienteParada(busPos, busRouteStops)
            setSiguienteParada(next)
          }
          if (posUsuario.current) {
            const d = haversineKm(busPos[0], busPos[1], posUsuario.current[0], posUsuario.current[1]) * 1000
            setDistBusUsuario(d)
          }
          if (followRef.current) {
            mapInstance.current?.setView(busPos, mapInstance.current.getZoom(), { animate: true })
            if (highlightCircleRef.current) {
              highlightCircleRef.current.setLatLng(busPos)
            }
          }
        } else if (!updated || !updated.ultima_ubicacion) {
          setBusSeleccionado(null)
          setSiguienteParada(null)
          limpiarBusRoute()
        }
      }
    }).catch(() => {})
  }, [busSeleccionado, busRouteStops])

  useEffect(() => {
    cargarUbicaciones()
    intervalRef.current = setInterval(cargarUbicaciones, 5000)
    return () => clearInterval(intervalRef.current)
  }, [cargarUbicaciones])

  const actualizarVehiculos = (lista) => {
    const L = window.L
    if (!L || !mapInstance.current) return

    lista.forEach(v => {
      if (!v.ultima_ubicacion) return
      const { latitud, longitud, velocidad_kmh, timestamp } = v.ultima_ubicacion
      const enLinea = v.estado_dispositivo === 'en_linea'
      const reciente = v.estado_dispositivo === 'reciente'
      const color = enLinea ? '#16a34a' : reciente ? '#d97706' : '#94a3b8'
      const isSelected = busSeleccionado?.id === v.id
      const nuevaPos = [latitud, longitud]
      const fecha = new Date(timestamp).toLocaleString('es-CO')

      const dispInfo = dispositivos.find(d => d.vehiculo_placa === v.placa)
      const dispEstado = dispInfo?.estado_conexion || v.estado_dispositivo
      const iconLive = dispEstado === 'en_linea' ? '🟢' : dispEstado === 'reciente' ? '🟡' : '🔴'

      const popupHtml = `
        <div style="font-family:DM Sans,sans-serif;min-width:200px;padding:4px">
          <div style="font-size:15px;font-weight:700;margin-bottom:4px">${iconLive} ${v.placa}</div>
          <div style="color:var(--text3);margin-bottom:6px">${v.modelo}</div>
          ${v.ruta_actual ? `<div style="margin-bottom:4px">🗺 ${v.ruta_actual.nombre}${v.ruta_actual.conductor ? ` · ${v.ruta_actual.conductor}` : ''}</div>` : ''}
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span>Velocidad</span><strong>${velocidad_kmh} km/h</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span>Estado</span>
            <strong style="color:${color}">${enLinea ? '● En línea' : reciente ? '◐ Reciente' : '○ Offline'}</strong>
          </div>
          <div style="font-size:11px;color:var(--text3)">${fecha}</div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-size:12px">
            ${isSelected ? '✅ Haciendo seguimiento' : '👆 Click para seguir esta buseta'}
          </div>
        </div>`

      const marcadorExistente = vehiculoMarkers.current.find(m => m._vehiculoId === v.id)

      if (marcadorExistente) {
        const posAnterior = vehiculoPosiciones.current[v.id]
        if (posAnterior) {
          const distancia = Math.abs(nuevaPos[0] - posAnterior[0]) + Math.abs(nuevaPos[1] - posAnterior[1])
          if (distancia > 0.000005) {
            const angulo = calcularAngulo(posAnterior, nuevaPos)
            marcadorExistente.setIcon(crearIconoBus(L, color, angulo, isSelected))
            animarMovimiento(marcadorExistente, posAnterior, nuevaPos, 800)
          }
        }
        marcadorExistente.setPopupContent(popupHtml)
        if (isSelected) marcadorExistente.setZIndexOffset(10000)
        else marcadorExistente.setZIndexOffset(0)
        vehiculoPosiciones.current[v.id] = nuevaPos
      } else {
        const icon = crearIconoBus(L, color, 0, isSelected)
        const m = L.marker(nuevaPos, { icon }).addTo(mapInstance.current).bindPopup(popupHtml)
        m._vehiculoId = v.id

        m.on('click', () => {
          const vData = lista.find(x => x.id === m._vehiculoId)
          if (vData) seleccionarBus(vData)
        })

        vehiculoMarkers.current.push(m)
        vehiculoPosiciones.current[v.id] = nuevaPos
      }
    })

    vehiculoMarkers.current = vehiculoMarkers.current.filter(m => {
      const existe = lista.some(v => v.id === m._vehiculoId && v.ultima_ubicacion)
      if (!existe) { m.remove(); return false }
      if (!m._listenersAttached) {
        m._listenersAttached = true
        m.on('click', () => {
          const vData = lista.find(x => x.id === m._vehiculoId)
          if (vData) seleccionarBus(vData)
        })
      }
      return true
    })
  }

  const seleccionarRuta = async (ruta) => {
    if (rutaActiva?.id === ruta.id) { limpiarRuta(); return }
    setBusSeleccionado(null)
    setSiguienteParada(null)
    limpiarBusRoute()
    followRef.current = false
    setRutaActiva(ruta)
    setRutaDetalle(null)
    setLoadingRuta(true)
    try {
      const { data } = await getRutaCoordenadas(ruta.id)
      setRutaDetalle(data)
      dibujarRuta(data)
    } finally {
      setLoadingRuta(false)
    }
  }

  const [loadingRuta, setLoadingRuta] = useState(false)

  const dibujarRuta = async (detalle) => {
    const L = window.L
    if (!L || !mapInstance.current) return
    limpiarCapasRuta()

    const paradas = (detalle.paradas ?? []).filter(p => p.lat && p.lng)
    if (paradas.length < 2) return

    const coords = paradas.map(p => [p.lat, p.lng])
    const osrmCoords = paradas.map(p => `${p.lng},${p.lat}`).join(';')

    try {
      const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`)
      const osrmData = await resp.json()
      if (osrmData.code === 'Ok' && osrmData.routes?.length) {
        const routeCoords = osrmData.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
        const poly = L.polyline(routeCoords, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(mapInstance.current)
        rutaLayers.current.push(poly)
        mapInstance.current.fitBounds(poly.getBounds(), { padding: [40, 40] })
      } else {
        throw new Error('OSRM no disponible')
      }
    } catch {
      const poly = L.polyline(coords, { color: '#2563eb', weight: 5, opacity: 0.6, dashArray: '8,8' }).addTo(mapInstance.current)
      rutaLayers.current.push(poly)
      mapInstance.current.fitBounds(poly.getBounds(), { padding: [40, 40] })
    }

    paradas.forEach((p, i) => {
      const ini = i === 0, fin = i === paradas.length - 1
      const bg = ini ? '#16a34a' : fin ? '#dc2626' : '#2563eb'
      const label = ini ? '▶' : fin ? '■' : String(i + 1)
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#fff;color:${bg};border:2px solid ${bg};border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${label}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      })
      const m = L.marker([p.lat, p.lng], { icon }).addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:4px"><strong>Parada #${i + 1}</strong><br/>${p.nombre}</div>`)
      rutaLayers.current.push(m)
    })
  }

  const limpiarCapasRuta = () => {
    rutaLayers.current.forEach(l => l.remove())
    rutaLayers.current = []
  }
  const limpiarRuta = () => { limpiarCapasRuta(); setRutaActiva(null); setRutaDetalle(null) }

  const activarGeolocalizacion = () => {
    const L = window.L
    if (!L || !mapInstance.current) return
    if (!navigator.geolocation) return
    setGeoActivo(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        posUsuario.current = [latitude, longitude]
        if (geoMarkerRef.current) mapInstance.current.removeLayer(geoMarkerRef.current)
        if (geoCircleRef.current) mapInstance.current.removeLayer(geoCircleRef.current)
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:16px;height:16px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
          iconSize: [16, 16], iconAnchor: [8, 8]
        })
        geoMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(mapInstance.current)
          .bindPopup('<div style="font-family:DM Sans,sans-serif;padding:4px"><strong>📍 Tu ubicación</strong></div>')
        geoCircleRef.current = L.circle([latitude, longitude], {
          radius: 50, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 2
        }).addTo(mapInstance.current)
        mapInstance.current.setView([latitude, longitude], 15)
        try {
          const { data } = await getParadaCercana(latitude, longitude)
          if (data.parada) {
            setParadaCercana(data)
            if (nearbyLayerRef.current) mapInstance.current.removeLayer(nearbyLayerRef.current)
            const nearIcon = L.divIcon({
              className: '',
              html: '<div style="width:28px;height:28px;background:#f59e0b;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
              iconSize: [28, 28], iconAnchor: [14, 14]
            })
            nearbyLayerRef.current = L.marker([data.parada.latitud, data.parada.longitud], { icon: nearIcon })
              .addTo(mapInstance.current)
              .bindPopup(`<div style="font-family:DM Sans,sans-serif;padding:6px"><strong>📍 ${data.parada.nombre}</strong><br/><span style="color:var(--text3)">A ${data.distancia_m} m</span></div>`)
          }
        } catch {}
        if (busSeleccionado?.ultima_ubicacion) {
          const d = haversineKm(latitude, longitude, busSeleccionado.ultima_ubicacion.latitud, busSeleccionado.ultima_ubicacion.longitud) * 1000
          setDistBusUsuario(d)
        }
      },
      () => { setGeoActivo(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const totalVehiculos = vehiculos.length
  const approaching = siguienteParada?.distancia_m < 100

  return (
    <div className="mapa-layout">
      <div className="mapa-sidebar">
        <div className="mapa-sidebar-header">
          <h2>🛰 Mapa en Vivo</h2>
          <p>Actualiza cada 5 segundos</p>
        </div>

        <div className="mapa-stats">
          <div className="mapa-stat"><strong>{totalVehiculos}</strong><span>Vehículos</span></div>
          <div className="mapa-stat"><strong style={{ color: 'var(--success)' }}>{enLinea}</strong><span>En línea</span></div>
          <div className="mapa-stat"><strong>{rutas.length}</strong><span>Rutas</span></div>
        </div>

        {/* ─── BUSETA SELECCIONADA ─── */}
        {busSeleccionado && (
          <>
            <div className="mapa-section" style={{ color: 'var(--accent2)' }}>🚌 SEGUIMIENTO</div>
            <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>🚌</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{busSeleccionado.placa}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{busSeleccionado.modelo}</div>
                </div>
                <Badge tipo={busSeleccionado.estado_dispositivo === 'en_linea' ? 'success' : 'warning'}>
                  {busSeleccionado.estado_dispositivo === 'en_linea' ? 'Live' : '~'}
                </Badge>
              </div>

              {busSeleccionado.ruta_actual && (
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                  🗺 Ruta: <strong>{busSeleccionado.ruta_actual.nombre}</strong>
                  {busSeleccionado.ruta_actual.conductor && (
                    <span> · Conductor: {busSeleccionado.ruta_actual.conductor}</span>
                  )}
                </div>
              )}

              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Velocidad</span>
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {busSeleccionado.ultima_ubicacion?.velocidad_kmh ?? 0} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>km/h</span>
                  </span>
                </div>

                {siguienteParada && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {approaching ? '🟢 Llegando a' : '⏩ Siguiente'}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: approaching ? 'var(--success)' : 'var(--text)' }}>
                        {siguienteParada.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: approaching ? 'var(--success)' : 'var(--text3)' }}>
                        a {formatDist(siguienteParada.distancia_m)}
                      </div>
                    </div>
                  </div>
                )}

                {distBusUsuario !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>📍 De ti</span>
                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: distBusUsuario < 200 ? 'var(--success)' : 'var(--text)' }}>
                      {formatDist(distBusUsuario)}
                    </span>
                  </div>
                )}

                {busSeleccionado.ultima_ubicacion?.timestamp && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                    {new Date(busSeleccionado.ultima_ubicacion.timestamp).toLocaleTimeString('es-CO')}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}
                  onClick={() => {
                    followRef.current = !followRef.current
                  }}>
                  {followRef.current ? '🔴 Seguir' : '⚪ Seguir'}
                </button>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { seleccionarBus(busSeleccionado) }}>
                  ✕ Salir
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── DISPOSITIVOS ─── */}
        <div className="mapa-section">Dispositivos</div>
        {dispositivos.length === 0 && <p style={{ padding: '4px 16px', color: 'var(--text3)', fontSize: 12 }}>Sin dispositivos registrados.</p>}
        {dispositivos.slice(0, 6).map(d => (
          <div key={d.id} className="vehiculo-item" style={{ padding: '5px 16px' }}>
            <div className={`vehiculo-dot${d.estado_conexion === 'en_linea' ? ' online' : ''}`}></div>
            <div className="vehiculo-info">
              <strong>{d.nombre}</strong>
              <span>{d.vehiculo_placa || 'Sin vehículo'} · {d.identificador}</span>
            </div>
            <Badge tipo={d.estado_conexion === 'en_linea' ? 'success' : d.estado_conexion === 'reciente' ? 'warning' : 'gray'}>
              {d.estado_conexion === 'en_linea' ? 'Live' : d.estado_conexion === 'reciente' ? '~5m' : 'Off'}
            </Badge>
          </div>
        ))}

        {/* ─── RUTAS ─── */}
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
        {rutas.length === 0 && (
          <p style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>Sin rutas.</p>
        )}

        {rutaDetalle && (
          <>
            <div className="mapa-section">Paradas — {rutaDetalle.nombre}</div>
            {loadingRuta
              ? <div className="loading-state"><div className="spinner"></div></div>
              : (rutaDetalle.paradas ?? []).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(37,99,235,0.12)', color: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: 13 }}>{p.nombre}</span>
                </div>
              ))
            }
          </>
        )}

        {/* ─── VEHÍCULOS ─── */}
        <div className="mapa-section">
          Vehículos
          {busSeleccionado && (
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent2)' }}>
              · seleccionado: {busSeleccionado.placa}
            </span>
          )}
        </div>
        {vehiculos.map(v => {
          const live = v.estado_dispositivo === 'en_linea'
          const recent = v.estado_dispositivo === 'reciente'
          const selected = busSeleccionado?.id === v.id
          return (
            <div key={v.id}
              className={`vehiculo-item${selected ? ' ruta-item activa' : ''}`}
              style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: 0, margin: 0 }}
              onClick={() => seleccionarBus(v)}>
              <div className={`vehiculo-dot${live ? ' online' : ''}`}
                style={recent && !live ? { background: 'var(--warning)', boxShadow: '0 0 6px var(--warning)' } : {}}></div>
              <div className="vehiculo-info" style={{ flex: 1 }}>
                <strong>{v.placa} {selected && '👈'}</strong>
                <span>
                  {v.ultima_ubicacion ? `${v.ultima_ubicacion.velocidad_kmh} km/h` : 'Sin señal'}
                  {v.ruta_actual ? ` · ${v.ruta_actual.nombre}` : ''}
                </span>
              </div>
              <Badge tipo={live ? 'success' : recent ? 'warning' : 'gray'}>
                {live ? 'Live' : recent ? '~' : 'Off'}
              </Badge>
            </div>
          )
        })}
        {vehiculos.length === 0 && (
          <p style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>Sin vehículos activos.</p>
        )}
      </div>

      <div className="mapa-main">
        <div id="map" ref={mapRef}></div>

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

        {/* ─── BADGE SEGUIMIENTO ─── */}
        {busSeleccionado && siguienteParada && (
          <div className="nearby-stop-badge" style={{ top: 16, transform: 'translateX(-50%)', background: approaching ? 'rgba(22,163,74,0.12)' : undefined, borderColor: approaching ? 'var(--success)' : undefined }}>
            {approaching ? '🟢' : '🚌'}
            <div>
              <span className="stop-name">
                {approaching ? '¡Llegando!' : 'Siguiente'}
              </span>
              <span className="stop-dist">
                {' '}— {siguienteParada.nombre} · a {formatDist(siguienteParada.distancia_m)}
                {distBusUsuario !== null && ` · A ${formatDist(distBusUsuario)} de ti`}
              </span>
            </div>
          </div>
        )}

        <button className={`geo-btn${geoActivo ? ' active' : ''}`} onClick={activarGeolocalizacion} title="Mostrar mi ubicación">
          🎯
        </button>

        {rutaActiva && (
          <div className="limpiar-ruta">
            <button className="btn btn-secondary btn-sm" onClick={limpiarRuta}>✕ Limpiar ruta</button>
          </div>
        )}
      </div>
    </div>
  )
}
