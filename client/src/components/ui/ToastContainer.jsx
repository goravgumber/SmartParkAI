import { useEffect } from 'react'
import Toast from './Toast'

export default function ToastContainer({ toasts, onRemove }) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        onRemove(toast.id)
      }, 4000)
    )

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [toasts, onRemove])

  return (
    <div className="fixed right-4 top-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}
