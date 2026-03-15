const toneMap = {
  success: 'border-brand-green/50 bg-brand-green/10 text-brand-green',
  error: 'border-brand-red/50 bg-brand-red/10 text-brand-red',
  warning: 'border-brand-amber/50 bg-brand-amber/10 text-brand-amber',
  info: 'border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan'
}

export default function Toast({ toast, onRemove }) {
  return (
    <div
      className={`glass-card w-80 animate-slide-up border px-4 py-3 shadow-lg ${toneMap[toast.type] || toneMap.info}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message ? <p className="mt-1 text-xs text-slate-200">{toast.message}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="rounded px-1 text-slate-300 hover:bg-white/10"
        >
          ×
        </button>
      </div>
    </div>
  )
}
