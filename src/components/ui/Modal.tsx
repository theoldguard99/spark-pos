import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maxWidthClassName?: string
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClassName = 'max-w-2xl',
}: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-y-auto ${maxWidthClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
            <div>
              {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
              {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="p-6">{children}</div>

        {footer && <div className="px-6 py-4 border-t border-slate-200 flex justify-end">{footer}</div>}
      </div>
    </div>
  )
}
