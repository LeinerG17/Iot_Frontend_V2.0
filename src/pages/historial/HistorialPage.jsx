import { useApi } from '../../hooks/useApi'
import { getHistorial } from '../../services/api'
import Badge from '../../components/ui/Badge'
import Table from '../../components/ui/Table'

const fmt = fecha => new Date(fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })

export default function HistorialPage() {
  const { data, loading, recargar } = useApi(getHistorial)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title"><h2>Historial de Recorridos</h2><p>Registro de todos los recorridos realizados</p></div>
        <button className="btn btn-secondary" onClick={recargar}>↻ Actualizar</button>
      </div>
      <div className="card">
        <Table loading={loading} cols={['#', 'Asignación', 'Inicio', 'Fin', 'Duración', 'Estado', 'Observaciones']}
          data={data} emptyMsg="Sin recorridos registrados."
          renderRow={h => (
            <tr key={h.id}>
              <td className="td-mono">{h.id}</td>
              <td>{h.asignacion}</td>
              <td>{fmt(h.inicio)}</td>
              <td>{h.fin ? fmt(h.fin) : '—'}</td>
              <td>{h.duracion_minutos ? `${h.duracion_minutos} min` : <Badge tipo="warning">En curso</Badge>}</td>
              <td><Badge tipo={h.activo ? 'warning' : 'gray'}>{h.activo ? 'En curso' : 'Finalizado'}</Badge></td>
              <td className="text-muted">{h.observaciones || '—'}</td>
            </tr>
          )} />
      </div>
    </div>
  )
}
