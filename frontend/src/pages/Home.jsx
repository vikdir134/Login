import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useTheme } from '../theme/ThemeProvider'

export default function Home() {
  const [msg, setMsg] = useState('...')
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    api.get('/api/secure/hello')
      .then(res => setMsg(res.data.message))
      .catch(() => setMsg('No autorizado'))
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="page" style={{ padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Home protegida</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={toggle}>
            {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
          <button onClick={logout} className="btn" style={{ width: 'auto' }}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <p className="muted">{msg}</p>
    </div>
  )
}
