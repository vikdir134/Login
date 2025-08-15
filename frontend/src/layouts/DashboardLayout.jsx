import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { getUserFromToken, getDisplayName } from '../utils/auth'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const me = getUserFromToken()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} onLogout={handleLogout} />

      <main style={{ flex: 1, padding: 16 }}>
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 12, borderRadius: 12, marginBottom: 16,
          background: 'linear-gradient(90deg, #7c3aed, #9333ea)', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCollapsed(v => !v)}
              style={{
                background: 'rgba(255,255,255,.15)',
                border: '1px solid rgba(255,255,255,.25)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer'
              }}
              title={collapsed ? 'Mostrar barra' : 'Ocultar barra'}
            >
              {collapsed ? '☰' : '✕'}
            </button>
            <strong>Panel</strong>
          </div>

          {/* quién está logueado */}
          <div style={{ fontSize: 14, opacity: .95 }}>
            {getDisplayName(me)} — <span style={{ fontWeight: 600 }}>{me?.role}</span>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  )
}
