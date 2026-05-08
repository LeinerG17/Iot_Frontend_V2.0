import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getAsignaciones, crearAsignacion, actualizarAsignacion, eliminarAsignacion, getConductores, getVehiculos, getRutas } from '../../services/api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

const hoy = new Date().toISOString().split('T')[0]
const vacio = { conductor: '', vehiculo: '', ruta: '', fecha_inicio: hoy, fecha_fin: '', activa: true }

export default function AsignacionesPage() {
  const { data, loading, recargar } = useApi(getAsignaciones)
  const { data: conductores } = useApi(getConductores)
  const { data: vehiculos } = useApi(getVehiculos)
  const { data: rutas } = useApi(getRutas)
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(vacio)

  const abrirNuevo = () => { setForm(vacio); setEdit(null); setModal(true) }
  const abrirEditar = a => { setForm({ conductor: a.conductor, vehiculo: a.vehiculo, ruta: a.ruta, fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin ?? '', activa: a.activa }); setEdit(a); setModal(true) }
  const guardar = async () => { if (edit) await actualizarAsignacion(edit.id, form); else await crearAsignacion(form); setModal(false); recargar() }
  const borrar = async id => { if (!confirm('¿Eliminar?')) return; await eliminarAsignacion(id); recargar() }
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const fCheck = k => e => setForm(p => ({ ...p, [k]: e.target.checked }))

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><h2>Asignaciones</h2><p>Conductor + Vehículo + Ruta</p></div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nueva Asignación</button>
      </div>
      <div className="card">
        <Table loading={loading} cols={['Conductor', 'Vehículo', 'Ruta', 'Inicio', 'Fin', 'Estado', 'Acciones']}
          data={data} emptyMsg="Sin asignaciones."
          renderRow={a => (
            <tr key={a.id}>
              <td>{a.conductor_nombre || a.conductor}</td>
              <td><span className="td-mono">{a.vehiculo_placa || a.vehiculo}</span></td>
              <td>{a.ruta_nombre || a.ruta}</td>
              <td>{a.fecha_inicio}</td>
              <td>{a.fecha_fin || '—'}</td>
              <td><Badge tipo={a.activa ? 'success' : 'gray'}>{a.activa ? 'Activa' : 'Inactiva'}</Badge></td>
              <td><div className="gap-2">
                <button className="btn-icon" onClick={() => abrirEditar(a)}>✏️</button>
                <button className="btn-icon danger" onClick={() => borrar(a.id)}>🗑</button>
              </div></td>
            </tr>
          )} />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Editar Asignación' : 'Nueva Asignación'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
        <div className="form-grid">
          <div className="form-group full"><label>Conductor *</label>
            <select value={form.conductor} onChange={f('conductor')}>
              <option value="">Seleccionar...</option>
              {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.cedula}</option>)}
            </select>
          </div>
          <div className="form-group full"><label>Vehículo *</label>
            <select value={form.vehiculo} onChange={f('vehiculo')}>
              <option value="">Seleccionar...</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>)}
            </select>
          </div>
          <div className="form-group full"><label>Ruta *</label>
            <select value={form.ruta} onChange={f('ruta')}>
              <option value="">Seleccionar...</option>
              {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Fecha Inicio *</label><input type="date" value={form.fecha_inicio} onChange={f('fecha_inicio')} /></div>
          <div className="form-group"><label>Fecha Fin</label><input type="date" value={form.fecha_fin} onChange={f('fecha_fin')} /></div>
          <div className="form-group full"><label className="form-check"><input type="checkbox" checked={form.activa} onChange={fCheck('activa')} /> Asignación activa</label></div>
        </div>
      </Modal>
    </div>
  )
}
