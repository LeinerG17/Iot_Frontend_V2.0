import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { getAlertas } from '../../services/api'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

export default function AlertasPage() {
  const { data, loading, recargar } = useApi(getAlertas)
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroResuelto, setFiltroResuelto] = useState('')

  const filtradas = data.filter(a => {
    if (filtroNivel && a.nivel !== filtroNivel) return false
    if (filtroResuelto === 'si' && !a.resuelta) return false
    if (filtroResuelto === 'no' && a.resuelta) return false
    return true
  })

  const nivelTipo = n => n === 'critico' ? 'danger' : n === 'advertencia' ? 'warning' : 'info'

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Alertas del Sistema</h2>
          <p>Desconexiones, velocidad excesiva y eventos críticos</p>
        </div>
        <button className="btn btn-secondary" onClick={recargar}>↻ Actualizar</button>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'var(--font-main)', fontSize: 13 }}>
          <option value="">Todos los niveles</option>
          <option value="info">Informativo</option>
          <option value="advertencia">Advertencia</option>
          <option value="critico">Crítico</option>
        </select>
        <select value={filtroResuelto} onChange={e => setFiltroResuelto(e.target.value)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontFamily: 'var(--font-main)', fontSize: 13 }}>
          <option value="">Todas</option>
          <option value="no">Sin resolver</option>
          <option value="si">Resueltas</option>
        </select>

        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
          <Badge tipo="danger">{data.filter(a => a.nivel === 'critico' && !a.resuelta).length} críticas</Badge>
          <Badge tipo="warning">{data.filter(a => a.nivel === 'advertencia' && !a.resuelta).length} advertencias</Badge>
          <Badge tipo="gray">{data.filter(a => a.resuelta).length} resueltas</Badge>
        </div>
      </div>

      <div className="card">
        <Table loading={loading} cols={['Nivel', 'Tipo', 'Mensaje', 'Dispositivo', 'Vehículo', 'Estado', 'Fecha']}
          data={filtradas} emptyMsg="Sin alertas registradas."
          renderRow={a => (
            <tr key={a.id}>
              <td><Badge tipo={nivelTipo(a.nivel)}>{a.nivel}</Badge></td>
              <td><span style={{ fontSize: 12, fontWeight: 600 }}>{a.tipo}</span></td>
              <td style={{ maxWidth: 280 }}><span style={{ fontSize: 13 }}>{a.mensaje}</span></td>
              <td className="text-muted">{a.dispositivo || '—'}</td>
              <td className="text-muted">{a.vehiculo || '—'}</td>
              <td><Badge tipo={a.resuelta ? 'success' : 'danger'}>{a.resuelta ? 'Resuelta' : 'Pendiente'}</Badge></td>
              <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(a.creado_en).toLocaleString('es-CO')}</td>
            </tr>
          )} />
      </div>
    </div>
  )
}
