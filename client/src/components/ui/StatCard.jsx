import useCountUp from '../../hooks/useCountUp'

export default function StatCard({
  title,
  value = 0,
  unit = '',
  trend = 'up',
  trendValue = '',
  color = 'text-brand-cyan',
  icon = null,
  decimals = 0
}) {
  const counted = useCountUp(Number(value) || 0, 1200)
  const formatted = counted.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })

  return (
    <div className="panel-frame">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-300">{title}</p>
        {icon ? <span className="text-brand-cyan">{icon}</span> : null}
      </div>

      <div className={`font-mono text-3xl font-semibold ${color}`}>
        {formatted}
        {unit ? <span className="ml-1 text-lg font-medium">{unit}</span> : null}
      </div>

      <div className="mt-2 text-xs text-slate-400">
        <span className={trend === 'down' ? 'text-brand-red' : 'text-brand-green'}>{trend === 'down' ? '↓' : '↑'}</span>{' '}
        {trendValue}
      </div>
    </div>
  )
}
