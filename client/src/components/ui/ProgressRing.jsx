import { useMemo } from 'react'

export default function ProgressRing({ percent = 0, size = 120, strokeWidth = 10, color = '#00E5FF' }) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const gradientId = useMemo(() => `ringGradient-${Math.random().toString(36).slice(2, 9)}`, [])

  return (
    <svg width={size} height={size} className="-rotate-90">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1000ms ease' }}
      />
    </svg>
  )
}
