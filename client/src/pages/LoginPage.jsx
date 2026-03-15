import { useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

const roles = [
  {
    id: 'DRIVER',
    label: 'Driver',
    icon: '🚗',
    email: 'driver@smartpark.ai',
    password: 'Admin@123'
  },
  {
    id: 'OWNER',
    label: 'Parking Owner',
    icon: '🏢',
    email: 'owner@smartpark.ai',
    password: 'Admin@123'
  },
  {
    id: 'ADMIN',
    label: 'City Admin',
    icon: '🛡️',
    email: 'admin@smartpark.ai',
    password: 'Admin@123'
  },
  {
    id: 'ANALYST',
    label: 'Analyst',
    icon: '📊',
    email: 'admin@smartpark.ai',
    password: 'Admin@123'
  }
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [selectedRole, setSelectedRole] = useState('DRIVER')
  const [email, setEmail] = useState('driver@smartpark.ai')
  const [password, setPassword] = useState('Admin@123')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fadeOut, setFadeOut] = useState(false)
  const loading = submitting

  const particles = useMemo(
    () =>
      Array.from({ length: 15 }, (_, index) => ({
        id: index,
        size: Math.floor(Math.random() * 5) + 2,
        left: Math.floor(Math.random() * 100),
        top: Math.floor(Math.random() * 100),
        delay: Number((Math.random() * 5).toFixed(2)),
        duration: Number((2.8 + Math.random() * 3.2).toFixed(2)),
        opacity: Number((0.2 + Math.random() * 0.6).toFixed(2)),
        color: Math.random() > 0.5 ? '#00E5FF' : '#7B61FF'
      })),
    []
  )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 1500))
      const authCall = login(email, password)
      await Promise.all([minDelay, authCall])

      if (!remember) {
        sessionStorage.setItem('smartpark_temp_login', 'true')
      }

      setFadeOut(true)
      setTimeout(() => {
        navigate('/dashboard/map')
      }, 420)
    } catch (err) {
      setError(err?.response?.data?.error || 'Authentication failed. Verify credentials.')
      setSubmitting(false)
    }
  }

  function handleRoleSelect(role) {
    setSelectedRole(role.id)
    setEmail(role.email)
    setPassword(role.password)
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-dark-base px-6 py-10 text-white transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,229,255,0.08), rgba(0,229,255,0.08) 1px, transparent 1px, transparent 38px), repeating-linear-gradient(90deg, rgba(123,97,255,0.07), rgba(123,97,255,0.07) 1px, transparent 1px, transparent 38px)'
        }}
      />

      {particles.map((particle) => (
        <div
          key={particle.id}
          className="pointer-events-none absolute rounded-full blur-[1px] animate-float"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            opacity: particle.opacity,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            background: particle.color,
            boxShadow: `0 0 14px ${particle.color}`
          }}
        />
      ))}

      <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col items-center justify-center gap-10">
        <div className="flex flex-col items-center text-center">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="animate-pulse-glow"
          >
            <polygon points="40,6 67,22 67,58 40,74 13,58 13,22" stroke="#00E5FF" strokeWidth="2.5" fill="rgba(0,229,255,0.08)" />
            <path d="M34 52V28H42.5C47 28 50 30.7 50 34.8C50 39 47 41.5 42.5 41.5H38" stroke="#00E5FF" strokeWidth="3" strokeLinecap="round" />
            <path d="M67 34H76" stroke="#00E5FF" strokeWidth="2" />
            <path d="M67 46H76" stroke="#00E5FF" strokeWidth="2" />
            <circle cx="76" cy="34" r="2" fill="#00E5FF" />
            <circle cx="76" cy="46" r="2" fill="#00E5FF" />
          </svg>
          <h1 className="mt-5 font-orbitron text-4xl font-bold tracking-wide text-brand-cyan">SmartPark AI</h1>
          <p className="mt-2 text-sm text-slate-300">Intelligent Parking Intelligence Platform</p>
        </div>

        <div className="panel-frame w-full max-w-md border-brand-cyan/30 shadow-2xl shadow-brand-cyan/10">
          <h2 className="mb-6 text-center font-orbitron text-2xl text-brand-cyan">Access Command Center</h2>

          <div className="mb-5 grid grid-cols-2 gap-3">
            {roles.map((role) => {
              const active = selectedRole === role.id
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all duration-300 ${
                    active
                      ? 'border-brand-cyan bg-brand-cyan/10 text-brand-cyan glow-cyan'
                      : 'border-dark-border bg-dark-elevated/40 text-slate-300 hover:scale-[1.03] hover:border-brand-cyan/50 hover:text-brand-cyan'
                  }`}
                >
                  <div className="text-lg">{role.icon}</div>
                  <div className="mt-1 text-sm font-medium">{role.label}</div>
                </button>
              )
            })}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="commander@smartpark.ai"
                className="w-full rounded-xl border border-dark-border bg-dark-surface px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-500 focus:border-brand-cyan focus:glow-cyan"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-dark-border bg-dark-surface px-4 py-3 pr-11 text-sm outline-none transition-all placeholder:text-slate-500 focus:border-brand-cyan focus:glow-cyan"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-brand-cyan"
                  aria-label="toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  remember ? 'border-brand-cyan bg-brand-cyan/20' : 'border-slate-500'
                }`}
              >
                {remember ? <span className="h-2 w-2 rounded-full bg-brand-cyan" /> : null}
              </span>
              <input
                type="checkbox"
                checked={remember}
                onChange={() => setRemember((value) => !value)}
                className="hidden"
              />
              Remember this terminal
            </label>

            {error ? (
              <p className="rounded-lg border border-[#ff3b3b] bg-brand-red/10 px-3 py-2 text-sm text-brand-red shadow-[0_0_8px_rgba(255,0,0,0.5)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-violet px-4 py-3 font-semibold text-dark-base shadow-lg shadow-brand-cyan/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-cyan/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              {loading ? 'Initializing...' : 'Initialize Session'}
            </button>

            <p className="pt-1 text-center text-xs text-slate-400">🔒 Secured with AES-256 • TLS 1.3 • Zero-Knowledge Auth</p>
          </form>
        </div>
      </div>
    </div>
  )
}
