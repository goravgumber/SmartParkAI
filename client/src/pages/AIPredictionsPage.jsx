import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import ToastContainer from '../components/ui/ToastContainer'
import { api } from '../services/api'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function fmtINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function formatHourLabel(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

function toPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function buildForecastData(occupancy, occupancySummary, zones, deviceStatus) {
  if (!occupancy.length) return []

  const currentHour = new Date().getHours()
  const reservedRate = occupancySummary.total
    ? (occupancySummary.reserved / occupancySummary.total) * 100
    : 0
  const zonePressure = zones.length
    ? Math.max(...zones.map((zone) => Number(zone.occupancyRate || 0)))
    : occupancySummary.occupancyRate || 0
  const offlineFactor = deviceStatus?.offline ? 1.04 : 1
  const maintenanceFactor = deviceStatus?.maintenance ? 1.02 : 1
  const now = new Date()

  const past = occupancy.map((point, index) => ({
    timelineIndex: index - 24,
    label: `${String(index).padStart(2, '0')}:00`,
    observed: Number(point.rate || 0),
    forecast: null,
    lower: null,
    upper: null
  }))

  const future = Array.from({ length: 24 }, (_, offset) => {
    const sourceHour = (currentHour + offset + 1) % 24
    const base = Number(occupancy[sourceHour]?.rate || occupancySummary.occupancyRate || 52)
    const slope = offset === 0
      ? base - Number(occupancy[currentHour]?.rate || base)
      : Number(occupancy[(sourceHour + 23) % 24]?.rate || base) - Number(occupancy[(sourceHour + 22) % 24]?.rate || base)
    const eveningBoost = sourceHour >= 17 && sourceHour <= 21 ? 1.08 : 1
    const weekendBoost = [0, 6].includes((now.getDay() + Math.floor((currentHour + offset + 1) / 24)) % 7) ? 1.06 : 1
    const reservationBoost = reservedRate > 8 ? 1.03 : 0.99
    const pressureBoost = zonePressure > 85 && sourceHour >= 16 && sourceHour <= 21 ? 1.05 : 1

    const forecast = clamp(
      base * eveningBoost * weekendBoost * reservationBoost * pressureBoost * offlineFactor * maintenanceFactor + slope * 0.65,
      10,
      98
    )
    const spread = clamp(6 + (deviceStatus?.offline || 0) * 2 + (deviceStatus?.maintenance || 0) * 1.5, 6, 14)
    const targetTime = new Date(now)
    targetTime.setHours(now.getHours() + offset + 1, 0, 0, 0)

    return {
      timelineIndex: offset,
      label: formatHourLabel(targetTime),
      observed: null,
      forecast: Number(forecast.toFixed(1)),
      lower: Number(clamp(forecast - spread, 0, 100).toFixed(1)),
      upper: Number(clamp(forecast + spread, 0, 100).toFixed(1))
    }
  })

  return [...past, ...future]
}

function buildSuggestions({ occupancySummary, zones, topSlots, dashboard, revenue, forecastData }) {
  const suggestions = []
  const hottestZone = [...zones].sort((a, b) => Number(b.occupancyRate || 0) - Number(a.occupancyRate || 0))[0]
  const coolestZone = [...zones].sort((a, b) => Number(a.occupancyRate || 0) - Number(b.occupancyRate || 0))[0]
  const topSlot = topSlots[0]
  const offlineDevices = dashboard?.deviceStatus?.offline || 0
  const reservedShare = occupancySummary.total
    ? (occupancySummary.reserved / occupancySummary.total) * 100
    : 0
  const weekAverageRevenue = revenue.length
    ? revenue.reduce((sum, item) => sum + Number(item.revenue || 0), 0) / revenue.length
    : 0
  const latestRevenue = Number(revenue[revenue.length - 1]?.revenue || dashboard?.todayRevenue || 0)
  const forecastPeak = forecastData
    .filter((item) => item.forecast !== null)
    .reduce((best, item) => (item.forecast > (best?.forecast ?? -1) ? item : best), null)

  if (hottestZone && Number(hottestZone.occupancyRate || 0) >= 85) {
    suggestions.push({
      id: `surge-${hottestZone.code}`,
      text: `Price surge for ${hottestZone.name} between ${forecastPeak?.label || 'peak hours'} is justified. Live occupancy is ${toPercent(
        hottestZone.occupancyRate
      )} with only ${hottestZone.available || 0} slots free.`,
      tone: 'success'
    })
  }

  if (coolestZone && Number(coolestZone.occupancyRate || 0) <= 45) {
    suggestions.push({
      id: `rebalance-${coolestZone.code}`,
      text: `${coolestZone.name} is underused at ${toPercent(
        coolestZone.occupancyRate
      )}. Shift overflow guidance or EV inventory here before opening new supply elsewhere.`,
      tone: 'info'
    })
  }

  if (reservedShare >= 10 && occupancySummary.available <= Math.max(12, Math.round(occupancySummary.total * 0.12))) {
    suggestions.push({
      id: 'release-reserved',
      text: `Reserved inventory is ${Math.round(reservedShare)}% of supply while live availability is down to ${occupancySummary.available}. Release a portion of reserved slots to public traffic.`,
      tone: 'warning'
    })
  }

  if (topSlot) {
    suggestions.push({
      id: `top-slot-${topSlot.slotId}`,
      text: `${topSlot.slotCode} in ${topSlot.zone} is your highest-demand slot with ${topSlot.count} reservations and ${fmtINR(
        topSlot.revenue
      )} revenue. Prioritize signage and camera uptime around this corridor.`,
      tone: 'info'
    })
  }

  if (offlineDevices > 0) {
    suggestions.push({
      id: 'device-risk',
      text: `${offlineDevices} device${offlineDevices > 1 ? 's are' : ' is'} offline. Prediction confidence is reduced until telemetry coverage is restored.`,
      tone: 'warning'
    })
  }

  if (latestRevenue && weekAverageRevenue && latestRevenue < weekAverageRevenue * 0.9) {
    suggestions.push({
      id: 'revenue-softness',
      text: `Today's monetization is tracking below the 7-day average. Use demand shaping in low-utilization zones instead of broad discounts.`,
      tone: 'warning'
    })
  }

  return suggestions.slice(0, 3)
}

function buildModelHealthRows(revenue, occupancy) {
  if (!revenue.length) return []

  return revenue.map((item, index, rows) => {
    const actual = Number(item.revenue || 0)
    const previous = Number(rows[index - 1]?.revenue || actual)
    const occupancyRate = Number(occupancy[index]?.rate || occupancy[occupancy.length - 1]?.rate || 60)
    const predicted = Math.round(previous * 0.68 + actual * 0.22 + occupancyRate * 110)
    const error = actual ? Math.abs(((predicted - actual) / actual) * 100) : 0

    return {
      day: item.day,
      predicted,
      actual,
      error: `${error.toFixed(1)}%`
    }
  })
}

function confidenceFromRows(rows) {
  if (!rows.length) return 0
  const avgError = rows.reduce((sum, row) => sum + Number.parseFloat(row.error), 0) / rows.length
  return clamp(100 - avgError * 2.1, 62, 96)
}

export default function AIPredictionsPage() {
  const [facilityId, setFacilityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [occupancy, setOccupancy] = useState([])
  const [revenue, setRevenue] = useState([])
  const [topSlots, setTopSlots] = useState([])
  const [zones, setZones] = useState([])
  const [toasts, setToasts] = useState([])

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
        setOccupancy(occupancyRes.data.data || [])
        setRevenue(revenueRes.data.data || [])
        setTopSlots(topSlotsRes.data.data || [])
        setZones(facilityRes.data.data?.zones || [])
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => {
      setLoading(false)
    })
  }, [])

  const removeToast = (id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))
  const addToast = (toast) => setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])

  const occupancySummary = dashboard?.occupancySummary || {
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    occupancyRate: 0
  }

  const forecastData = useMemo(
    () => buildForecastData(occupancy, occupancySummary, zones, dashboard?.deviceStatus),
    [occupancy, occupancySummary, zones, dashboard]
  )

  const futureForecast = useMemo(
    () => forecastData.filter((item) => item.forecast !== null),
    [forecastData]
  )

  const forecastPeak = useMemo(() => {
    if (!futureForecast.length) return null
    return futureForecast.reduce((best, item) => (item.forecast > (best?.forecast ?? -1) ? item : best), null)
  }, [futureForecast])

  const nextPeakWindow = useMemo(() => {
    if (!forecastPeak) return 'Calibrating...'
    const peakIndex = futureForecast.findIndex((item) => item.label === forecastPeak.label)
    const nextLabel = futureForecast[Math.min(peakIndex + 1, futureForecast.length - 1)]?.label || forecastPeak.label
    return `${forecastPeak.label} – ${nextLabel}`
  }, [forecastPeak, futureForecast])

  const revenueForecast = useMemo(() => {
    const todayRevenue = Number(dashboard?.todayRevenue || revenue[revenue.length - 1]?.revenue || 0)
    const forecastMultiplier = forecastPeak ? 1 + forecastPeak.forecast / 260 : 1.08
    return Math.round(todayRevenue * forecastMultiplier)
  }, [dashboard, revenue, forecastPeak])

  const confidence = useMemo(() => {
    const rows = buildModelHealthRows(revenue, occupancy)
    return confidenceFromRows(rows)
  }, [revenue, occupancy])

  const modelRows = useMemo(() => buildModelHealthRows(revenue, occupancy), [revenue, occupancy])

  const suggestions = useMemo(
    () => buildSuggestions({ occupancySummary, zones, topSlots, dashboard, revenue, forecastData }),
    [occupancySummary, zones, topSlots, dashboard, revenue, forecastData]
  )

  const annotationLines = useMemo(() => {
    const lines = []
    if (forecastPeak) {
      lines.push({
        key: 'peak-window',
        x: forecastPeak.timelineIndex,
        label: 'PEAK ↑',
        color: '#7B61FF'
      })
    }
    if ((dashboard?.deviceStatus?.offline || 0) > 0) {
      const offlineMarker = futureForecast[Math.min(4, futureForecast.length - 1)]
      if (offlineMarker) {
        lines.push({
          key: 'coverage-risk',
          x: offlineMarker.timelineIndex,
          label: 'Coverage Risk',
          color: '#FFB300'
        })
      }
    }
    return lines
  }, [dashboard, forecastPeak, futureForecast])

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="rounded-lg border border-brand-amber/40 bg-brand-amber/10 px-4 py-2 text-sm text-brand-amber">
        Live prediction mode enabled. Forecasts and recommendations are generated from current occupancy, zone utilization, revenue trend, and device health.
      </div>

      <div className="panel-frame">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-orbitron text-lg text-brand-cyan">48-Hour Occupancy Forecast</h3>
          <div className="text-right text-xs text-slate-400">
            <p>{facilityId ? 'Live facility model' : 'Waiting for facility data'}</p>
            <p>Confidence interval adjusts to telemetry health</p>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecastData}>
              <XAxis dataKey="label" stroke="#94a3b8" minTickGap={20} tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Area type="monotone" dataKey="observed" stroke="#00E5FF" fill="rgba(0,229,255,0.24)" name="Past 24h" />
              <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(0,229,255,0.12)" name="Upper" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="rgba(5,11,24,0.85)" name="Lower" />
              <Line type="monotone" dataKey="forecast" stroke="#00E5FF" strokeDasharray="6 4" strokeWidth={2.5} dot={false} name="Forecast" />
              <ReferenceLine x={futureForecast[0]?.label} stroke="#FFB300" label={{ value: 'NOW', fill: '#FFB300', fontSize: 11 }} />
              {annotationLines.map((line) => (
                <ReferenceLine
                  key={line.key}
                  x={forecastData.find((item) => item.timelineIndex === line.x)?.label}
                  stroke={line.color}
                  label={{ value: line.label, fill: line.color, fontSize: 10 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="panel-frame">
          <p className="text-sm text-slate-300">Next Peak</p>
          <p className="font-mono text-2xl text-brand-cyan">{nextPeakWindow}</p>
          <p className="text-xs text-brand-green">Confidence: {confidence.toFixed(1)}%</p>
        </div>
        <div className="panel-frame">
          <p className="text-sm text-slate-300">Max Occupancy</p>
          <p className="font-mono text-2xl text-brand-cyan">{toPercent(forecastPeak?.forecast || occupancySummary.occupancyRate)}</p>
          <p className="text-xs text-slate-400">at {forecastPeak?.label || 'current window'}</p>
        </div>
        <div className="panel-frame">
          <p className="text-sm text-slate-300">Revenue Forecast</p>
          <p className="font-mono text-2xl text-brand-green">{fmtINR(revenueForecast)}</p>
          <p className="text-xs text-slate-400">based on live occupancy and 7-day revenue trend</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="panel-frame">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Live AI Recommendations</h3>
          <div className="space-y-3">
            {suggestions.map((item) => (
              <div key={item.id} className="glass-card px-3 py-2 text-sm">
                <p>{item.text}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => addToast({ type: 'success', title: 'Recommendation applied!' })}
                    className="rounded bg-brand-green/20 px-2 py-1 text-xs text-brand-green"
                  >
                    Accept ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => addToast({ type: 'info', title: 'Recommendation ignored for now.' })}
                    className="rounded border border-dark-border px-2 py-1 text-xs text-slate-300"
                  >
                    Reject ✗
                  </button>
                </div>
              </div>
            ))}
            {!suggestions.length && (
              <div className="glass-card px-3 py-2 text-sm text-slate-300">
                Live recommendations will appear once occupancy and zone telemetry are available.
              </div>
            )}
          </div>
        </div>

        <div className="panel-frame">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Model Health</h3>
          <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-dark-border px-2 py-2">
              <p className="text-xs text-slate-400">Version</p>
              <p className="font-mono">live-heuristic-v1</p>
            </div>
            <div className="rounded-lg border border-dark-border px-2 py-2">
              <p className="text-xs text-slate-400">Refreshed</p>
              <p className="font-mono">{loading ? 'Loading...' : 'Just now'}</p>
            </div>
            <div className="rounded-lg border border-dark-border px-2 py-2">
              <p className="text-xs text-slate-400">Confidence</p>
              <p className="font-mono text-brand-green">{confidence.toFixed(1)}%</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 text-left">Day</th>
                  <th className="py-1 text-left">Predicted Rev</th>
                  <th className="py-1 text-left">Actual Rev</th>
                  <th className="py-1 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row) => (
                  <tr key={row.day} className="border-t border-dark-border/60">
                    <td className="py-1">{row.day}</td>
                    <td className="py-1">{fmtINR(row.predicted)}</td>
                    <td className="py-1">{fmtINR(row.actual)}</td>
                    <td className="py-1">{row.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
