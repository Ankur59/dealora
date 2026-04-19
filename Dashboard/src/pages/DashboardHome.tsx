import { useAuth } from '../auth/useAuth'
import './DashboardHome.css'

export function DashboardHome() {
  const { user, logout } = useAuth()

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div>
          <h1>Internal dashboard</h1>
          <p className="dash-meta">
            Signed in as <strong>{user?.email}</strong>
          </p>
        </div>
        <button className="dash-signout" type="button" onClick={() => logout()}>
          Sign out
        </button>
      </header>
      <main className="dash-main">
        <p>
          You are authenticated against the ai-coupon-engine API. Build your
          admin views here and call proxied routes under{' '}
          <code>/api/v1/…</code>.
        </p>
      </main>
    </div>
  )
}
