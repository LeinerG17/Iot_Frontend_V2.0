import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'

export default function StudentLoginPage() {
  const { login, registro } = useStudentAuth()
  const navigate = useNavigate()
  const [modo, setModo]     = useState('login')
  const [cargando, setCargando] = useState(false)
  const [error, setError]   = useState('')
  const [exito, setExito]   = useState('')
  const [form, setForm]     = useState({ username:'', password:'', email:'', nombre:'', apellido:'' })

  const onChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleLogin = async e => {
    e.preventDefault(); setError(''); setCargando(true)
    try {
      await login(form.username, form.password)
      navigate('/estudiante')
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Credenciales inválidas.')
    } finally { setCargando(false) }
  }

  const handleRegistro = async e => {
    e.preventDefault(); setError(''); setExito(''); setCargando(true)
    try {
      await registro({ username:form.username, password:form.password, email:form.email, nombre:form.nombre, apellido:form.apellido })
      setExito('¡Cuenta creada! Ahora puedes iniciar sesión.')
      setModo('login')
      setForm(p => ({ ...p, password:'' }))
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al registrarse.')
    } finally { setCargando(false) }
  }

  return (
    <div style={s.page}>
      <div style={s.blob1} /><div style={s.blob2} />
      <div style={s.card}>
        <div style={s.logo}>
          <span style={{ fontSize:38 }}>🚌</span>
          <div>
            <div style={s.logoTitle}>Portal Estudiante</div>
            <div style={s.logoSub}>Sistema de Rutas — Uniguajira</div>
          </div>
        </div>

        <div style={s.tabs}>
          {[['login','Iniciar sesión'],['registro','Registrarse']].map(([k,l]) => (
            <button key={k} style={s.tab(modo===k)} onClick={() => { setModo(k); setError(''); setExito('') }}>{l}</button>
          ))}
        </div>

        {error && <div style={s.alert('danger')}>{error}</div>}
        {exito && <div style={s.alert('success')}>{exito}</div>}

        {modo === 'login' && (
          <form onSubmit={handleLogin} style={s.form}>
            <label style={s.label}>Usuario</label>
            <input name="username" value={form.username} onChange={onChange} placeholder="tu_usuario" style={s.input} required />
            <label style={s.label}>Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={onChange} placeholder="••••••••" style={s.input} required />
            <button type="submit" style={s.btnPrimary} disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Ingresar →'}
            </button>
          </form>
        )}

        {modo === 'registro' && (
          <form onSubmit={handleRegistro} style={s.form}>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1 }}>
                <label style={s.label}>Nombre</label>
                <input name="nombre" value={form.nombre} onChange={onChange} placeholder="María" style={s.input} />
              </div>
              <div style={{ flex:1 }}>
                <label style={s.label}>Apellido</label>
                <input name="apellido" value={form.apellido} onChange={onChange} placeholder="García" style={s.input} />
              </div>
            </div>
            <label style={s.label}>Correo</label>
            <input name="email" type="email" value={form.email} onChange={onChange} placeholder="correo@uniguajira.edu.co" style={s.input} />
            <label style={s.label}>Usuario <span style={{ color:'#ef4444' }}>*</span></label>
            <input name="username" value={form.username} onChange={onChange} placeholder="tu_usuario" style={s.input} required />
            <label style={s.label}>Contraseña <span style={{ color:'#ef4444' }}>*</span></label>
            <input name="password" type="password" value={form.password} onChange={onChange} placeholder="Mínimo 8 caracteres" style={s.input} required />
            <button type="submit" style={s.btnPrimary} disabled={cargando}>
              {cargando ? 'Creando cuenta...' : 'Crear cuenta →'}
            </button>
          </form>
        )}

        <p style={s.footer}>¿Eres administrador? <a href="/login" style={{ color:'#60a5fa' }}>Ir al panel</a></p>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center', padding:24, position:'relative', overflow:'hidden' },
  blob1: { position:'absolute', top:-120, right:-100, width:450, height:450, background:'radial-gradient(circle,rgba(59,130,246,.12) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  blob2: { position:'absolute', bottom:-100, left:-80, width:350, height:350, background:'radial-gradient(circle,rgba(139,92,246,.1) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  card: { background:'#161b27', border:'1px solid #2a3348', borderRadius:20, padding:'36px 32px', width:'100%', maxWidth:420, position:'relative', zIndex:1, boxShadow:'0 20px 60px rgba(0,0,0,.5)' },
  logo: { display:'flex', alignItems:'center', gap:14, marginBottom:28 },
  logoTitle: { fontSize:20, fontWeight:700, color:'#e2e8f0' },
  logoSub:   { fontSize:12, color:'#64748b', marginTop:2 },
  tabs: { display:'flex', gap:4, background:'#1e2535', borderRadius:10, padding:4, marginBottom:20 },
  tab: (active) => ({ flex:1, padding:'8px 12px', border:'none', borderRadius:8, cursor:'pointer', fontSize:13.5, fontWeight:600, transition:'all .2s', background:active?'#3b82f6':'transparent', color:active?'#fff':'#94a3b8' }),
  form: { display:'flex', flexDirection:'column', gap:12 },
  label: { fontSize:12.5, fontWeight:600, color:'#94a3b8', marginBottom:2 },
  input: { width:'100%', padding:'10px 14px', background:'#1e2535', border:'1px solid #2a3348', borderRadius:10, color:'#e2e8f0', fontSize:14, outline:'none' },
  btnPrimary: { marginTop:8, padding:12, borderRadius:10, border:'none', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', fontSize:14.5, fontWeight:700, cursor:'pointer' },
  alert: (t) => ({ padding:'10px 14px', borderRadius:8, marginBottom:4, fontSize:13, fontWeight:500, background:t==='danger'?'rgba(239,68,68,.12)':'rgba(34,197,94,.12)', border:`1px solid ${t==='danger'?'rgba(239,68,68,.3)':'rgba(34,197,94,.3)'}`, color:t==='danger'?'#fca5a5':'#86efac' }),
  footer: { textAlign:'center', marginTop:20, fontSize:13, color:'#64748b' },
}
