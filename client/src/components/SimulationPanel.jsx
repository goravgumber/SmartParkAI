import { useEffect, useMemo, useState } from 'react'
import { Camera, Play, Square } from 'lucide-react'
import { socket } from '../lib/socket'
import { api } from '../services/api'
import ToastContainer from './ui/ToastContainer'

export default function SimulationPanel({ facilityId }) {
  const [status, setStatus] = useState({ isRunning: false, updatesCount: 0, uptimeSeconds: 0, lastPayloadAt: null, lastChangedCount: 0 })
  const [slotsChanged, setSlotsChanged] = useState(0)
  const [loadingAction, setLoadingAction] = useState('')
  const [toasts, setToasts] = useState([])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))
  const addToast = (toast) => setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])

  async function request(path, method = 'GET', body) {
    const response = await api.request({
      url: path,
      method,
      data: body
    })
    return response.data?.data
  }

  async function refreshStatus() {
    try {
      const data = await request('/simulation/status')
      setStatus(data)
    } catch (_error) {
      // Keep quiet for polling failures.
    }
  }

  useEffect(() => {
    if (!facilityId) return
    refreshStatus()
    const poll = setInterval(refreshStatus, 2000)
    return () => clearInterval(poll)
  }, [facilityId])

  useEffect(() => {
    function onLive(payload) {
      setSlotsChanged((prev) => prev + (payload?.changedCount || 0))
      setStatus((prev) => ({
        ...prev,
        updatesCount: typeof payload?.updatesCount === 'number' ? payload.updatesCount : prev.updatesCount,
        lastPayloadAt: payload?.timestamp || prev.lastPayloadAt,
        lastChangedCount: payload?.changedCount ?? prev.lastChangedCount
      }))
    }

    socket.on('occupancy:live', onLive)
    return () => socket.off('occupancy:live', onLive)
  }, [])

  async function startSimulation() {
    if (!facilityId) return
    setLoadingAction('start')
    try {
      const data = await request('/simulation/start', 'POST', {
        facilityId,
        intervalSeconds: 2
      })
      addToast({ type: 'success', title: data.message, message: 'Listening for live Raspberry Pi camera payloads.' })
      setSlotsChanged(0)
      refreshStatus()
    } catch (error) {
      addToast({ type: 'error', title: 'Could not start simulation', message: error.message })
    } finally {
      setLoadingAction('')
    }
  }

  async function stopSimulation() {
    setLoadingAction('stop')
    try {
      const data = await request('/simulation/stop', 'POST')
      addToast({ type: 'warning', title: data.message, message: 'Panel stopped tracking live Raspberry Pi updates.' })
      refreshStatus()
    } catch (error) {
      addToast({ type: 'error', title: 'Could not stop simulation', message: error.message })
    } finally {
      setLoadingAction('')
    }
  }

  const uptimeLabel = useMemo(() => {
    const sec = status.uptimeSeconds || 0
    const min = Math.floor(sec / 60)
    const rem = sec % 60
    return `${min}m ${String(rem).padStart(2, '0')}s`
  }, [status.uptimeSeconds])

  const lastUpdateLabel = useMemo(() => {
    if (!status.lastPayloadAt) return 'Waiting for Pi payload'

    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(status.lastPayloadAt).getTime()) / 1000))
    return `${diffSec}s ago`
  }, [status.lastPayloadAt, status.updatesCount])

  return (
    <div className="space-y-2">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div
        className={`glass-card w-full max-w-[340px] border p-4 shadow-xl transition-all duration-300 ${
          status.isRunning
            ? 'border-brand-cyan/50 bg-gradient-to-br from-brand-cyan/10 via-dark-surface/90 to-dark-surface/95 shadow-brand-cyan/20'
            : 'border-brand-cyan/20 bg-gradient-to-br from-white/5 via-dark-surface/90 to-dark-surface/95 shadow-brand-cyan/10'
        }`}
        style={status.isRunning ? { boxShadow: '0 0 0 1px rgba(0,229,255,0.18), 0 0 28px rgba(0,229,255,0.14)' } : undefined}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 p-2 text-brand-cyan">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="font-orbitron text-sm text-brand-cyan">Pi Camera System</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {status.isRunning ? 'Live Detection Active' : 'Camera Standby'}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] ${
              status.isRunning
                ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${status.isRunning ? 'bg-brand-green animate-pulse' : 'bg-slate-400'}`} />
            {status.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/10 px-3 py-3">
          <p className={`text-sm font-medium ${status.isRunning ? 'text-brand-green' : 'text-slate-300'}`}>
            {status.isRunning ? 'Live Detection Active' : 'Camera Standby'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {status.updatesCount || 0} payloads received, {status.lastChangedCount ?? slotsChanged} slot updates, uptime {uptimeLabel}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">Last Pi update: {lastUpdateLabel}</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={startSimulation}
            disabled={!facilityId || loadingAction !== '' || status.isRunning}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-green/30 bg-brand-green/15 px-4 py-2.5 text-sm text-brand-green transition hover:bg-brand-green/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={14} /> {status.isRunning ? 'Pi Camera Active' : 'Start'}
          </button>
          <button
            type="button"
            onClick={stopSimulation}
            disabled={loadingAction !== '' || !status.isRunning}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600/60 bg-slate-500/10 px-4 py-2.5 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square size={14} /> Stop
          </button>
        </div>
      </div>
    </div>
  )
}
