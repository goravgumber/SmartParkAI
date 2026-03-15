import { Fragment, useEffect, useMemo, useState } from 'react'
import ToastContainer from '../components/ui/ToastContainer'
import { api } from '../services/api'

const tabs = ['Devices', 'Parking Config', 'Users', 'System Health', 'Settings']

function DeviceDot({ status }) {
  const color = status === 'ONLINE' ? 'bg-brand-green' : status === 'OFFLINE' ? 'bg-brand-red' : 'bg-brand-amber'
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-70`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  )
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('Devices')
  const [devices, setDevices] = useState([])
  const [expandedDevice, setExpandedDevice] = useState('')
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [toasts, setToasts] = useState([])
  const [health, setHealth] = useState({ api: 142, db: 28, cache: 94.2, mqtt: 340 })

  useEffect(() => {
    if (activeTab !== 'Devices') return
    api.get('/devices').then((res) => setDevices(res.data.data)).catch(() => {})
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'System Health') return
    const id = setInterval(() => {
      setHealth((prev) => ({
        api: Math.max(90, Math.round(prev.api * (0.97 + Math.random() * 0.08))),
        db: Math.max(20, Math.round(prev.db * (0.95 + Math.random() * 0.1))),
        cache: Number(Math.max(80, Math.min(99.9, prev.cache * (0.99 + Math.random() * 0.02))).toFixed(1)),
        mqtt: Math.max(180, Math.round(prev.mqtt * (0.95 + Math.random() * 0.1)))
      }))
    }, 3000)
    return () => clearInterval(id)
  }, [activeTab])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))
  const addToast = (toast) => setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])

  const mockLogs = useMemo(() => ['Heartbeat received', 'CPU sample captured', 'Memory stable', 'Ping acknowledged', 'Thresholds normal'], [])

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="panel-frame">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${activeTab === tab ? 'border-brand-cyan bg-brand-cyan/20 text-brand-cyan' : 'border-dark-border bg-dark-surface text-slate-300'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Devices' ? (
        <div className="panel-frame">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-orbitron text-lg text-brand-cyan">Devices</h3>
            <button type="button" onClick={() => setShowAddDevice(true)} className="rounded-lg bg-brand-cyan/20 px-3 py-1.5 text-sm text-brand-cyan">Add Device</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-xs text-slate-400"><tr><th>Device ID</th><th>Location</th><th>Zone</th><th>Status</th><th>CPU%</th><th>RAM%</th><th>Temp</th><th>Last Ping</th><th>Actions</th></tr></thead>
              <tbody>
                {devices.map((d) => (
                  <Fragment key={d.id}>
                    <tr className="cursor-pointer border-t border-dark-border/70" onClick={() => setExpandedDevice((prev) => (prev === d.id ? '' : d.id))}>
                      <td className="py-2 font-mono text-brand-cyan">{d.deviceCode}</td>
                      <td className="py-2">Facility</td>
                      <td className="py-2">{d.zone}</td>
                      <td className="py-2"><span className="inline-flex items-center gap-2"><DeviceDot status={d.status} />{d.status}</span></td>
                      <td className={`py-2 font-mono ${d.cpuPercent >= 78 ? 'text-brand-red' : ''}`}>{d.cpuPercent}%</td>
                      <td className="py-2 font-mono">{d.ramPercent}%</td>
                      <td className={`py-2 font-mono ${d.temperature >= 71 ? 'text-brand-amber' : ''}`}>{d.temperature}°C</td>
                      <td className="py-2 text-xs text-slate-400">{new Date(d.lastPingAt).toLocaleTimeString()}</td>
                      <td className="py-2"><button className="rounded border border-brand-cyan/40 px-2 py-1 text-xs">Inspect</button></td>
                    </tr>
                    {expandedDevice === d.id ? (
                      <tr className="border-t border-dark-border/60">
                        <td colSpan="9" className="bg-dark-surface/40 px-3 py-2 text-xs text-slate-300">{mockLogs.map((log) => <p key={`${d.id}-${log}`}>• {log}</p>)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'System Health' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="panel-frame"><p className="text-xs text-slate-400">API Latency</p><p className="font-mono text-2xl text-brand-green">{health.api}ms</p></div>
            <div className="panel-frame"><p className="text-xs text-slate-400">DB Query Time</p><p className="font-mono text-2xl text-brand-green">{health.db}ms</p></div>
            <div className="panel-frame"><p className="text-xs text-slate-400">Cache Hit Rate</p><p className="font-mono text-2xl">{health.cache}%</p></div>
            <div className="panel-frame"><p className="text-xs text-slate-400">MQTT Messages</p><p className="font-mono text-2xl">{health.mqtt}/min</p></div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              'REST API: ✅ 99.98%',
              'WebSocket: ✅ 99.99%',
              'MQTT: ✅ 99.95%',
              'Database: ✅ 99.99%',
              'Redis: ✅ 100%',
              'Analytics: ⚠️ 98.2%'
            ].map((service) => (
              <div key={service} className="glass-card px-4 py-3 text-sm text-slate-200">{service}</div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'Settings' ? (
        <div className="panel-frame space-y-5">
          <section>
            <h4 className="mb-2 font-orbitron text-base text-brand-cyan">General</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Facility name" defaultValue="Phoenix Palladium Mall" />
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="City" defaultValue="Mumbai" />
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Timezone" defaultValue="Asia/Kolkata" />
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Currency" defaultValue="INR" />
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-orbitron text-base text-brand-cyan">Pricing</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Base rate" defaultValue="20" />
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Peak multiplier" defaultValue="1.75" />
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Grace period" defaultValue="10" />
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-orbitron text-base text-brand-cyan">Notifications</h4>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Email" defaultValue="ops@smartpark.ai" />
              <input className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Webhook URL" defaultValue="https://hooks.example.com/smartpark" />
            </div>
          </section>

          <button
            type="button"
            onClick={() => addToast({ type: 'success', title: 'Settings saved', message: 'Configuration updated.' })}
            className="rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet px-4 py-2 text-sm font-semibold text-dark-base"
          >
            Save Settings
          </button>
        </div>
      ) : null}

      {activeTab === 'Parking Config' ? <div className="panel-frame">Parking Config module placeholder</div> : null}
      {activeTab === 'Users' ? <div className="panel-frame">Users module placeholder</div> : null}

      {showAddDevice ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="panel-frame w-full max-w-md">
            <h3 className="mb-3 font-orbitron text-lg text-brand-cyan">Add Device</h3>
            <div className="space-y-2">
              <input className="w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Device ID" />
              <input className="w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="Zone" />
              <input className="w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2" placeholder="IP Address" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddDevice(false)} className="rounded border border-dark-border px-3 py-1.5 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setShowAddDevice(false)
                  addToast({ type: 'success', title: 'Device added', message: 'New edge device registered.' })
                }}
                className="rounded bg-brand-cyan/20 px-3 py-1.5 text-sm text-brand-cyan"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
