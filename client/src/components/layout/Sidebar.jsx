import { NavLink, useNavigate } from 'react-router-dom'
import {
  Map,
  BarChart2,
  Leaf,
  Calendar,
  DollarSign,
  Bell,
  Brain,
  Settings,
  LogOut
} from 'lucide-react'
import { useAuth } from '../../store/auth'

const navItems = [
  { to: '/dashboard/map', label: 'Map Overview', icon: Map, badge: 'LIVE', badgeTone: 'green' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/dashboard/environment', label: 'Environment', icon: Leaf, badge: 'NEW', badgeTone: 'cyan' },
  { to: '/dashboard/reservations', label: 'Reservations', icon: Calendar, badge: '18', badgeTone: 'amber' },
  { to: '/dashboard/revenue', label: 'Revenue', icon: DollarSign },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell, badge: '6', badgeTone: 'red' },
  { to: '/dashboard/ai', label: 'AI Predictions', icon: Brain, badge: 'BETA', badgeTone: 'violet' },
  { to: '/dashboard/admin', label: 'Admin Panel', icon: Settings }
]

function badgeClass(tone) {
  if (tone === 'green') return 'bg-brand-green/20 text-brand-green border-brand-green/40'
  if (tone === 'amber') return 'bg-brand-amber/20 text-brand-amber border-brand-amber/40'
  if (tone === 'red') return 'bg-brand-red/20 text-brand-red border-brand-red/40'
  if (tone === 'violet') return 'bg-brand-violet/20 text-brand-violet border-brand-violet/40'
  return 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40'
}

export default function Sidebar({ mobileOpen, onClose }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const initials = (user?.name || 'Guest')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      {mobileOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} /> : null}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-brand-cyan/20 bg-[#071327]/90 p-4 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="glass-card mb-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-cyan/40 bg-brand-cyan/10 font-orbitron text-brand-cyan">
              P
            </div>
            <div>
              <p className="font-orbitron text-sm text-brand-cyan">SmartPark AI</p>
              <p className="text-xs text-slate-400">Mission Control</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-green" />
            </span>
            <span className="font-medium text-brand-green">LIVE</span>
            <span className="text-slate-400">System Operational</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-r-lg border-l-2 px-3 py-2.5 transition-all duration-200 ${
                    isActive
                      ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan'
                      : 'border-transparent text-slate-300 hover:bg-brand-cyan/5 hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={17} />
                  <span className="text-sm">{item.label}</span>
                </span>
                {item.badge ? (
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${badgeClass(
                      item.badgeTone
                    )}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>

        <div className="space-y-3 pt-4">
          <div className="glass-card px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan to-brand-violet font-mono text-xs font-bold text-dark-base">
                {initials || 'SP'}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.name || 'Mission User'}</p>
                <p className="text-[11px] uppercase tracking-wide text-brand-cyan">{user?.role || 'DRIVER'}</p>
              </div>
            </div>
          </div>

          <div className="glass-card px-3 py-3 text-xs">
            <p className="mb-2 text-slate-300">System Status</p>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-center justify-between">
                <span>MQTT</span>
                <span className="text-brand-green">🟢 Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Database</span>
                <span className="text-brand-green">🟢 Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Devices</span>
                <span className="text-brand-amber">🟡 3/4 Online</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-red/40 bg-brand-red/5 px-3 py-2 text-sm text-brand-red transition hover:bg-brand-red/15"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
