import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    try {
      localStorage.removeItem('token')
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      {/* Sidebar (wrapper con clase .sidebar, sin scroll interno) */}
      <aside className="sidebar">
        <Sidebar collapsed={collapsed} onLogout={handleLogout} />
      </aside>

      {/* Contenido */}
      <main className="content">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn"
            title={collapsed ? 'Expandir' : 'Colapsar'}
            onClick={() => setCollapsed(c => !c)}
          >
            {/* hamburguesa simple */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </button>

          <div style={{ opacity: .7 }} className="hide-when-collapsed">Panel</div>
          <div style={{ flex: 1 }} />
        </div>

        <Outlet />
      </main>
    </div>
  )
}
