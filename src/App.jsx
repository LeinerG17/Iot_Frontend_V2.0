import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth }              from './context/AuthContext'
import { StudentAuthProvider, useStudentAuth } from './context/StudentAuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/layout/Sidebar'

import LoginPage        from './pages/login/LoginPage'
import DashboardPage    from './pages/dashboard/DashboardPage'
import MapaPage         from './pages/mapa/MapaPage'
import RutasPage        from './pages/rutas/RutasPage'
import VehiculosPage    from './pages/vehiculos/VehiculosPage'
import ConductoresPage  from './pages/conductores/ConductoresPage'
import AsignacionesPage from './pages/asignaciones/AsignacionesPage'
import HistorialPage    from './pages/historial/HistorialPage'
import DispositivosPage from './pages/dispositivos/DispositivosPage'
import AlertasPage      from './pages/alertas/AlertasPage'
import StudentLoginPage  from './pages/estudiante/StudentLoginPage'
import StudentPortalPage from './pages/estudiante/StudentPortalPage'

function Loading() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', gap:12, color:'var(--text3)' }}>
      <div className="spinner" /> Cargando...
    </div>
  )
}

function PrivateRoute({ children }) {
  const { usuario, loading } = useAuth()
  if (loading) return <Loading />
  return usuario ? children : <Navigate to="/login" replace />
}

function StudentPrivateRoute({ children }) {
  const { estudiante, loading } = useStudentAuth()
  if (loading) return <Loading />
  return estudiante ? children : <Navigate to="/estudiante/login" replace />
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Admin */}
      <Route path="/dashboard"    element={<PrivateRoute><AppLayout><DashboardPage /></AppLayout></PrivateRoute>} />
      <Route path="/mapa"         element={<PrivateRoute><MapaPage /></PrivateRoute>} />
      <Route path="/rutas"        element={<PrivateRoute><AppLayout><RutasPage /></AppLayout></PrivateRoute>} />
      <Route path="/vehiculos"    element={<PrivateRoute><AppLayout><VehiculosPage /></AppLayout></PrivateRoute>} />
      <Route path="/conductores"  element={<PrivateRoute><AppLayout><ConductoresPage /></AppLayout></PrivateRoute>} />
      <Route path="/asignaciones" element={<PrivateRoute><AppLayout><AsignacionesPage /></AppLayout></PrivateRoute>} />
      <Route path="/historial"    element={<PrivateRoute><AppLayout><HistorialPage /></AppLayout></PrivateRoute>} />
      <Route path="/dispositivos" element={<PrivateRoute><AppLayout><DispositivosPage /></AppLayout></PrivateRoute>} />
      <Route path="/alertas"      element={<PrivateRoute><AppLayout><AlertasPage /></AppLayout></PrivateRoute>} />

      {/* Estudiante */}
      <Route path="/estudiante/login" element={<StudentLoginPage />} />
      <Route path="/estudiante"       element={<StudentPrivateRoute><StudentPortalPage /></StudentPrivateRoute>} />
      <Route path="/estudiante/*"     element={<Navigate to="/estudiante" replace />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StudentAuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ThemeProvider>
      </StudentAuthProvider>
    </AuthProvider>
  )
}
