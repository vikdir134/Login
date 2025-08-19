// src/layouts/DashboardLayout.jsx
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const onLogout = () => {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="sidebar">
        <Sidebar collapsed={collapsed} onLogout={onLogout} />
      </aside>

      <main className="content">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn"
            title={collapsed ? 'Expandir' : 'Colapsar'}
            onClick={() => setCollapsed(c => !c)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </button>
          <div style={{ opacity:.7 }}>Panel</div>
          <div style={{ flex:1 }} />
        </div>

        <Outlet />
      </main>
    </div>
  )
}
