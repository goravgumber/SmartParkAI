import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { api } from '../services/api'
import ProgressRing from '../components/ui/ProgressRing'
import ToastContainer from '../components/ui/ToastContainer'

function makeTrendData() {
  const baseFuel = 40
  const baseCo2 = 92
  return Array.from({ length: 30 }, (_, idx) => {
    const fuel = baseFuel + idx * 0.85 + (Math.random() * 2 - 1)
    const co2 = baseCo2 + idx * 1.7 + (Math.random() * 2 - 1)
    return {
      day: idx + 1,
      fuel: Number(fuel.toFixed(1)),
      co2: Number(co2.toFixed(1))
    }
  })
}

export default function EnvironmentPage() {
  const [facilityId, setFacilityId] = useState('')
  const [stats, setStats] = useState({
    carsGuided: 0,
    fuelSaved: 0,
    co2Reduced: 0,
    timeSaved: 0,
    treesEquivalent: 0
  })
  const [toasts, setToasts] = useState([])
  const [trendData] = useState(() => makeTrendData())

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 4 + Math.random() * 9,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 3
      })),
    []
  )

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  useEffect(() => {
    async function load() {
      const facilitiesRes = await api.get('/parking/facilities')
      const id = facilitiesRes.data.data?.[0]?.id
      if (!id) return
      setFacilityId(id)

      const envRes = await api.get(`/analytics/environmental/${id}`)
      setStats(envRes.data.data)
    }

    load().catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        fuelSaved: Number((prev.fuelSaved + 0.1).toFixed(1)),
        co2Reduced: Number((prev.co2Reduced + 0.23).toFixed(2)),
        timeSaved: Number((prev.timeSaved + 0.05).toFixed(2))
      }))
    }, 3000)

    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        carsGuided: prev.carsGuided + 1
      }))
    }, 30000)

    return () => clearInterval(id)
  }, [])

  const formulaFuel = Number((stats.carsGuided * 0.2).toFixed(1))
  const formulaCo2 = Number((formulaFuel * 2.31).toFixed(1))
  const rupeesSaved = Number((formulaFuel * 95).toFixed(0))

  return (
    <div className="relative space-y-4 overflow-hidden">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {particles.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: 'rgba(0,255,136,0.08)',
            animation: `float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`
          }}
        />
      ))}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel-frame text-center">
          <p className="text-sm text-slate-300">⛽ FUEL SAVED TODAY</p>
          <p className="font-mono text-5xl text-brand-green">{stats.fuelSaved.toFixed(1)}</p>
          <p className="text-xs text-slate-400">Liters</p>
          <p className="mt-2 text-xs text-slate-400">Every liter saved = one less trip to the pump</p>
        </div>

        <div className="panel-frame text-center">
          <p className="text-sm text-slate-300">🌿 CO₂ EMISSION REDUCED</p>
          <p className="font-mono text-5xl text-brand-green">{stats.co2Reduced.toFixed(1)}</p>
          <p className="text-xs text-slate-400">kg</p>
          <p className="mt-2 text-xs text-slate-400">Equivalent to planting {stats.treesEquivalent.toFixed(1)} trees today</p>
        </div>

        <div className="panel-frame text-center">
          <p className="text-sm text-slate-300">⏱️ TIME SAVED</p>
          <p className="font-mono text-5xl text-brand-cyan">{(stats.timeSaved / 60).toFixed(1)}</p>
          <p className="text-xs text-slate-400">Hours</p>
          <p className="mt-2 text-xs text-slate-400">Time returned to families</p>
        </div>

        <div className="panel-frame text-center">
          <p className="text-sm text-slate-300">🚗 CARS GUIDED</p>
          <p className="font-mono text-5xl text-white">{stats.carsGuided}</p>
          <p className="text-xs text-slate-400">Drivers who skipped the search</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="panel-frame">
          <h3 className="mb-2 font-orbitron text-lg text-brand-cyan">⛽ Fuel Savings Formula</h3>
          <p className="text-sm text-slate-300">Avg fuel wasted = 0.2L per search</p>
          <p className="text-sm text-slate-300">Cars Guided × 0.2L = Fuel Saved</p>
          <p className="mt-2 font-mono text-xl text-brand-cyan">{stats.carsGuided} × 0.2 = {formulaFuel}L</p>
        </div>

        <div className="panel-frame">
          <h3 className="mb-2 font-orbitron text-lg text-brand-cyan">🌿 CO₂ Reduction Formula</h3>
          <p className="text-sm text-slate-300">1 liter petrol = 2.31 kg CO₂</p>
          <p className="text-sm text-slate-300">Fuel Saved × 2.31 = CO₂ Reduced</p>
          <p className="mt-2 font-mono text-xl text-brand-cyan">{formulaFuel} × 2.31 = {formulaCo2} kg</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="panel-frame text-sm text-slate-200">🌳 {formulaCo2} kg CO₂ = {(formulaCo2 / 21.7).toFixed(1)} trees absorbing carbon for a year</div>
        <div className="panel-frame text-sm text-slate-200">👨‍👩‍👧‍👦 {(stats.timeSaved / 60).toFixed(1)} hours saved = Each driver got back 13 mins with family</div>
        <div className="panel-frame text-sm text-slate-200">💰 {formulaFuel} liters = ₹{rupeesSaved.toLocaleString('en-IN')} saved across the city</div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="panel-frame xl:col-span-2">
          <h3 className="mb-2 font-orbitron text-lg text-brand-cyan">Monthly Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF88" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#00FF88" stopOpacity={0.06} />
                  </linearGradient>
                  <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00E5FF" stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="co2" stroke="#00E5FF" fill="url(#co2Grad)" />
                <Area type="monotone" dataKey="fuel" stroke="#00FF88" fill="url(#fuelGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel-frame flex flex-col items-center justify-center">
          <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Environmental Score</h3>
          <div className="relative flex items-center justify-center">
            <ProgressRing percent={87} size={160} strokeWidth={12} color="#00FF88" />
            <div className="absolute text-center">
              <p className="font-mono text-3xl text-brand-green">87</p>
              <p className="text-xs text-slate-400">/100</p>
            </div>
          </div>
          <span className="mt-3 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-xs text-brand-green">EXCELLENT</span>
          <p className="mt-2 text-xs text-slate-400">Emission ✓ | Fuel ✓ | Time ✓</p>

          <button
            type="button"
            onClick={() => {
              addToast({ type: 'warning', title: 'Generating report...', message: `Facility ${facilityId.slice(0, 8)}...` })
              setTimeout(() => {
                addToast({ type: 'success', title: 'Report ready!', message: 'Environmental score 87/100.' })
              }, 1300)
            }}
            className="mt-5 rounded-lg border border-brand-amber/40 bg-brand-amber/10 px-4 py-2 text-sm text-brand-amber"
          >
            📄 Generate Impact Report
          </button>
        </div>
      </div>
    </div>
  )
}
