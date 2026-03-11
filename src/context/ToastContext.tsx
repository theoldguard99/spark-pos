import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Snackbar, { type SnackbarItem, type SnackbarVariant } from '../components/ui/Snackbar'

type ToastType = SnackbarVariant

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void
  showSuccess: (message: string, durationMs?: number) => void
  showError: (message: string, durationMs?: number) => void
  showOops: (message?: string, durationMs?: number) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

function buildInformativeErrorMessage(message: string) {
  const text = message.trim()
  if (!text) {
    return {
      type: 'warning' as const,
      message: 'Oops. Something went wrong while processing your request. Please try again in a moment.',
    }
  }

  const lower = text.toLowerCase()

  if (lower.includes('something went wrong') || lower === 'error' || lower === 'unknown error') {
    return {
      type: 'warning' as const,
      message: 'Oops. Something went wrong while processing your request. Please try again in a moment.',
    }
  }

  const failedToMatch = text.match(/^failed to\s+(.+?)[.!]?$/i)
  if (failedToMatch) {
    const action = failedToMatch[1].trim().replace(/^the\s+/i, '')
    return {
      type: 'error' as const,
      message: `We couldn't ${action} right now. Please check your connection and try again.`,
    }
  }

  if (lower.includes('edge function failed') || lower.includes('non-2xx status code')) {
    return {
      type: 'error' as const,
      message: 'The server could not complete this request. Please try again in a few seconds.',
    }
  }

  if (lower.includes('network') || lower.includes('fetch')) {
    return {
      type: 'error' as const,
      message: 'Network connection issue detected. Please check your internet and try again.',
    }
  }

  return {
    type: 'error' as const,
    message: text,
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<SnackbarItem[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success', durationMs = 4200) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, variant: type, message, durationMs }])
  }, [])

  const showSuccess = useCallback((message: string, durationMs = 4200) => {
    showToast(message, 'success', durationMs)
  }, [showToast])

  const showError = useCallback((message: string, durationMs = 5200) => {
    const normalized = buildInformativeErrorMessage(message)
    showToast(normalized.message, normalized.type, durationMs)
  }, [showToast])

  const showOops = useCallback((message = 'Oops. Something went wrong while processing your request. Please try again in a moment.', durationMs = 5200) => {
    showToast(message, 'warning', durationMs)
  }, [showToast])

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    showSuccess,
    showError,
    showOops,
  }), [showToast, showSuccess, showError, showOops])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2.5 px-4">
        {toasts.map((toast) => (
          <Snackbar key={toast.id} item={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
