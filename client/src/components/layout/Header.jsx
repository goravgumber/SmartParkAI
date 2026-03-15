import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronDown, Menu, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { api } from '../../services/api'

export default function Header({ title, breadcrumb, unreadCount = 0, onMenuToggle, recentAlerts = [] }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [clock, setClock] = useState(() => new Date())
  const [showAlerts, setShowAlerts] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setClock(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const initials = useMemo(
    () =>
      (user?.name || 'Mission User')
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    [user?.name]
  )

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function getRouteShortcuts(query) {
    const routeCatalog = [
      { id: 'route-map', title: 'Map Overview', subtitle: 'Go to live parking grid', path: '/dashboard/map', keywords: ['map', 'slot', 'zone', 'parking'] },
      { id: 'route-analytics', title: 'Analytics', subtitle: 'Go to analytics charts', path: '/dashboard/analytics', keywords: ['analytics', 'chart', 'trend'] },
      { id: 'route-environment', title: 'Environment', subtitle: 'Go to impact dashboard', path: '/dashboard/environment', keywords: ['environment', 'co2', 'green'] },
      { id: 'route-reservations', title: 'Reservations', subtitle: 'Go to reservations center', path: '/dashboard/reservations', keywords: ['reservation', 'booking', 'driver'] },
      { id: 'route-revenue', title: 'Revenue', subtitle: 'Go to revenue dashboard', path: '/dashboard/revenue', keywords: ['revenue', 'finance', 'payment'] },
      { id: 'route-alerts', title: 'Alerts', subtitle: 'Go to alerts and rules', path: '/dashboard/alerts', keywords: ['alert', 'notification', 'rules'] },
      { id: 'route-ai', title: 'AI Predictions', subtitle: 'Go to forecast engine', path: '/dashboard/ai', keywords: ['ai', 'prediction', 'forecast'] },
      { id: 'route-admin', title: 'Admin Panel', subtitle: 'Go to admin controls', path: '/dashboard/admin', keywords: ['admin', 'device', 'system'] }
    ]

    return routeCatalog
      .filter((entry) => entry.title.toLowerCase().includes(query) || entry.keywords.some((word) => word.includes(query)))
      .map((entry) => ({ ...entry, kind: 'route' }))
  }

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!searchRef.current?.contains(event.target)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    let cancelled = false
    const query = searchQuery.trim().toLowerCase()
    if (query.length < 2) {
      setSearchResults([])
      return undefined
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const routeMatches = getRouteShortcuts(query)
        const facilitiesRes = await api.get('/parking/facilities')
        const facilities = facilitiesRes.data.data || []
        const facility = facilities[0]

        let slotMatches = []
        let reservationMatches = []
        let facilityMatches = facilities
          .filter((item) => item.name.toLowerCase().includes(query) || item.address.toLowerCase().includes(query))
          .slice(0, 3)
          .map((item) => ({
            id: `facility-${item.id}`,
            title: item.name,
            subtitle: item.address,
            path: '/dashboard/map',
            kind: 'facility'
          }))

        if (facility?.id) {
          const [slotsRes, reservationsRes] = await Promise.all([
            api.get(`/parking/facilities/${facility.id}/slots`),
            api.get('/reservations?page=1&limit=30')
          ])

          const slots = slotsRes.data.data || []
          const reservations = reservationsRes.data.data?.data || []

          slotMatches = slots
            .filter(
              (slot) =>
                slot.slotCode.toLowerCase().includes(query) ||
                slot.zone?.name?.toLowerCase().includes(query) ||
                slot.status.toLowerCase().includes(query)
            )
            .slice(0, 4)
            .map((slot) => ({
              id: `slot-${slot.id}`,
              title: `Slot ${slot.slotCode}`,
              subtitle: `${slot.zone?.name || 'Zone'} • ${slot.status}`,
              path: '/dashboard/map',
              kind: 'slot'
            }))

          reservationMatches = reservations
            .filter(
              (reservation) =>
                reservation.reservationCode.toLowerCase().includes(query) ||
                reservation.vehicleNumber.toLowerCase().includes(query) ||
                reservation.driverName.toLowerCase().includes(query)
            )
            .slice(0, 4)
            .map((reservation) => ({
              id: `res-${reservation.id}`,
              title: `${reservation.reservationCode} • ${reservation.driverName}`,
              subtitle: `${reservation.vehicleNumber} • ${reservation.status}`,
              path: '/dashboard/reservations',
              kind: 'reservation'
            }))
        }

        if (!cancelled) {
          setSearchResults([...routeMatches, ...facilityMatches, ...slotMatches, ...reservationMatches].slice(0, 10))
          setShowSearchResults(true)
        }
      } catch (_error) {
        if (!cancelled) {
          setSearchResults(getRouteShortcuts(query))
          setShowSearchResults(true)
        }
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

  function selectSearchResult(item) {
    navigate(item.path)
    setShowSearchResults(false)
    setSearchQuery('')
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    if (searchResults.length > 0) {
      selectSearchResult(searchResults[0])
    }
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-brand-cyan/20 bg-[#060f20]/90 backdrop-blur-xl md:left-[260px]">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg border border-brand-cyan/30 p-2 text-brand-cyan md:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="truncate font-orbitron text-lg text-brand-cyan">{title}</p>
            <p className="truncate text-xs text-slate-400">{breadcrumb}</p>
          </div>
        </div>

        <div ref={searchRef} className="relative hidden w-full max-w-xl md:block">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 rounded-xl border border-brand-cyan/20 bg-dark-surface/70 px-3 py-2">
            <Search size={16} className="text-brand-cyan" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true)
              }}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search slots, zones, drivers..."
              className="w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-500 outline-none"
            />
          </form>

          {showSearchResults ? (
            <div className="glass-card absolute left-0 right-0 top-12 z-[70] max-h-80 overflow-y-auto border border-brand-cyan/25 p-2">
              {searchLoading ? <p className="px-2 py-2 text-xs text-slate-400">Searching...</p> : null}
              {!searchLoading && searchResults.length === 0 ? <p className="px-2 py-2 text-xs text-slate-400">No results found.</p> : null}
              {!searchLoading
                ? searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSearchResult(item)}
                      className="block w-full rounded-lg px-2 py-2 text-left hover:bg-brand-cyan/10"
                    >
                      <p className="text-sm text-white">{item.title}</p>
                      <p className="text-xs text-slate-400">{item.subtitle}</p>
                    </button>
                  ))
                : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="hidden items-center gap-1 rounded-lg border border-brand-cyan/25 bg-brand-cyan/5 px-2.5 py-1.5 text-xs text-slate-200 md:flex"
          >
            <span>📍 Mumbai, Maharashtra</span>
            <ChevronDown size={14} className="text-brand-cyan" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAlerts((v) => !v)
                setShowUserMenu(false)
              }}
              className="relative rounded-lg border border-brand-cyan/20 bg-dark-surface/80 p-2 text-slate-200 transition hover:text-brand-cyan"
            >
              <Bell size={18} />
              <span className="absolute -right-1 -top-1 rounded-full bg-brand-red px-1.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            </button>

            {showAlerts ? (
              <div className="glass-card absolute right-0 mt-2 w-72 border border-brand-cyan/20 p-3">
                <p className="mb-2 text-sm font-semibold text-brand-cyan">Recent Alerts</p>
                <div className="space-y-2">
                  {recentAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-dark-border bg-dark-surface/70 px-2.5 py-2">
                      <p className="text-xs font-medium text-white">{alert.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{alert.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowUserMenu((v) => !v)
                setShowAlerts(false)
              }}
              className="flex items-center gap-2 rounded-lg border border-brand-cyan/20 bg-dark-surface/80 px-2 py-1.5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan to-brand-violet font-mono text-[11px] font-bold text-dark-base">
                {initials || 'SP'}
              </span>
              <ChevronDown size={14} className="hidden text-brand-cyan md:block" />
            </button>

            {showUserMenu ? (
              <div className="glass-card absolute right-0 mt-2 w-40 border border-brand-cyan/20 py-1.5 text-sm">
                <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-brand-cyan/10">
                  Profile
                </button>
                <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-brand-cyan/10">
                  Settings
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full px-3 py-1.5 text-left text-brand-red hover:bg-brand-red/10"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          <div className="hidden rounded-lg border border-brand-cyan/20 bg-dark-surface/80 px-2.5 py-1.5 font-mono text-sm text-brand-green md:block">
            {clock.toLocaleTimeString('en-US', { hour12: false })}
          </div>
        </div>
      </div>
    </header>
  )
}
