/**
 * RutasPage — Gestión de Rutas y Paradas
 * ✅ Relación M2M (paradas compartidas entre rutas)
 * ✅ Mapa en vivo al crear/editar paradas y al asignar paradas a ruta
 * ✅ Asignar paradas existentes a una ruta con orden drag/reorder
 * ✅ Clic en el mapa para capturar coordenadas al crear parada
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import {
  getRutas, crearRuta, actualizarRuta, eliminarRuta,
  getParadas, crearParada, actualizarParada, eliminarParada,
  getRutaParadas, agregarParadaRuta, eliminarParadaRuta, actualizarOrdenRP,
} from '../../services/api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

const emptyRuta   = { nombre:'', descripcion:'', activa:true }
const emptyParada = { nombre:'', latitud:'', longitud:'', descripcion:'' }

// ── Mini-mapa reutilizable ────────────────────────────────────────────────────
function MiniMapa({ paradas = [], onClick, height = 320, selected = null }) {
  const ref  = useRef(null)
  const inst = useRef(null)
  const layers = useRef([])

  const esperarL = (cb, n=0) => { if(window.L){cb();return} if(n>30)return; setTimeout(()=>esperarL(cb,n+1),150) }

  useEffect(() => {
    esperarL(() => {
      if (inst.current || !ref.current) return
      const L = window.L
      inst.current = L.map(ref.current, { center:[11.5444,-72.9072], zoom:13 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'© OpenStreetMap', maxZoom:19,
      }).addTo(inst.current)
      if (onClick) {
        inst.current.on('click', e => onClick(e.latlng.lat, e.latlng.lng))
      }
      setTimeout(() => inst.current?.invalidateSize(), 150)
    })
    return () => { if(inst.current){ inst.current.remove(); inst.current=null } }
  }, [])

  useEffect(() => {
    esperarL(() => {
      if (!inst.current || !window.L) return
      const L = window.L
      layers.current.forEach(l => l.remove()); layers.current = []

      const validas = paradas.filter(p => p.latitud && p.longitud)
      if (!validas.length) return

      const coords = validas.map(p => [p.latitud, p.longitud])
      if (coords.length > 1) {
        const poly = L.polyline(coords, { color:'#3b82f6', weight:4, opacity:.85 }).addTo(inst.current)
        layers.current.push(poly)
      }

      validas.forEach((p, i) => {
        const isSelected = selected && (p.id === selected || p.nombre === selected)
        const ini = i===0, fin = i===validas.length-1
        const color = isSelected ? '#f59e0b' : ini ? '#22c55e' : fin ? '#ef4444' : '#3b82f6'
        const label = ini ? '▶' : fin ? '■' : String(i+1)
        const icon = L.divIcon({
          className:'',
          html:`<div style="background:${ini||fin||isSelected?color:'#1e2535'};color:${ini||fin||isSelected?'#fff':'#60a5fa'};border:2px solid ${color};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.4)">${label}</div>`,
          iconSize:[28,28], iconAnchor:[14,14],
        })
        const m = L.marker([p.latitud, p.longitud], { icon })
          .addTo(inst.current)
          .bindPopup(`<b>${p.nombre}</b><br><small>${p.latitud?.toFixed(5)}, ${p.longitud?.toFixed(5)}</small>`)
        layers.current.push(m)
      })

      if (coords.length > 0) {
        if (coords.length === 1) inst.current.setView(coords[0], 15)
        else inst.current.fitBounds(coords, { padding:[30,30] })
      }
    })
  }, [paradas, selected])

  return <div ref={ref} style={{ width:'100%', height, borderRadius:10, overflow:'hidden', border:'1px solid #2a3348' }} />
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RutasPage() {
  const { data: rutas,   loading, recargar }         = useApi(getRutas)
  const { data: paradas, recargar: recargarParadas } = useApi(getParadas)

  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab]           = useState('rutas')

  // ── Modales ruta ──────────────────────────────────────────────────────────
  const [modalRuta, setModalRuta]   = useState(false)
  const [editRuta, setEditRuta]     = useState(null)
  const [formRuta, setFormRuta]     = useState(emptyRuta)
  const [savingRuta, setSavingRuta] = useState(false)
  const [errRuta, setErrRuta]       = useState('')

  // ── Modales parada ────────────────────────────────────────────────────────
  const [modalParada, setModalParada]   = useState(false)
  const [editParada, setEditParada]     = useState(null)
  const [formParada, setFormParada]     = useState(emptyParada)
  const [savingParada, setSavingParada] = useState(false)
  const [errParada, setErrParada]       = useState('')

  // ── Modal asignar paradas a ruta (M2M) ────────────────────────────────────
  const [modalAsignar, setModalAsignar]   = useState(false)
  const [rutaAsignar, setRutaAsignar]     = useState(null)
  const [rutaParadas, setRutaParadas]     = useState([])   // RutaParada actuales
  const [loadingRP, setLoadingRP]         = useState(false)
  const [paradaSelec, setParadaSelec]     = useState('')   // id a agregar
  const [ordenSel, setOrdenSel]           = useState(1)

  // ─── CRUD rutas ──────────────────────────────────────────────────────────
  const abrirNuevaRuta   = () => { setFormRuta(emptyRuta); setEditRuta(null); setErrRuta(''); setModalRuta(true) }
  const abrirEditarRuta  = r  => { setFormRuta({ nombre:r.nombre, descripcion:r.descripcion??'', activa:r.activa }); setEditRuta(r); setErrRuta(''); setModalRuta(true) }

  const guardarRuta = async () => {
    if (!formRuta.nombre.trim()) { setErrRuta('El nombre es requerido.'); return }
    setSavingRuta(true); setErrRuta('')
    try {
      if (editRuta) await actualizarRuta(editRuta.id, formRuta)
      else await crearRuta(formRuta)
      setModalRuta(false); recargar()
    } catch { setErrRuta('Error al guardar la ruta.') }
    finally { setSavingRuta(false) }
  }

  const borrarRuta = async id => {
    if (!confirm('¿Eliminar esta ruta? Las paradas NO se borran (son compartidas).')) return
    await eliminarRuta(id); recargar()
  }

  // ─── CRUD paradas ────────────────────────────────────────────────────────
  const abrirNuevaParada  = () => { setFormParada(emptyParada); setEditParada(null); setErrParada(''); setModalParada(true) }
  const abrirEditarParada = p  => { setFormParada({ nombre:p.nombre, latitud:p.latitud, longitud:p.longitud, descripcion:p.descripcion??'' }); setEditParada(p); setErrParada(''); setModalParada(true) }

  const guardarParada = async () => {
    if (!formParada.nombre.trim() || !formParada.latitud || !formParada.longitud) {
      setErrParada('Nombre, latitud y longitud son requeridos.'); return
    }
    setSavingParada(true); setErrParada('')
    try {
      if (editParada) await actualizarParada(editParada.id, formParada)
      else await crearParada(formParada)
      setModalParada(false); recargarParadas()
    } catch { setErrParada('Error al guardar la parada.') }
    finally { setSavingParada(false) }
  }

  const borrarParada = async id => {
    if (!confirm('¿Eliminar esta parada? Se quitará de todas las rutas que la usen.')) return
    await eliminarParada(id); recargarParadas()
  }

  // ─── Modal asignar paradas a ruta ────────────────────────────────────────
  const abrirAsignar = async ruta => {
    setRutaAsignar(ruta); setLoadingRP(true); setModalAsignar(true)
    try {
      const { data } = await getRutaParadas(ruta.id)
      const lista = data?.resultados ?? data?.results ?? (Array.isArray(data) ? data : [])
      setRutaParadas(lista.sort((a,b) => a.orden - b.orden))
      setOrdenSel(lista.length + 1)
    } finally { setLoadingRP(false) }
  }

  const agregarParada = async () => {
    if (!paradaSelec) return
    try {
      await agregarParadaRuta({ ruta: rutaAsignar.id, parada: Number(paradaSelec), orden: ordenSel })
      const { data } = await getRutaParadas(rutaAsignar.id)
      const lista = data?.resultados ?? data?.results ?? (Array.isArray(data) ? data : [])
      setRutaParadas(lista.sort((a,b) => a.orden - b.orden))
      setOrdenSel(lista.length + 1)
      setParadaSelec('')
      recargar()
    } catch (e) {
      alert(e.response?.data?.non_field_errors?.[0] ?? 'Error al agregar parada.')
    }
  }

  const quitarParada = async rpId => {
    await eliminarParadaRuta(rpId)
    setRutaParadas(prev => {
      const next = prev.filter(rp => rp.id !== rpId)
      return next.map((rp, i) => ({ ...rp, orden: i+1 }))
    })
    recargar()
  }

  const moverParada = async (rpId, dir) => {
    const idx = rutaParadas.findIndex(rp => rp.id === rpId)
    if (idx < 0) return
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= rutaParadas.length) return
    const next = [...rutaParadas]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    const reordenadas = next.map((rp, i) => ({ ...rp, orden: i+1 }))
    setRutaParadas(reordenadas)
    // Actualizar en backend
    await Promise.all([
      actualizarOrdenRP(reordenadas[idx].id,  { orden: reordenadas[idx].orden }),
      actualizarOrdenRP(reordenadas[swap].id, { orden: reordenadas[swap].orden }),
    ])
  }

  // Paradas que aún no están en esta ruta
  const paradasDisponibles = paradas.filter(p => !rutaParadas.some(rp => rp.parada === p.id))

  // Paradas de la ruta activa para el mapa del modal
  const paradasRutaMapa = rutaParadas.map(rp => {
    const p = paradas.find(x => x.id === rp.parada)
    return p ? { ...p, orden: rp.orden } : null
  }).filter(Boolean).sort((a,b) => a.orden - b.orden)

  // Para el mapa del modal de parada nueva
  const paradaPreview = formParada.latitud && formParada.longitud
    ? [{ nombre: formParada.nombre || 'Nueva parada', latitud: Number(formParada.latitud), longitud: Number(formParada.longitud) }]
    : []

  const filtradas        = rutas.filter(r => r.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
  const paradasFiltradas = paradas.filter(p => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Rutas y Paradas</h2>
          <p>Gestión de rutas universitarias — las paradas son compartidas entre rutas (M2M)</p>
        </div>
        <div className="header-actions">
          {tab === 'rutas'
            ? <button className="btn btn-primary" onClick={abrirNuevaRuta}>+ Nueva Ruta</button>
            : <button className="btn btn-primary" onClick={abrirNuevaParada}>+ Nueva Parada</button>}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
        {[['rutas', `Rutas (${rutas.length})`], ['paradas', `Paradas (${paradas.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background:'none', border:'none', padding:'10px 20px', cursor:'pointer', color:tab===k?'var(--accent2)':'var(--text3)', fontWeight:tab===k?700:400, borderBottom:tab===k?'2px solid var(--accent)':'2px solid transparent', fontFamily:'var(--font-main)', fontSize:14 }}>{l}</button>
        ))}
      </div>

      <div className="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder={tab==='rutas'?'Buscar ruta...':'Buscar parada...'} value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
      </div>

      {/* ── TABLA RUTAS ──────────────────────────────────────────────────── */}
      {tab === 'rutas' && (
        <div className="card">
          <Table loading={loading} cols={['#','Nombre','Descripción','Paradas','Estado','Acciones']}
            data={filtradas} emptyMsg="Sin rutas registradas."
            renderRow={r => (
              <tr key={r.id}>
                <td className="td-mono">{r.id}</td>
                <td><strong>{r.nombre}</strong></td>
                <td className="text-muted">{r.descripcion||'—'}</td>
                <td><Badge tipo="info">{r.total_paradas??0} paradas</Badge></td>
                <td><Badge tipo={r.activa?'success':'danger'}>{r.activa?'Activa':'Inactiva'}</Badge></td>
                <td>
                  <div className="gap-2">
                    <button className="btn-icon" title="Asignar paradas" onClick={() => abrirAsignar(r)}>📍</button>
                    <button className="btn-icon" title="Editar" onClick={() => abrirEditarRuta(r)}>✏️</button>
                    <button className="btn-icon danger" title="Eliminar" onClick={() => borrarRuta(r.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            )} />
        </div>
      )}

      {/* ── TABLA PARADAS ────────────────────────────────────────────────── */}
      {tab === 'paradas' && (
        <div className="card">
          <Table loading={false} cols={['#','Nombre','Latitud','Longitud','Descripción','Acciones']}
            data={paradasFiltradas} emptyMsg="Sin paradas registradas."
            renderRow={p => (
              <tr key={p.id}>
                <td className="td-mono">{p.id}</td>
                <td><strong>{p.nombre}</strong></td>
                <td className="td-mono">{p.latitud}</td>
                <td className="td-mono">{p.longitud}</td>
                <td className="text-muted">{p.descripcion||'—'}</td>
                <td>
                  <div className="gap-2">
                    <button className="btn-icon" onClick={() => abrirEditarParada(p)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => borrarParada(p.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            )} />
        </div>
      )}

      {/* ══ MODAL RUTA ══════════════════════════════════════════════════════ */}
      <Modal open={modalRuta} onClose={() => setModalRuta(false)}
        title={editRuta ? 'Editar Ruta' : 'Nueva Ruta'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalRuta(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarRuta} disabled={savingRuta}>{savingRuta?'Guardando...':'Guardar'}</button>
        </>}>
        {errRuta && <div className="alert alert-error">{errRuta}</div>}
        <div className="form-grid">
          <div className="form-group full">
            <label>Nombre *</label>
            <input value={formRuta.nombre} onChange={e=>setFormRuta(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Ruta Norte" />
          </div>
          <div className="form-group full">
            <label>Descripción</label>
            <textarea rows={3} value={formRuta.descripcion} onChange={e=>setFormRuta(p=>({...p,descripcion:e.target.value}))} />
          </div>
          <div className="form-group full">
            <label className="form-check">
              <input type="checkbox" checked={formRuta.activa} onChange={e=>setFormRuta(p=>({...p,activa:e.target.checked}))} />
              Ruta activa
            </label>
          </div>
        </div>
      </Modal>

      {/* ══ MODAL PARADA con mapa ════════════════════════════════════════════ */}
      <Modal open={modalParada} onClose={() => setModalParada(false)}
        title={editParada ? 'Editar Parada' : 'Nueva Parada'}
        size="modal-lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalParada(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarParada} disabled={savingParada}>{savingParada?'Guardando...':'Guardar'}</button>
        </>}>
        {errParada && <div className="alert alert-error">{errParada}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Formulario */}
          <div>
            <div className="form-grid" style={{ gridTemplateColumns:'1fr' }}>
              <div className="form-group">
                <label>Nombre *</label>
                <input value={formParada.nombre} onChange={e=>setFormParada(p=>({...p,nombre:e.target.value}))} placeholder="Ej: Entrada principal" />
              </div>
              <div className="form-group">
                <label>Latitud *</label>
                <input type="number" step="0.000001" value={formParada.latitud} onChange={e=>setFormParada(p=>({...p,latitud:e.target.value}))} placeholder="11.5444" />
              </div>
              <div className="form-group">
                <label>Longitud *</label>
                <input type="number" step="0.000001" value={formParada.longitud} onChange={e=>setFormParada(p=>({...p,longitud:e.target.value}))} placeholder="-72.9072" />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea rows={3} value={formParada.descripcion} onChange={e=>setFormParada(p=>({...p,descripcion:e.target.value}))} />
              </div>
            </div>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:8 }}>
              💡 Haz clic en el mapa para capturar coordenadas automáticamente.
            </p>
          </div>

          {/* Mapa para seleccionar ubicación */}
          <div>
            <p style={{ fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Ubicación en mapa</p>
            <MiniMapa
              paradas={paradaPreview}
              height={280}
              onClick={(lat, lng) => setFormParada(p => ({ ...p, latitud: lat.toFixed(6), longitud: lng.toFixed(6) }))}
            />
          </div>
        </div>
      </Modal>

      {/* ══ MODAL ASIGNAR PARADAS A RUTA (M2M) ══════════════════════════════ */}
      <Modal open={modalAsignar} onClose={() => setModalAsignar(false)}
        title={`Paradas de: ${rutaAsignar?.nombre}`}
        size="modal-xl"
        footer={<button className="btn btn-secondary" onClick={() => setModalAsignar(false)}>Cerrar</button>}>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* Columna izquierda: gestión */}
          <div>
            {/* Agregar parada existente */}
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>Agregar parada a esta ruta</p>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              <select value={paradaSelec} onChange={e=>setParadaSelec(e.target.value)}
                style={{ flex:2, padding:'8px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13 }}>
                <option value="">— Seleccionar parada —</option>
                {paradasDisponibles.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <input type="number" min="1" value={ordenSel} onChange={e=>setOrdenSel(Number(e.target.value))}
                style={{ width:70, padding:'8px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13 }}
                placeholder="Orden" />
              <button className="btn btn-primary btn-sm" onClick={agregarParada} disabled={!paradaSelec}>+ Agregar</button>
            </div>

            <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase', marginBottom:8 }}>
              Paradas asignadas ({rutaParadas.length})
            </p>

            {loadingRP && <div className="loading-state"><div className="spinner" /></div>}

            {!loadingRP && rutaParadas.length === 0 && (
              <p style={{ color:'var(--text3)', fontSize:13, padding:'12px 0' }}>Sin paradas asignadas todavía.</p>
            )}

            {!loadingRP && rutaParadas.map((rp, i) => {
              const p = paradas.find(x => x.id === rp.parada)
              return (
                <div key={rp.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:8, marginBottom:6, border:'1px solid var(--border)' }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(59,130,246,.15)', color:'var(--accent2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{rp.orden}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p?.nombre ?? `Parada #${rp.parada}`}</div>
                    {p && <div style={{ fontSize:11, color:'var(--text3)' }}>{p.latitud?.toFixed(4)}, {p.longitud?.toFixed(4)}</div>}
                  </div>
                  <div style={{ display:'flex', gap:2 }}>
                    <button className="btn-icon" title="Subir" onClick={() => moverParada(rp.id,'up')} disabled={i===0} style={{ fontSize:12 }}>▲</button>
                    <button className="btn-icon" title="Bajar" onClick={() => moverParada(rp.id,'dn')} disabled={i===rutaParadas.length-1} style={{ fontSize:12 }}>▼</button>
                    <button className="btn-icon danger" title="Quitar de esta ruta" onClick={() => quitarParada(rp.id)}>✕</button>
                  </div>
                </div>
              )
            })}

            <p style={{ fontSize:11, color:'var(--text3)', marginTop:12 }}>
              💡 Quitar una parada de esta ruta NO la elimina — sigue disponible para otras rutas.
            </p>
          </div>

          {/* Columna derecha: mapa */}
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', letterSpacing:1, textTransform:'uppercase', marginBottom:8 }}>Recorrido en mapa</p>
            <MiniMapa paradas={paradasRutaMapa} height={420} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
