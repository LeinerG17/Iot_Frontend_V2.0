import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getDashboardStats } from '../../services/api'
import Badge from '../../components/ui/Badge'

export default function DashboardPage() {
  const { usuario } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats().then(s => { setStats(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const vehiculosEnLinea = stats?.ubicacion?.vehiculos?.filter(
    v => v.estado_dispositivo === 'en_linea' || v.estado_dispositivo === 'reciente'
  ).length ?? 0

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Dashboard</h2>
          <p>Bienvenido, {usuario?.username} — {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner"></div><span>Cargando estadísticas...</span></div>
      ) : (
        <>
          {/* STATS */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 6v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
              <div className="stat-value">{stats?.vehiculos?.length ?? 0}</div>
              <div className="stat-label">Vehículos</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="stat-value">{vehiculosEnLinea}</div>
              <div className="stat-label">En línea ahora</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
              </div>
              <div className="stat-value">{stats?.rutas?.filter(r => r.activa)?.length ?? 0}</div>
              <div className="stat-label">Rutas activas</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="stat-value">{stats?.conductores?.filter(c => c.activo)?.length ?? 0}</div>
              <div className="stat-label">Conductores activos</div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="stat-value">{stats?.alertas?.filter(a => !a.resuelta)?.length ?? 0}</div>
              <div className="stat-label">Alertas sin resolver</div>
            </div>
          </div>

          {/* VEHÍCULOS EN TIEMPO REAL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text2)' }}>
                  🚌 Estado de Vehículos
                </h3>
                {stats?.ubicacion?.vehiculos?.length === 0
                  ? <p className="text-muted" style={{ fontSize: 13 }}>Sin vehículos registrados.</p>
                  : stats?.ubicacion?.vehiculos?.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={v.estado_dispositivo === 'en_linea' ? 'online-pulse' : ''} style={{ width: 8, height: 8, borderRadius: '50%', background: v.estado_dispositivo === 'en_linea' ? 'var(--success)' : 'var(--text3)', display: 'inline-block' }}></span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{v.placa}</span>
                        <span className="text-muted" style={{ fontSize: 12 }}>{v.modelo}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {v.ultima_ubicacion && <span className="text-muted" style={{ fontSize: 12 }}>{v.ultima_ubicacion.velocidad_kmh} km/h</span>}
                        <Badge tipo={v.estado_dispositivo === 'en_linea' ? 'success' : v.estado_dispositivo === 'reciente' ? 'warning' : 'gray'}>
                          {v.estado_dispositivo === 'en_linea' ? 'En línea' : v.estado_dispositivo === 'reciente' ? 'Reciente' : 'Desconectado'}
                        </Badge>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text2)' }}>
                  🚨 Alertas Recientes
                </h3>
                {stats?.alertas?.length === 0
                  ? <p className="text-muted" style={{ fontSize: 13 }}>Sin alertas.</p>
                  : stats?.alertas?.slice(0, 6).map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.tipo}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{a.mensaje?.slice(0, 50)}...</div>
                      </div>
                      <Badge tipo={a.nivel === 'critico' ? 'danger' : a.nivel === 'advertencia' ? 'warning' : 'info'}>
                        {a.nivel}
                      </Badge>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
