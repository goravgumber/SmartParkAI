import { useEffect, useMemo, useState } from 'react'
import ToastContainer from '../components/ui/ToastContainer'

const prefKey = 'smartpark_notification_prefs'
const rulesKey = 'smartpark_alert_rules'

const defaultPrefs = {
  email: true,
  push: true,
  slack: false,
  sms: true
}

const defaultRules = {
  occupancy: 80,
  offlineMinutes: 5,
  reportTime: '08:00'
}

function ChannelToggle({ icon, iconBg, title, subtitle, enabled, onToggle, actionLabel }) {
  return (
    <div className="glass-card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${iconBg}`}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`h-7 w-14 rounded-full p-1 transition ${enabled ? 'bg-brand-green/30' : 'bg-dark-border'}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-7' : 'translate-x-0'}`}
          />
        </button>
        <button type="button" className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 text-xs text-brand-cyan">
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const [prefs, setPrefs] = useState(defaultPrefs)
  const [rules, setRules] = useState(defaultRules)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const storedPrefs = localStorage.getItem(prefKey)
    const storedRules = localStorage.getItem(rulesKey)
    if (storedPrefs) setPrefs(JSON.parse(storedPrefs))
    if (storedRules) setRules(JSON.parse(storedRules))
  }, [])

  useEffect(() => {
    localStorage.setItem(prefKey, JSON.stringify(prefs))
  }, [prefs])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))
  const addToast = (toast) => setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }])

  const channels = useMemo(
    () => [
      {
        key: 'email',
        icon: '📧',
        iconBg: 'bg-blue-500/18 text-blue-200 ring-1 ring-blue-400/20',
        title: 'Email',
        subtitle: prefs.email ? 'ON — Via SendGrid' : 'OFF — Connect',
        actionLabel: prefs.email ? 'Connected' : 'Connect'
      },
      {
        key: 'push',
        icon: '🔔',
        iconBg: 'bg-amber-500/18 text-amber-200 ring-1 ring-amber-400/20',
        title: 'Push',
        subtitle: prefs.push ? 'ON — Browser Push' : 'OFF — Enable',
        actionLabel: 'Configure'
      },
      {
        key: 'slack',
        icon: '💬',
        iconBg: 'bg-violet-500/18 text-violet-200 ring-1 ring-violet-400/20',
        title: 'Slack',
        subtitle: prefs.slack ? 'ON — Connected Workspace' : 'OFF — Connect',
        actionLabel: prefs.slack ? 'Manage' : 'Connect'
      },
      {
        key: 'sms',
        icon: '📟',
        iconBg: 'bg-emerald-500/18 text-emerald-200 ring-1 ring-emerald-400/20',
        title: 'SMS',
        subtitle: prefs.sms ? 'ON — Via Twilio' : 'OFF — Connect',
        actionLabel: prefs.sms ? 'Linked' : 'Connect'
      }
    ],
    [prefs]
  )

  function saveRules() {
    localStorage.setItem(rulesKey, JSON.stringify(rules))
    addToast({ type: 'success', title: 'Rules saved', message: 'Alert rules updated successfully.' })
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="panel-frame">
        <h2 className="mb-4 font-orbitron text-xl text-brand-cyan">Notification Channels</h2>
        <div className="space-y-3">
          {channels.map((channel) => (
            <ChannelToggle
              key={channel.key}
              icon={channel.icon}
              iconBg={channel.iconBg}
              title={channel.title}
              subtitle={channel.subtitle}
              actionLabel={channel.actionLabel}
              enabled={prefs[channel.key]}
              onToggle={() => setPrefs((prev) => ({ ...prev, [channel.key]: !prev[channel.key] }))}
            />
          ))}
        </div>
      </div>

      <div className="panel-frame">
        <h3 className="mb-4 font-orbitron text-xl text-brand-cyan">Alert Rules</h3>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Notify when occupancy &gt;</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={rules.occupancy}
                onChange={(e) => setRules((prev) => ({ ...prev, occupancy: Number(e.target.value) || 0 }))}
                className="w-28 rounded-lg border border-dark-border bg-dark-surface px-3 py-2 font-mono"
              />
              <span className="text-slate-400">%</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Device offline &gt;</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="120"
                value={rules.offlineMinutes}
                onChange={(e) => setRules((prev) => ({ ...prev, offlineMinutes: Number(e.target.value) || 0 }))}
                className="w-28 rounded-lg border border-dark-border bg-dark-surface px-3 py-2 font-mono"
              />
              <span className="text-slate-400">min</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Daily report at</span>
            <input
              type="time"
              value={rules.reportTime}
              onChange={(e) => setRules((prev) => ({ ...prev, reportTime: e.target.value }))}
              className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2 font-mono"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={saveRules}
          className="mt-5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet px-4 py-2 text-sm font-semibold text-dark-base"
        >
          Save Rules
        </button>
      </div>
    </div>
  )
}
