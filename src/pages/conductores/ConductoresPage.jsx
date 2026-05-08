import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getConductores, crearConductor, actualizarConductor, eliminarConductor } from '../../services/api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

const vacio = { nombre: '', cedula: '', telefono: '', licencia: '', activo: true }

export default function ConductoresPage() {
  const { data, loading, recargar } = useApi(getConductores)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(vacio)

  const filtrados = data.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || c.cedula?.includes(busqueda))
  const abrirNuevo = () => { setForm(vacio); setEdit(null); setModal(true) }
  const abrirEditar = c => { setForm({ nombre: c.nombre, cedula: c.cedula, telefono: c.telefono ?? '', licencia: c.licencia ?? '', activo: c.activo }); setEdit(c); setModal(true) }
  const guardar = async () => { if (edit) await actualizarConductor(edit.id, form); else await crearConductor(form); setModal(false); recargar() }
  const borrar = async id => { if (!confirm('¿Eliminar?')) return; await eliminarConductor(id); recargar() }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><h2>Conductores</h2><p>Personal de conducción</p></div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo Conductor</button>
      </div>
      <div className="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Buscar por nombre o cédula..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <div className="card">
        <Table loading={loading} cols={['Nombre', 'Cédula', 'Teléfono', 'Licencia', 'Estado', 'Acciones']}
          data={filtrados} emptyMsg="Sin conductores."
          renderRow={c => (
            <tr key={c.id}>
              <td><strong>{c.nombre}</strong></td>
              <td className="td-mono">{c.cedula}</td>
              <td>{c.telefono || '—'}</td>
              <td>{c.licencia || '—'}</td>
              <td><Badge tipo={c.activo ? 'success' : 'danger'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge></td>
              <td><div className="gap-2">
                <button className="btn-icon" onClick={() => abrirEditar(c)}>✏️</button>
                <button className="btn-icon danger" onClick={() => borrar(c.id)}>🗑</button>
              </div></td>
            </tr>
          )} />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? 'Editar Conductor' : 'Nuevo Conductor'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={guardar}>Guardar</button></>}>
        <div className="form-grid">
          <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
          <div className="form-group"><label>Cédula *</label><input value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} /></div>
          <div className="form-group"><label>Teléfono</label><input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
          <div className="form-group"><label>Licencia</label><input value={form.licencia} onChange={e => setForm(p => ({ ...p, licencia: e.target.value }))} /></div>
          <div className="form-group full"><label className="form-check"><input type="checkbox" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} /> Activo</label></div>
        </div>
      </Modal>
    </div>
  )
}
