import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { useAuth } from '../auth/useAuth'
import './DashboardLayout.css'

export function DashboardLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout-main">
        <header className="app-topbar">
          <span className="app-topbar-title">Internal dashboard</span>
          <div className="app-topbar-actions">
            <span className="app-topbar-user">{user?.email}</span>
            <button
              type="button"
              className="app-topbar-signout"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="app-outlet">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
