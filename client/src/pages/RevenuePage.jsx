import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import ToastContainer from '../components/ui/ToastContainer'
import { api } from '../services/api'

function fmtINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function makeRevenue30Days() {
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1
    const parking = 10500 + i * 170 + Math.round(Math.random() * 2800)
    const reservations = 3500 + i * 90 + Math.round(Math.random() * 1500)
    const penalties = 200 + Math.round(Math.random() * 900)
    const total = parking + reservations + penalties
    return {
      day,
      parking,
      reservations,
      penalties,
      total,
      weekend: day % 7 === 0 || day % 7 === 6
    }
  }).map((row, index, arr) => {
    const chunk = arr.slice(Math.max(0, index - 6), index + 1)
    const movingAvg = Math.round(chunk.reduce((sum, item) => sum + item.total, 0) / chunk.length)
    return { ...row, movingAvg }
  })
}

function makeHeatmapData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return days.map((day, dIdx) => ({
    day,
    values: Array.from({ length: 24 }, (_, hour) => {
      const base = 420 + dIdx * 80
      const peak = hour >= 17 && hour <= 20 ? 620 : hour >= 9 && hour <= 12 ? 280 : 120
      return Math.round(base + peak + Math.random() * 260)
    })
  }))
}

function Sparkline() {
  const points = '0,24 14,18 28,20 42,10 56,14 70,6 84,11 98,8'
  return (
    <svg viewBox="0 0 100 30" className="h-8 w-24">
      <polyline points={points} fill="none" stroke="#00E5FF" strokeWidth="2" />
    </svg>
  )
}

export default function RevenuePage() {
  const [dashboard, setDashboard] = useState(null)
  const [weeklyRevenue, setWeeklyRevenue] = useState([])
  const [facilityId, setFacilityId] = useState('')
  const [toasts, setToasts] = useState([])
  const [heatHover, setHeatHover] = useState('')
  const [aiRows, setAiRows] = useState([
    { id: 1, zone: 'Zone A Standard', current: 20, suggested: 35, hint: '↑ Peak Detected' },
    { id: 2, zone: 'Zone B Standard', current: 20, suggested: 20, hint: '= Stable' },
    { id: 3, zone: 'Zone C Standard', current: 20, suggested: 15, hint: '↓ Low Demand' },
    { id: 4, zone: 'VIP Premium', current: 50, suggested: 80, hint: '↑ High Demand' }
  ])

  useEffect(() => {
    async function load() {
      const facilitiesRes = await api.get('/parking/facilities')
      const facility = facilitiesRes.data.data?.[0]
      if (!facility) return
      setFacilityId(facility.id)

      const [dashboardRes, revenueRes] = await Promise.all([
        api.get(`/analytics/dashboard/${facility.id}`),
        api.get(`/analytics/revenue/${facility.id}`)
      ])
      setDashboard(dashboardRes.data.data)
      setWeeklyRevenue(revenueRes.data.data)
    }

    load().catch(() => {})
  }, [])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))
  const addToast = (toast) => setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])

  const monthly = useMemo(() => makeRevenue30Days(), [])
  const heatmap = useMemo(() => makeHeatmapData(), [])

  const paymentSplit = [
    { name: 'UPI', value: 58, color: '#00E5FF' },
    { name: 'Card', value: 22, color: '#7B61FF' },
    { name: 'Cash', value: 8, color: '#FFB300' },
    { name: 'Other', value: 12, color: '#475569' }
  ]

  const zoneRevenue = [
    { zone: 'Zone A', value: 128000 },
    { zone: 'Zone B', value: 112500 },
    { zone: 'Zone C', value: 94700 },
    { zone: 'VIP', value: 88200 },
    { zone: 'Handicap', value: 22600 }
  ]

  const totalToday = dashboard?.todayRevenue || 18640
  const totalWeek = dashboard?.weekRevenue || 128450
  const monthRevenue = Math.round(monthly.reduce((sum, d) => sum + d.total, 0))

  function tone(v) {
    if (v < 400) return 'bg-brand-cyan/5'
    if (v < 900) return 'bg-brand-cyan/30'
    return 'bg-brand-cyan'
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="panel-frame">
          <p className="text-xs text-slate-400">Today&apos;s Revenue</p>
          <p className="font-mono text-2xl text-brand-green">{fmtINR(totalToday)}</p>
          <Sparkline />
        </div>
        <div className="panel-frame"><p className="text-xs text-slate-400">This Week</p><p className="font-mono text-2xl">{fmtINR(totalWeek)} <span className="text-sm text-brand-green">↑8.3%</span></p></div>
        <div className="panel-frame"><p className="text-xs text-slate-400">This Month</p><p className="font-mono text-2xl">{fmtINR(monthRevenue)} <span className="text-sm text-brand-green">↑15.7%</span></p></div>
        <div className="panel-frame"><p className="text-xs text-slate-400">Avg/Slot/Day</p><p className="font-mono text-2xl">₹155</p></div>
        <div className="panel-frame"><p className="text-xs text-slate-400">Pending Settlement</p><p className="font-mono text-2xl text-brand-amber">₹28,400</p></div>
      </div>

      <div className="panel-frame">
        <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">30-Day Revenue Trend</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}K`} />
              <Tooltip formatter={(v) => fmtINR(v)} />
              <Legend />
              <Bar dataKey="parking" stackId="rev" fill="#0ea5e9" name="Parking" />
              <Bar dataKey="reservations" stackId="rev" fill="#22d3ee" name="Reservations" />
              <Bar dataKey="penalties" stackId="rev" fill="#f59e0b" name="Penalties" />
              <Line type="monotone" dataKey="movingAvg" stroke="#00E5FF" strokeWidth={3} dot={false} name="7-day MA" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="panel-frame">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Revenue by Zone</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneRevenue} layout="vertical" margin={{ left: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" tickFormatter={(v) => `₹${Math.round(v / 1000)}K`} stroke="#94a3b8" />
                <YAxis type="category" dataKey="zone" stroke="#94a3b8" />
                <Tooltip formatter={(v) => fmtINR(v)} />
                <Bar dataKey="value" fill="#00E5FF" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-frame">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Payment Method Split</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentSplit} innerRadius={58} outerRadius={94} dataKey="value" nameKey="name" label={(entry) => `${entry.name} ${entry.value}%`}>
                  {paymentSplit.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel-frame">
        <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Revenue Heatmap</h3>
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[80px_repeat(24,minmax(20px,1fr))] gap-1 text-[10px]">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={`h-${h}`} className="text-center text-slate-500">{h}</div>
            ))}
            {heatmap.map((row) => (
              <div key={row.day} className="contents">
                <div className="flex items-center text-xs text-slate-400">{row.day}</div>
                {row.values.map((value, hour) => (
                  <div
                    key={`${row.day}-${hour}`}
                    onMouseEnter={() => setHeatHover(`${row.day} ${hour}:00: ${fmtINR(value)}`)}
                    className={`h-6 rounded ${tone(value)} transition hover:scale-105`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">{heatHover || 'Hover a cell to inspect hourly revenue.'}</p>
      </div>

      <div className="panel-frame border-t-2 border-t-transparent" style={{ borderImage: 'linear-gradient(90deg,#00E5FF,#7B61FF) 1' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-orbitron text-lg text-brand-cyan">AI Dynamic Pricing Engine</h3>
          <span className="rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-xs text-brand-green animate-pulse">ACTIVE</span>
        </div>

        <div className="space-y-2">
          {aiRows.map((row) => (
            <div key={row.id} className="glass-card flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p>{row.zone}</p>
                  <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-cyan">
                    AI
                  </span>
                </div>
                <p className="text-xs text-slate-400">₹{row.current}/hr → <span className="text-brand-cyan">₹{row.suggested}/hr</span> <span className="text-brand-amber">[{row.hint}]</span></p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addToast({ type: 'warning', title: `${row.zone} suggestion applied` })}
                  className="rounded border border-brand-green/30 bg-brand-green/15 px-2 py-1 text-xs text-brand-green transition hover:bg-brand-green/20"
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-600/70 bg-transparent px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Ignore
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => addToast({ type: 'success', title: 'All suggestions applied' })}
          className="mt-3 w-full rounded-lg bg-brand-amber/20 px-4 py-2 text-sm text-brand-amber"
        >
          Apply All Suggestions
        </button>
        <p className="mt-2 text-sm text-brand-green">Estimated uplift: +₹4,200 today (+22.5%)</p>
      </div>
    </div>
  )
}
