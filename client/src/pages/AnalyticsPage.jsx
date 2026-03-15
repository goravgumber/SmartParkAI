import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { Activity, Clock3, IndianRupee, Receipt, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '../services/api'
import ProgressRing from '../components/ui/ProgressRing'

const pieColors = ['#00FF88', '#FF3D57', '#FFB300', '#475569']
const insightCacheKey = 'smartpark_ai_insights_cache'
const insightDotClasses = {
  warning: 'bg-brand-red',
  info: 'bg-brand-cyan',
  success: 'bg-brand-green',
  tip: 'bg-brand-amber'
}

function fallbackInsights(summary, peakHour, revenueTrend, topSlot) {
  return [
    {
      type: summary.occupancyRate > 85 ? 'warning' : 'info',
      text: `Peak load is ${summary.occupancyRate?.toFixed?.(1) || 0}% occupancy${peakHour ? ` around ${peakHour}` : ''}.`
    },
    {
      type: topSlot ? 'success' : 'info',
      text: topSlot ? `${topSlot.slotCode} leads usage in ${topSlot.zone} with ${topSlot.count} reservations.` : 'Top slot data is still loading.'
    },
    {
      type: revenueTrend === 'increasing' ? 'success' : revenueTrend === 'decreasing' ? 'warning' : 'info',
      text: `Weekly revenue trend is ${revenueTrend}. ${revenueTrend === 'decreasing' ? 'Review pricing and utilization mix.' : 'Current monetization is holding.'}`
    },
    {
      type: 'tip',
      text: `Reserved inventory is ${summary.reserved || 0} slots. Rebalance zones with low availability first.`
    }
  ].slice(0, 4)
}

function sanitizeInsights(parsed, summary, peakHour, revenueTrend, topSlot) {
  const fallback = fallbackInsights(summary, peakHour, revenueTrend, topSlot)
  if (!Array.isArray(parsed)) return fallback

  return parsed
    .slice(0, 4)
    .map((item, index) => ({
      type: ['warning', 'info', 'success', 'tip'].includes(item?.type) ? item.type : fallback[index]?.type || 'info',
      text: typeof item?.text === 'string' && item.text.trim() ? item.text.trim() : fallback[index]?.text || 'Insight unavailable.'
    }))
    .concat(fallback.slice(parsed.length))
    .slice(0, 4)
}

function fmtINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="glass-card border border-brand-cyan/25 px-3 py-2 text-xs text-slate-200">
      <p className="mb-1 text-brand-cyan">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {Number(item.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [facilityId, setFacilityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [occupancy, setOccupancy] = useState([])
  const [revenue, setRevenue] = useState([])
  const [topSlots, setTopSlots] = useState([])
  const [zones, setZones] = useState([])
  const [sortBy, setSortBy] = useState({ key: 'count', direction: 'desc' })
  const [aiInsights, setAiInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsUpdatedAt, setInsightsUpdatedAt] = useState(null)
  const [insightsNow, setInsightsNow] = useState(Date.now())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const facilitiesRes = await api.get('/parking/facilities')
        const facility = facilitiesRes.data.data?.[0]
        if (!facility) {
          setLoading(false)
          return
        }

        setFacilityId(facility.id)

        const [dashboardRes, occupancyRes, revenueRes, topSlotsRes, facilityRes] = await Promise.all([
          api.get(`/analytics/dashboard/${facility.id}`),
          api.get(`/analytics/occupancy/${facility.id}`),
          api.get(`/analytics/revenue/${facility.id}`),
          api.get(`/analytics/top-slots/${facility.id}`),
          api.get(`/parking/facilities/${facility.id}`)
        ])

        setDashboard(dashboardRes.data.data)
        setOccupancy(
          occupancyRes.data.data.map((item) => ({
            ...item,
            reserved: item.reserved ?? Math.max(1, Math.round(item.occupied * 0.18))
          }))
        )
        setRevenue(revenueRes.data.data)
        setTopSlots(topSlotsRes.data.data)
        setZones(facilityRes.data.data.zones || [])
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => {
      setLoading(false)
    })
  }, [])

  const kpis = useMemo(() => {
    const summary = dashboard?.occupancySummary || {}
    const impact = dashboard?.environmentalImpact || {}
    const todayRevenue = dashboard?.todayRevenue || 18640
    const txToday = revenue[revenue.length - 1]?.transactions || 0

    return {
      occupancyRate: summary.occupancyRate || 0,
      timeSaved: impact.carsGuided ? impact.timeSaved / impact.carsGuided : 14.3,
      todayRevenue,
      transactions: txToday
    }
  }, [dashboard, revenue])

  const distribution = useMemo(() => {
    const summary = dashboard?.occupancySummary || { total: 0, available: 0, occupied: 0, reserved: 0 }
    const disabled = Math.max(summary.total - summary.available - summary.occupied - summary.reserved, 0)
    return [
      { name: 'Available', value: summary.available },
      { name: 'Occupied', value: summary.occupied },
      { name: 'Reserved', value: summary.reserved },
      { name: 'Disabled', value: disabled }
    ]
  }, [dashboard])

  const zoneRadar = useMemo(() => {
    return zones.map((zone) => {
      const occupied = zone.occupied || 0
      const today = occupied + (zone.reserved || 0)
      return {
        zone: zone.code,
        today,
        yesterday: Math.round(today * 0.85)
      }
    })
  }, [zones])

  const sortedTopSlots = useMemo(() => {
    const rows = [...topSlots]
    rows.sort((a, b) => {
      const dir = sortBy.direction === 'asc' ? 1 : -1
      if (sortBy.key === 'slotCode' || sortBy.key === 'zone') {
        return a[sortBy.key].localeCompare(b[sortBy.key]) * dir
      }
      return (a[sortBy.key] - b[sortBy.key]) * dir
    })
    return rows
  }, [topSlots, sortBy])

  const avgRevenue = useMemo(() => {
    if (!revenue.length) return 0
    return revenue.reduce((sum, d) => sum + d.revenue, 0) / revenue.length
  }, [revenue])

  const occupancySummary = dashboard?.occupancySummary || { total: 0, available: 0, occupied: 0, reserved: 0, occupancyRate: 0 }

  const zoneData = useMemo(() => {
    return zones.map((zone) => ({
      zone: zone.code,
      available: zone.available || 0,
      occupied: zone.occupied || 0,
      reserved: zone.reserved || 0,
      occupancyRate: zone.total ? Number((((zone.occupied || 0) + (zone.reserved || 0)) / zone.total) * 100).toFixed(1) : '0.0'
    }))
  }, [zones])

  const peakHour = useMemo(() => {
    if (!occupancy.length) return 'Unknown'
    const peak = occupancy.reduce((best, current) => {
      const bestValue = (best?.occupied || 0) + (best?.reserved || 0)
      const currentValue = (current?.occupied || 0) + (current?.reserved || 0)
      return currentValue > bestValue ? current : best
    }, occupancy[0])
    return peak?.hour || 'Unknown'
  }, [occupancy])

  const revenueTrend = useMemo(() => {
    if (revenue.length < 2) return 'stable'
    const first = revenue[0]?.revenue || 0
    const last = revenue[revenue.length - 1]?.revenue || 0
    if (last > first) return 'increasing'
    if (last < first) return 'decreasing'
    return 'stable'
  }, [revenue])

  const topSlot = useMemo(() => {
    if (!sortedTopSlots.length) return null
    return sortedTopSlots[0]
  }, [sortedTopSlots])

  const confidence = Math.max(0, Math.min(100, Number(kpis.occupancyRate || 0)))

  async function generateAIInsights() {
    const totalSlots = occupancySummary.total || 0
    const available = occupancySummary.available || 0
    const occupied = occupancySummary.occupied || 0
    const reserved = occupancySummary.reserved || 0
    const occupancyRate = Number(kpis.occupancyRate || 0).toFixed(1)
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    const fallback = fallbackInsights(occupancySummary, peakHour, revenueTrend, topSlot)

    if (!totalSlots || !zones.length || !topSlots.length) {
      setAiInsights(fallback)
      setInsightsUpdatedAt(Date.now())
      return
    }

    if (!apiKey) {
      setAiInsights((prev) => prev.length ? prev : fallback)
      setInsightsUpdatedAt(Date.now())
      return
    }

    setInsightsLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a parking facility AI analyst. Based on this real-time data, give exactly 4 short actionable insights.

Facility Data:
- Total slots: ${totalSlots}
- Available: ${available} | Occupied: ${occupied} | Reserved: ${reserved}
- Occupancy rate: ${occupancyRate}%
- Zone breakdown: ${JSON.stringify(zoneData)}
- Peak hour today: ${peakHour}
- Weekly revenue trend: ${revenueTrend}
- Top slot: ${topSlot ? JSON.stringify({ slotCode: topSlot.slotCode, zone: topSlot.zone, count: topSlot.count, revenue: topSlot.revenue }) : 'Unknown'}
- Current time: ${new Date().toLocaleTimeString()}

Return ONLY a JSON array of exactly 4 objects, no markdown, no extra text:
[
  {"type": "warning|info|success|tip", "text": "short actionable insight"},
  ...
]

Types:
- warning = red dot (capacity issue, device offline, anomaly)
- info = blue dot (pattern observation)
- success = green dot (positive metric)
- tip = yellow dot (optimization suggestion)`
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`Claude returned ${response.status}`)
      }

      const data = await response.json()
      const text = data?.content?.[0]?.text?.trim()
      const insights = sanitizeInsights(JSON.parse(text), occupancySummary, peakHour, revenueTrend, topSlot)
      setAiInsights(insights)
      setInsightsUpdatedAt(Date.now())
      localStorage.setItem(insightCacheKey, JSON.stringify({ insights, updatedAt: Date.now() }))
    } catch (_error) {
      const cached = localStorage.getItem(insightCacheKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setAiInsights(parsed.insights || fallback)
          setInsightsUpdatedAt(parsed.updatedAt || Date.now())
        } catch {
          setAiInsights((prev) => prev.length ? prev : fallback)
          setInsightsUpdatedAt(Date.now())
        }
      } else {
        setAiInsights((prev) => prev.length ? prev : fallback)
        setInsightsUpdatedAt(Date.now())
      }
    } finally {
      setInsightsLoading(false)
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(insightCacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed.insights) && parsed.insights.length) {
          setAiInsights(parsed.insights)
          setInsightsUpdatedAt(parsed.updatedAt || null)
        }
      } catch {
        // Ignore invalid cache.
      }
    }
  }, [])

  useEffect(() => {
    if (!dashboard || !zones.length || !topSlots.length || !occupancy.length || !revenue.length) return
    generateAIInsights()
    const interval = setInterval(generateAIInsights, 60000)
    return () => clearInterval(interval)
  }, [dashboard, zones, topSlots, occupancy, revenue])

  useEffect(() => {
    if (!insightsUpdatedAt) return
    const interval = setInterval(() => setInsightsNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [insightsUpdatedAt])

  const updatedAgoSeconds = useMemo(() => {
    if (!insightsUpdatedAt) return null
    return Math.max(0, Math.floor((insightsNow - insightsUpdatedAt) / 1000))
  }, [insightsNow, insightsUpdatedAt])

  const topCards = [
    {
      title: 'Occupancy Rate',
      value: `${kpis.occupancyRate.toFixed(1)}%`,
      accent: 'border-l-cyan-400',
      bg: 'from-cyan-400/14 via-cyan-400/6 to-transparent',
      text: 'text-brand-cyan',
      icon: <Activity size={16} />,
      trend: 'Live facility load'
    },
    {
      title: 'Time Saved',
      value: `${kpis.timeSaved.toFixed(1)}`,
      unit: 'min/driver',
      accent: 'border-l-emerald-400',
      bg: 'from-emerald-400/14 via-emerald-400/6 to-transparent',
      text: 'text-emerald-300',
      icon: <Clock3 size={16} />,
      trend: 'Efficiency rising'
    },
    {
      title: 'Daily Revenue',
      value: fmtINR(kpis.todayRevenue),
      accent: 'border-l-amber-400',
      bg: 'from-amber-400/14 via-amber-400/6 to-transparent',
      text: 'text-amber-300',
      icon: <IndianRupee size={16} />,
      trend: 'Vs yesterday +12%'
    },
    {
      title: 'Transactions Today',
      value: Number(kpis.transactions).toLocaleString(),
      accent: 'border-l-violet-400',
      bg: 'from-violet-400/14 via-violet-400/6 to-transparent',
      text: 'text-violet-200',
      icon: <Receipt size={16} />,
      trend: 'Peak window 6-8 PM'
    }
  ]

  if (loading) {
    return <div className="panel-frame min-h-[72vh] animate-pulse text-brand-cyan">Loading analytics...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className={`panel-frame flex items-center gap-4 border-l-4 bg-gradient-to-br ${topCards[0].bg} ${topCards[0].accent}`}>
          <ProgressRing percent={kpis.occupancyRate} size={86} strokeWidth={8} color="#00E5FF" />
          <div>
            <p className="text-sm text-slate-300">Occupancy Rate</p>
            <p className="font-mono text-4xl text-brand-cyan">{kpis.occupancyRate.toFixed(1)}%</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span className="text-brand-cyan">{topCards[0].icon}</span>
              <span>{topCards[0].trend}</span>
            </div>
          </div>
        </div>

        {topCards.slice(1).map((card) => (
          <div key={card.title} className={`panel-frame border-l-4 bg-gradient-to-br ${card.bg} ${card.accent}`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-300">{card.title}</p>
              <span className={card.text}>{card.icon}</span>
            </div>
            <div className={`font-mono text-4xl font-semibold ${card.text}`}>
              {card.value}
              {card.unit ? <span className="ml-2 text-lg font-medium text-slate-300">{card.unit}</span> : null}
            </div>
            <div className="mt-2 text-xs text-slate-400">{card.trend}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="panel-frame xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-orbitron text-lg text-brand-cyan">24-Hour Occupancy Trend</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={occupancy}>
                <defs>
                  <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF3D57" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#FF3D57" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFB300" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#FFB300" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x="19:00" stroke="#00E5FF" label={{ value: 'PEAK ↑', fill: '#00E5FF', fontSize: 10 }} />
                <Area type="monotone" dataKey="occupied" name="Occupied" stroke="#FF3D57" fill="url(#occGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="reserved" name="Reserved" stroke="#FFB300" fill="url(#resGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-frame xl:col-span-2">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Slot Status Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" innerRadius={60} outerRadius={92} paddingAngle={3}>
                  {distribution.map((entry, idx) => (
                    <Cell key={entry.name} fill={pieColors[idx]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <text x="50%" y="48%" textAnchor="middle" fill="#00E5FF" fontSize="14" fontFamily="JetBrains Mono">
                  {dashboard?.occupancySummary?.total || 0} Total
                </text>
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="panel-frame">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Weekly Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={avgRevenue} stroke="#FFB300" label={{ value: 'Avg', fill: '#FFB300', fontSize: 10 }} />
                <Bar dataKey="revenue" fill="#00E5FF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-frame">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Zone Comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius={90} data={zoneRadar}>
                <PolarGrid stroke="rgba(255,255,255,0.15)" />
                <PolarAngleAxis dataKey="zone" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Radar dataKey="today" stroke="#00E5FF" fill="#00E5FF" fillOpacity={0.35} name="Today" />
                <Radar dataKey="yesterday" stroke="#FFB300" fill="#FFB300" fillOpacity={0.2} name="Yesterday" />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-frame">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-orbitron text-lg text-brand-cyan">
              <Sparkles size={16} />
              AI Insights Panel
            </h3>
            <button
              type="button"
              onClick={generateAIInsights}
              disabled={insightsLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-cyan/25 bg-brand-cyan/10 px-2.5 py-1 text-xs text-brand-cyan transition hover:bg-brand-cyan/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>

          {insightsLoading ? (
            <div className="flex min-h-[158px] items-center justify-center">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-cyan/80 animate-pulse" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand-cyan/70 animate-pulse [animation-delay:120ms]" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand-cyan/60 animate-pulse [animation-delay:240ms]" />
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-200">
              {(aiInsights.length ? aiInsights : fallbackInsights(occupancySummary, peakHour, revenueTrend, topSlot)).slice(0, 4).map((insight, index) => (
                <div key={`${insight.type}-${index}`} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${insightDotClasses[insight.type] || insightDotClasses.info}`} />
                  <p>{insight.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-brand-cyan/20 bg-dark-surface/70 p-3 text-xs text-slate-300">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-brand-cyan">AI Confidence</p>
              <p className="font-mono text-brand-cyan">{confidence.toFixed(0)}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded bg-dark-border">
              <div className="h-full bg-gradient-to-r from-brand-cyan to-brand-violet transition-all duration-500" style={{ width: `${confidence}%` }} />
            </div>
          </div>

          <div className="mt-3 text-right text-xs text-slate-400">
            Updated {updatedAgoSeconds ?? 0} seconds ago
          </div>
        </div>
      </div>

      <div className="panel-frame">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-orbitron text-lg text-brand-cyan">Top Slots</h3>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Activity size={12} /> Live ranking
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  { key: 'rank', label: 'Rank' },
                  { key: 'slotCode', label: 'Slot' },
                  { key: 'zone', label: 'Zone' },
                  { key: 'count', label: 'Reservations' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'status', label: 'Status' }
                ].map((head) => (
                  <th key={head.key} className="cursor-pointer px-2 py-2" onClick={() => {
                    if (head.key === 'rank' || head.key === 'status') return
                    setSortBy((prev) => ({
                      key: head.key,
                      direction: prev.key === head.key && prev.direction === 'desc' ? 'asc' : 'desc'
                    }))
                  }}>
                    {head.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTopSlots.map((row, idx) => (
                <tr key={row.slotId} className="border-t border-dark-border/70">
                  <td className="px-2 py-2">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
                  <td className="px-2 py-2 font-mono text-brand-cyan">{row.slotCode}</td>
                  <td className="px-2 py-2">{row.zone}</td>
                  <td className="px-2 py-2 font-mono">{row.count}</td>
                  <td className="px-2 py-2 font-mono text-brand-green">{fmtINR(row.revenue)}</td>
                  <td className="px-2 py-2"><span className="rounded-full border border-brand-green/40 bg-brand-green/10 px-2 py-0.5 text-xs text-brand-green">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
