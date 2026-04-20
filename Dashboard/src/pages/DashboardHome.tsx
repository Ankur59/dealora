import './DashboardHome.css'

export function DashboardHome() {
  return (
    <div className="dash-home">
      <h1 className="dash-home-title">Overview</h1>
      <p className="dash-home-lead">
        Use the sidebar to manage partners. Requests go through the Vite proxy
        to <code>/api/v1</code> on the coupon engine (cookies included).
      </p>
    </div>
  )
}
