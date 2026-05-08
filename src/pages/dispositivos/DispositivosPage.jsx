import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getDevices, crearDevice, actualizarDevice, eliminarDevice, getVehiculos, enviarComando, getComandos } from '../../services/api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

const vacio = { nombre: '', tipo: 'ESP32', identificador: '', vehiculo: '', activo: true }

export default function DispositivosPage() {
  const { data, loading, recargar } = useApi(getDevices)
  const { data: vehiculos } = useApi(getVehiculos)
  const { data: comandos, recargar: recargarComandos } = useApi(getComandos)
  const [modal, setModal] = useState(false)
  const [modalCmd, setModalCmd] = useState(false)
  const [tab, setTab] = useState('dispositivos')
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(vacio)
  const [formCmd, setFormCmd] = useState({ dispositivo: '', tipo: 'activar' })
  const [busqueda, setBusqueda] = useState('')

  const filtrados = data.filter(d =>
    d.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.identificador?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevo = () => { setForm(vacio); setEdit(null); setModal(true) }
  const abrirEditar = d => {
    setForm({ nombre: d.nombre, tipo: d.tipo, identificador: d.identificador, vehiculo: d.vehiculo ?? '', activo: d.activo })
    setEdit(d); setModal(true)
  }
  const guardar = async () => {
    if (edit) await actualizarDevice(edit.id, form)
    else await crearDevice(form)
    setModal(false); recargar()
  }
  const borrar = async id => {
    if (!confirm('¿Eliminar este dispositivo?')) return
    await eliminarDevice(id); recargar()
  }
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const fCheck = k => e => setForm(p => ({ ...p, [k]: e.target.checked }))

  const enviarCmd = async () => {
    await enviarComando(formCmd)
    setModalCmd(false); recargarComandos()
  }

  const estadoConexion = d => {
    if (!d.ultima_conexion) return { label: 'Nunca', tipo: 'gray' }
    const diff = (Date.now() - new Date(d.ultima_conexion)) / 1000
    if (diff < 60) return { label: 'En línea', tipo: 'success' }
    if (diff < 300) return { label: 'Reciente', tipo: 'warning' }
    return { label: 'Desconectado', tipo: 'danger' }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Dispositivos IoT</h2>
          <p>ESP32 y módulos GPS NEO-6M</p>
        </div>
        <div className="header-actions">
          {tab === 'dispositivos'
            ? <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo Dispositivo</button>
            : <button className="btn btn-primary" onClick={() => setModalCmd(true)}>+ Enviar Comando</button>
          }
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['dispositivos', `Dispositivos (${data.length})`], ['comandos', `Comandos (${comandos.length})`]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer',
            color: tab === t ? 'var(--accent2)' : 'var(--text3)',
            fontWeight: tab === t ? 700 : 400,
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            fontFamily: 'var(--font-main)', fontSize: 14
          }}>{label}</button>
        ))}
      </div>

      {tab === 'dispositivos' && <>
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Buscar por nombre o MAC..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="card">
          <Table loading={loading} cols={['Nombre', 'Tipo', 'Identificador', 'Vehículo', 'Conexión', 'Estado', 'Acciones']}
            data={filtrados} emptyMsg="Sin dispositivos registrados."
            renderRow={d => {
              const conn = estadoConexion(d)
              return (
                <tr key={d.id}>
                  <td><strong>{d.nombre}</strong></td>
                  <td><Badge tipo="info">{d.tipo}</Badge></td>
                  <td className="td-mono" style={{ fontSize: 12 }}>{d.identificador}</td>
                  <td>{d.vehiculo_placa || '—'}</td>
                  <td><Badge tipo={conn.tipo}>{conn.label}</Badge></td>
                  <td><Badge tipo={d.activo ? 'success' : 'danger'}>{d.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td><div className="gap-2">
                    <button className="btn-icon" onClick={() => abrirEditar(d)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => borrar(d.id)}>🗑</button>
                  </div></td>
                </tr>
              )
            }} />
        </div>
      </>}

      {tab === 'comandos' && (
        <div className="card">
          <Table loading={false} cols={['#', 'Dispositivo', 'Tipo', 'Estado', 'Creado', 'Ejecutado']}
            data={comandos} emptyMsg="Sin comandos enviados."
            renderRow={c => (
              <tr key={c.id}>
                <td className="td-mono">{c.id}</td>
                <td>{c.dispositivo_nombre || c.dispositivo}</td>
                <td><Badge tipo={c.tipo === 'activar' ? 'success' : 'danger'}>{c.tipo}</Badge></td>
                <td><Badge tipo={
                  c.estado === 'ejecutado' ? 'success' :
                  c.estado === 'fallido' ? 'danger' :
                  c.estado === 'enviado' ? 'warning' : 'gray'
                }>{c.estado}</Badge></td>
                <td style={{ fontSize: 12 }}>{new Date(c.creado_en).toLocaleString('es-CO')}</td>
                <td style={{ fontSize: 12 }}>{c.ejecutado_en ? new Date(c.ejecutado_en).toLocaleString('es-CO') : '—'}</td>
              </tr>
            )} />
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Editar Dispositivo' : 'Nuevo Dispositivo'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
        <div className="form-grid">
          <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={f('nombre')} placeholder="ESP32-Ruta1" /></div>
          <div className="form-group"><label>Tipo *</label>
            <select value={form.tipo} onChange={f('tipo')}>
              <option value="ESP32">ESP32</option>
              <option value="GPS_NEO6M">GPS NEO-6M</option>
            </select>
          </div>
          <div className="form-group full"><label>Identificador (MAC) *</label><input value={form.identificador} onChange={f('identificador')} placeholder="AA:BB:CC:DD:EE:FF" /></div>
          <div className="form-group full"><label>Vehículo</label>
            <select value={form.vehiculo} onChange={f('vehiculo')}>
              <option value="">Sin asignar</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
            </select>
          </div>
          <div className="form-group full">
            <label className="form-check"><input type="checkbox" checked={form.activo} onChange={fCheck('activo')} /> Activo</label>
          </div>
        </div>
      </Modal>

      <Modal open={modalCmd} onClose={() => setModalCmd(false)} title="Enviar Comando Remoto"
        footer={<><button className="btn btn-secondary" onClick={() => setModalCmd(false)}>Cancelar</button><button className="btn btn-primary" onClick={enviarCmd}>Enviar</button></>}>
        <div className="form-grid">
          <div className="form-group full"><label>Dispositivo *</label>
            <select value={formCmd.dispositivo} onChange={e => setFormCmd(p => ({ ...p, dispositivo: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {data.map(d => <option key={d.id} value={d.id}>{d.nombre} [{d.tipo}]</option>)}
            </select>
          </div>
          <div className="form-group full"><label>Comando *</label>
            <select value={formCmd.tipo} onChange={e => setFormCmd(p => ({ ...p, tipo: e.target.value }))}>
              <option value="activar">✅ Activar dispositivo</option>
              <option value="desactivar">🔴 Desactivar dispositivo</option>
            </select>
          </div>
        </div>
        <div className="alert alert-success" style={{ marginTop: 16 }}>
          El ESP32 recibirá el comando en su próxima consulta a <code>/api/commands/latest/</code>
        </div>
      </Modal>
    </div>
  )
}
