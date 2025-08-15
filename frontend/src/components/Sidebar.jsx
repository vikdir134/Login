import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'
import { getUserFromToken, getInitials } from '../utils/auth'

const nav = [
  { to: '/app', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/app/clientes', label: 'Clientes', icon: '👥' },
  { to: '/app/pedidos', label: 'Pedidos', icon: '🧾' },
  { to: '/app/almacen', label: 'Almacén', icon: '📦' },
  { to: '/app/producto-terminado', label: 'Producto Terminado', icon: '🧱' },
  { to: '/app/entregas', label: 'Entregas', icon: '🚚' },
  { to: '/app/pagos', label: 'Pagos', icon: '💳' },
]

export default function Sidebar({ collapsed = false, onLogout }) {
  const { theme, toggle } = useTheme()
  const user = getUserFromToken()

  const w = collapsed ? 76 : 260
  const hide = collapsed ? { display: 'none' } : {}

  return (
    <aside style={{
      width: w, minHeight: '100vh',
      borderRight: '1px solid var(--card)',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
      transition: 'width .2s ease'
    }}>
      {/* Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: 'var(--card)',
          display: 'grid', placeItems: 'center', fontWeight: 700
        }}>
          L
        </div>
        <strong style={hide}>Mi ERP</strong>
      </div>

      {/* Usuario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--card)', display: 'grid', placeItems: 'center', fontWeight: 700
        }}>
          {getInitials(user?.email)}
        </div>
        <div style={{ display: 'grid', ...hide }}>
          <span className="muted" style={{ fontSize: 12 }}>Usuario</span>
          <strong style={{ fontSize: 14 }}>{user?.email || 'usuario'}</strong>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'grid', gap: 6 }}>
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              'nav-item' + (isActive ? ' nav-item--active' : '')
            }
            title={item.label}
            style={{ justifyContent: 'flex-start' }}
          >
            <span style={{ marginRight: collapsed ? 0 : 8 }}>{item.icon}</span>
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Acciones */}
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="btn-secondary" onClick={toggle} title="Cambiar tema">
          {theme === 'dark' ? '☀️' : '🌙'} {!collapsed && (theme === 'dark' ? 'Claro' : 'Oscuro')}
        </button>

        <button type="button" className="btn" onClick={onLogout} title="Cerrar sesión" style={{ width: '100%' }}>
          ⎋ {!collapsed && 'Salir'}
        </button>
      </div>
    </aside>
  )
}
