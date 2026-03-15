import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import { connectSocket, socket } from '../lib/socket'
import ToastContainer from '../components/ui/ToastContainer'
import SimulationPanel from '../components/SimulationPanel'

const zoneTabs = [
  { id: 'ALL', label: 'All' },
  { id: 'A', label: 'Zone A' },
  { id: 'B', label: 'Zone B' },
  { id: 'C', label: 'Zone C' },
  { id: 'VIP', label: 'VIP' },
  { id: 'H', label: 'Handicap' }
]

const statusTabs = [
  { id: 'ALL', label: 'All' },
  { id: 'AVAILABLE', label: '🟢 Available' },
  { id: 'OCCUPIED', label: '🔴 Occupied' },
  { id: 'RESERVED', label: '🟡 Reserved' }
]

const zoneOrder = ['A', 'B', 'C', 'VIP', 'H']

function toZoneCode(zone) {
  return zone?.code || zone?.name?.replace('Zone ', '') || ''
}

function calcPricing(ratePerHour, duration) {
  const base = ratePerHour * duration
  const serviceFee = base * 0.1
  const gst = (base + serviceFee) * 0.18
  const total = base + serviceFee + gst
  return {
    base,
    serviceFee,
    gst,
    total
  }
}

function fakeQrGrid() {
  return Array.from({ length: 36 }, (_, idx) => ({
    id: idx,
    filled: Math.random() > 0.45
  }))
}

function ReserveModal({ slot, onClose, onReserved, addToast }) {
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicleType, setVehicleType] = useState('Car')
  const [durationHours, setDurationHours] = useState(3)
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [loading, setLoading] = useState(false)
  const [successData, setSuccessData] = useState(null)

  const price = calcPricing(slot.zone.ratePerHour, durationHours)
  const qrCells = useMemo(() => fakeQrGrid(), [successData])

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)

    try {
      const requestBody = {
        slotId: slot.id,
        vehicleNumber,
        driverName,
        driverPhone: `+91${driverPhone}`,
        durationHours,
        paymentMethod,
        startTime: new Date().toISOString(),
        vehicleType
      }

      const minDelay = new Promise((resolve) => setTimeout(resolve, 2000))
      const call = api.post('/reservations', requestBody)
      const [response] = await Promise.all([call, minDelay])

      const reservation = response.data.data
      setSuccessData({
        slotCode: slot.slotCode,
        reservationCode: reservation.reservationCode
      })

      onReserved(slot.id)
      addToast({ type: 'success', title: 'Reservation confirmed', message: `${reservation.reservationCode} created.` })
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Reservation failed',
        message: error?.response?.data?.error || 'Could not reserve this slot.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel-frame relative w-full max-w-md border-brand-cyan/30">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md border border-brand-cyan/25 px-2 py-1 text-slate-300 hover:text-brand-cyan"
        >
          ✕
        </button>

        {!successData ? (
          <>
            <div className="mb-4">
              <h3 className="font-orbitron text-2xl text-brand-cyan">Reserve Parking Slot</h3>
              <div className="mt-2 inline-flex rounded-md border border-brand-cyan/40 bg-brand-cyan/10 px-2 py-1 font-mono text-sm text-brand-cyan">
                {slot.slotCode}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-brand-cyan/40 bg-brand-cyan/10 px-2 py-1 text-brand-cyan">{slot.zone.name}</span>
              <span className="rounded-md border border-dark-border px-2 py-1 text-slate-300">Floor G</span>
              <span className="rounded-md border border-dark-border px-2 py-1 text-slate-300">₹{slot.zone.ratePerHour}/hr</span>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                type="text"
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
                placeholder="Driver Name"
                required
                className="w-full rounded-xl border border-dark-border bg-dark-surface px-3 py-2.5 text-sm outline-none focus:border-brand-cyan"
              />

              <div className="flex items-center rounded-xl border border-dark-border bg-dark-surface px-3">
                <span className="font-mono text-sm text-slate-400">+91</span>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Phone Number"
                  required
                  className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
                />
              </div>

              <input
                type="text"
                value={vehicleNumber}
                onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())}
                placeholder="MH 02 AB 1234"
                required
                className="w-full rounded-xl border border-dark-border bg-dark-surface px-3 py-2.5 text-sm uppercase outline-none focus:border-brand-cyan"
              />

              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">Vehicle Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Car', 'Bike', 'SUV'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setVehicleType(type)}
                      className={`rounded-lg border px-2 py-2 text-sm transition ${
                        vehicleType === type
                          ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan glow-cyan'
                          : 'border-dark-border bg-dark-surface text-slate-300'
                      }`}
                    >
                      {type === 'Car' ? '🚗' : type === 'Bike' ? '🏍️' : '🚐'} {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Duration</span>
                  <span className="font-mono text-brand-cyan">{durationHours}h</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={durationHours}
                  onChange={(event) => setDurationHours(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-dark-border accent-brand-cyan"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  {[1, 2, 4, 6, 8].map((v) => (
                    <span key={v}>{v}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-brand-cyan/20 bg-dark-surface/70 p-3 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Base Rate</span>
                  <span className="font-mono">₹{slot.zone.ratePerHour} × {durationHours}h = ₹{price.base.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-300">
                  <span>Service Fee</span>
                  <span className="font-mono">₹{price.serviceFee.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-300">
                  <span>GST (18%)</span>
                  <span className="font-mono">₹{price.gst.toFixed(2)}</span>
                </div>
                <div className="my-2 border-t border-dark-border" />
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Total</span>
                  <span className="font-mono text-2xl text-brand-cyan">₹{price.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['UPI', 'CARD', 'CASH'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-lg border px-2 py-2 text-sm transition ${
                      paymentMethod === method
                        ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan glow-cyan'
                        : 'border-dark-border bg-dark-surface text-slate-300'
                    }`}
                  >
                    {method === 'UPI' ? '📱' : method === 'CARD' ? '💳' : '💵'} {method}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-violet px-4 py-3 font-semibold text-dark-base transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm & Pay ₹{price.total.toFixed(2)}
              </button>
            </form>
          </>
        ) : (
          <div className="animate-fade-in py-2 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand-green text-3xl text-brand-green shadow-[0_0_20px_rgba(0,255,136,0.35)]">
              ✓
            </div>
            <h4 className="font-orbitron text-2xl text-brand-green">Booking Confirmed! 🎉</h4>
            <p className="mt-2 text-sm text-slate-300">Slot {successData.slotCode} • {successData.reservationCode}</p>
            <p className="mt-1 text-xs text-slate-400">QR code ready</p>

            <div className="mx-auto mt-3 grid w-28 grid-cols-6 gap-1 rounded-lg bg-white p-2">
              {qrCells.map((cell) => (
                <div key={cell.id} className={`h-3 w-3 ${cell.filled ? 'bg-black' : 'bg-white'}`} />
              ))}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0">
              {Array.from({ length: 20 }, (_, idx) => (
                <span
                  key={idx}
                  className="absolute h-2 w-1 rounded-sm bg-brand-green/80"
                  style={{
                    left: `${10 + idx * 4}%`,
                    animation: `confettiUp ${0.8 + Math.random() * 0.8}s ease-out forwards`,
                    animationDelay: `${Math.random() * 0.35}s`
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg border border-brand-green/40 bg-brand-green/10 px-5 py-2 text-sm text-brand-green"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MapOverviewPage() {
  const [facilityId, setFacilityId] = useState('')
  const [slots, setSlots] = useState([])
  const [summary, setSummary] = useState({ total: 0, available: 0, occupied: 0, reserved: 0 })
  const [loading, setLoading] = useState(true)
  const [zoneFilter, setZoneFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now())
  const [elapsedSec, setElapsedSec] = useState(0)
  const [flashSlotId, setFlashSlotId] = useState('')
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const refreshSummary = useCallback(async (id) => {
    const response = await api.get(`/parking/summary/${id}`)
    const data = response.data.data
    setSummary({
      total: data.total,
      available: data.available,
      occupied: data.occupied,
      reserved: data.reserved
    })
    setLastUpdatedAt(Date.now())
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const facilitiesResponse = await api.get('/parking/facilities')
      const facilities = facilitiesResponse.data.data
      const facility = facilities[0]
      if (!facility) {
        setLoading(false)
        return
      }

      setFacilityId(facility.id)

      const [slotsResponse] = await Promise.all([api.get(`/parking/facilities/${facility.id}/slots`), refreshSummary(facility.id)])
      setSlots(slotsResponse.data.data)
      setLastUpdatedAt(Date.now())
    } catch (error) {
      addToast({ type: 'error', title: 'Map load failed', message: error?.response?.data?.error || 'Try refreshing data.' })
    } finally {
      setLoading(false)
    }
  }, [addToast, refreshSummary])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!facilityId) return
    connectSocket()
    socket.emit('join:facility', facilityId)
    console.log('[Map] Emitted join:facility', facilityId)
  }, [facilityId])

  useEffect(() => {
    if (!autoRefresh || !facilityId) return undefined
    const id = setInterval(() => {
      refreshSummary(facilityId).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [facilityId, autoRefresh, refreshSummary])

 // Polling fallback — refresh slots every 3 seconds from API
  useEffect(() => {
    if (!facilityId) return
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/parking/facilities/${facilityId}/slots`)
        setSlots(res.data.data)
      } catch (e) {}
    }, 3000)
    return () => clearInterval(interval)
  }, [facilityId])

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - lastUpdatedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdatedAt])

  useEffect(() => {
    const handleSlotUpdate = (data) => {
      console.log('[Socket] slot:updated:', data)

      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.slotCode === data.slotCode) {
            return {
              ...slot,
              status: data.status.toUpperCase()
            }
          }
          return slot
        })
      )

      if (data.slotId) {
        setFlashSlotId(data.slotId)
        setTimeout(() => setFlashSlotId(''), 340)
      }
      setLastUpdatedAt(Date.now())
    }

    socket.on('slot:updated', handleSlotUpdate)
    return () => socket.off('slot:updated', handleSlotUpdate)
  }, [])

  useEffect(() => {
    const handleOccupancy = (data) => {
      console.log('[Socket] occupancy:live:', data)
      setSummary({
        available: data.available,
        occupied: data.occupied,
        reserved: data.reserved,
        total: data.total
      })
      setLastUpdatedAt(Date.now())
    }

    socket.on('occupancy:live', handleOccupancy)
    return () => socket.off('occupancy:live', handleOccupancy)
  }, [])

  useEffect(() => {
    console.log('[Map] rendering slots:', slots.map((s) => `${s.code || s.slotCode}=${s.status}`))
  }, [slots])

  const filtered = useMemo(() => {
    return slots.filter((slot) => {
      const code = toZoneCode(slot.zone)
      const zoneOk = zoneFilter === 'ALL' || code === zoneFilter
      const statusOk = statusFilter === 'ALL' || slot.status === statusFilter
      return zoneOk && statusOk
    })
  }, [slots, zoneFilter, statusFilter])

  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach((slot) => {
      const code = toZoneCode(slot.zone)
      if (!map.has(code)) map.set(code, [])
      map.get(code).push(slot)
    })
    return zoneOrder.map((code) => ({
      code,
      slots: (map.get(code) || []).sort((a, b) => a.slotCode.localeCompare(b.slotCode))
    }))
  }, [filtered])

  function getSlotClass(status, isFlashing) {
    const base = 'relative aspect-square rounded-lg border transition-all duration-300'
    const flash = isFlashing ? ' slot-flash' : ''

    if (status === 'AVAILABLE') {
      return `${base} cursor-pointer border-brand-green/40 bg-brand-green/10 hover:scale-105 hover:border-brand-green hover:glow-green${flash}`
    }
    if (status === 'OCCUPIED') {
      return `${base} cursor-default border-brand-red/40 bg-brand-red/10${flash}`
    }
    if (status === 'RESERVED') {
      return `${base} cursor-default border-brand-amber/40 bg-brand-amber/10${flash}`
    }
    return `${base} cursor-not-allowed border-dark-border/30 bg-dark-border/20${flash}`
  }

  function statCard(title, value, color, trend) {
    return (
      <div className="glass-card p-4">
        <p className={`font-mono text-3xl ${color}`}>{value}</p>
        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
          <span>{title}</span>
          <span>{trend}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="z-20 lg:absolute lg:right-0 lg:top-0">
        <SimulationPanel facilityId={facilityId} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCard('Total Slots', summary.total, 'text-white', '↔')}
        {statCard('Available', summary.available, 'text-brand-green animate-pulse-glow', '↑')}
        {statCard('Occupied', summary.occupied, 'text-brand-red', '↑')}
        {statCard('Reserved', summary.reserved, 'text-brand-amber', '→')}
      </div>

      <div className="panel-frame flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {zoneTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setZoneFilter(tab.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                zoneFilter === tab.id
                  ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan'
                  : 'border-dark-border bg-dark-surface text-slate-300 hover:border-brand-cyan/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                statusFilter === tab.id
                  ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan'
                  : 'border-dark-border bg-dark-surface text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              autoRefresh
                ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                : 'border-dark-border bg-dark-surface text-slate-300'
            }`}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={loadData}
            className="rounded-full border border-brand-cyan/40 bg-brand-cyan/10 p-1.5 text-brand-cyan"
            aria-label="refresh"
          >
            <RefreshCw size={14} />
          </button>

          <span className="font-mono text-xs text-slate-400">Updated {elapsedSec}s ago</span>
        </div>
      </div>

      <div className="panel-frame">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-2 text-brand-cyan">
            <Loader2 className="animate-spin" size={18} /> Loading parking map...
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => {
              if (!group.slots.length) return null

              const zoneName = group.code === 'H' ? 'HANDICAP' : group.code === 'VIP' ? 'VIP' : `ZONE ${group.code}`
              const available = group.slots.filter((slot) => slot.status === 'AVAILABLE').length

              return (
                <section key={group.code}>
                  <p className="mb-2 text-xs tracking-wide text-brand-cyan/70">
                    ━━ {zoneName} — {group.slots.length} Slots ({available} available) ━━
                  </p>
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                    {group.slots.map((slot) => {
                      const isFlash = flashSlotId === slot.id
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => slot.status === 'AVAILABLE' && setSelectedSlot(slot)}
                          className={getSlotClass(slot.status, isFlash)}
                        >
                          <div
                            className={`mt-2 text-center font-mono text-xs ${
                              slot.status === 'AVAILABLE'
                                ? 'text-brand-green'
                                : slot.status === 'OCCUPIED'
                                  ? 'text-brand-red'
                                  : slot.status === 'RESERVED'
                                    ? 'text-brand-amber'
                                    : 'text-slate-500'
                            }`}
                          >
                            {slot.slotCode}
                          </div>

                          {slot.status === 'OCCUPIED' ? <div className="mt-1 text-center text-[10px]">🚗</div> : null}

                          {slot.status === 'RESERVED' ? (
                            <span className="absolute right-1 top-1 rounded bg-brand-amber/25 px-1 text-[10px] text-brand-amber">R</span>
                          ) : null}

                          {slot.status === 'DISABLED' ? (
                            <span className="absolute inset-0 flex items-center justify-center text-lg text-slate-500">✕</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {selectedSlot ? (
        <ReserveModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onReserved={(slotId) => {
            setSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, status: 'RESERVED' } : slot)))
            refreshSummary(facilityId).catch(() => {})
          }}
          addToast={addToast}
        />
      ) : null}
    </div>
  )
}
