import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getVehiculos, crearVehiculo, actualizarVehiculo, eliminarVehiculo } from '../../services/api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

const vacio = { placa: '', modelo: '', capacidad: '', activo: true }

export default function VehiculosPage() {
  const { data, loading, recargar } = useApi(getVehiculos)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(vacio)

  const filtrados = data.filter(v => v.placa?.toLowerCase().includes(busqueda.toLowerCase()) || v.modelo?.toLowerCase().includes(busqueda.toLowerCase()))

  const abrirNuevo = () => { setForm(vacio); setEdit(null); setModal(true) }
  const abrirEditar = v => { setForm({ placa: v.placa, modelo: v.modelo, capacidad: v.capacidad, activo: v.activo }); setEdit(v); setModal(true) }

  const guardar = async () => {
    if (edit) await actualizarVehiculo(edit.id, form)
    else await crearVehiculo(form)
    setModal(false); recargar()
  }

  const borrar = async id => {
    if (!confirm('¿Eliminar este vehículo?')) return
    await eliminarVehiculo(id); recargar()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><h2>Vehículos</h2><p>Gestión de la flota vehicular</p></div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo Vehículo</button>
      </div>
      <div className="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Buscar por placa o modelo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <div className="card">
        <Table loading={loading} cols={['Placa', 'Modelo', 'Capacidad', 'Estado', 'Acciones']}
          data={filtrados} emptyMsg="Sin vehículos."
          renderRow={v => (
            <tr key={v.id}>
              <td><strong className="td-mono">{v.placa}</strong></td>
              <td>{v.modelo}</td>
              <td>{v.capacidad} pasajeros</td>
              <td><Badge tipo={v.activo ? 'success' : 'danger'}>{v.activo ? 'Activo' : 'Inactivo'}</Badge></td>
              <td><div className="gap-2">
                <button className="btn-icon" onClick={() => abrirEditar(v)}>✏️</button>
                <button className="btn-icon danger" onClick={() => borrar(v.id)}>🗑</button>
              </div></td>
            </tr>
          )} />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
        <div className="form-grid">
          <div className="form-group"><label>Placa *</label><input value={form.placa} onChange={e => setForm(p => ({ ...p, placa: e.target.value }))} placeholder="ABC123" /></div>
          <div className="form-group"><label>Modelo *</label><input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} placeholder="Buseta Chevrolet" /></div>
          <div className="form-group"><label>Capacidad *</label><input type="number" value={form.capacidad} onChange={e => setForm(p => ({ ...p, capacidad: e.target.value }))} placeholder="40" /></div>
          <div className="form-group"><label className="form-check" style={{ marginTop: 24 }}><input type="checkbox" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} /> Activo</label></div>
        </div>
      </Modal>
    </div>
  )
}
