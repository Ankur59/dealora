import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `sidebar-link${isActive ? ' sidebar-link--active' : ''}`

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">Dealora</div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={navClass}>
          Overview
        </NavLink>
        <NavLink to="/partners" className={navClass}>
          Partners
        </NavLink>
        <NavLink to="/coupons" className={navClass}>
          Coupons
        </NavLink>
      </nav>
    </aside>
  )
}
