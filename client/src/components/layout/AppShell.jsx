import { Outlet, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import VoiceAssistant from '../voice/VoiceAssistant'

const titleMap = {
  '/dashboard/map': 'Map Overview',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/environment': 'Environment',
  '/dashboard/reservations': 'Reservations',
  '/dashboard/revenue': 'Revenue',
  '/dashboard/alerts': 'Alerts',
  '/dashboard/ai': 'AI Predictions',
  '/dashboard/admin': 'Admin Panel'
}

export default function AppShell() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = titleMap[location.pathname] || 'Mission Control'
  const breadcrumb = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    return ['Dashboard', ...parts.slice(1).map((part) => part[0].toUpperCase() + part.slice(1))].join(' / ')
  }, [location.pathname])

  const recentAlerts = [
    { id: 1, title: 'Zone B sensor overheating', time: '2 min ago' },
    { id: 2, title: 'RAPI-03 gateway offline', time: '9 min ago' },
    { id: 3, title: 'VIP camera frame drop', time: '14 min ago' }
  ]

  return (
    <div className="min-h-screen bg-dark-base text-white">
      <div className="flex h-screen">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-h-screen flex-1 flex-col">
          <Header
            title={title}
            breadcrumb={breadcrumb}
            unreadCount={6}
            recentAlerts={recentAlerts}
            onMenuToggle={() => setMobileOpen((value) => !value)}
          />

          <main className="flex-1 overflow-y-auto pt-16 md:pl-[260px]">
            <div className="min-h-[calc(100vh-64px)] p-4 md:p-6">
              <div key={location.pathname} className="route-fade-in">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
      <VoiceAssistant />
    </div>
  )
}
