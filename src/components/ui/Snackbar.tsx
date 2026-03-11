import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react'

export type SnackbarVariant = 'success' | 'error' | 'warning'

export interface SnackbarItem {
  id: number
  variant: SnackbarVariant
  message: string
  durationMs: number
}

interface SnackbarProps {
  item: SnackbarItem
  onDismiss: (id: number) => void
}

export default function Snackbar({ item, onDismiss }: SnackbarProps) {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const start = window.setTimeout(() => setRunning(true), 30)
    const timer = window.setTimeout(() => onDismiss(item.id), item.durationMs)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(timer)
    }
  }, [item.durationMs, item.id, onDismiss])

  const isSuccess = item.variant === 'success'
  const isWarning = item.variant === 'warning'

  const icon = isSuccess
    ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" />
    : isWarning
      ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
      : <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-700" />

  const containerClass = isSuccess
    ? 'border-emerald-200 bg-emerald-50'
    : isWarning
      ? 'border-amber-200 bg-amber-50'
      : 'border-red-200 bg-red-50'

  const textClass = isSuccess
    ? 'text-emerald-900'
    : isWarning
      ? 'text-amber-900'
      : 'text-red-900'

  const barClass = isSuccess
    ? 'bg-emerald-500'
    : isWarning
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className={`overflow-hidden rounded-xl border shadow-lg ${containerClass}`}>
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        {icon}
        <p className={`text-sm flex-1 ${textClass}`}>{item.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="rounded-md p-0.5 text-slate-400 hover:bg-white/70 hover:text-slate-700"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-1 w-full bg-white/70">
        <div
          className={`h-full transition-[width] ease-linear ${barClass}`}
          style={{
            width: running ? '0%' : '100%',
            transitionDuration: `${item.durationMs}ms`,
          }}
        />
      </div>
    </div>
  )
}
