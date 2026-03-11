import { ChevronDown } from 'lucide-react'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  className?: string
}

export default function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className="w-full py-2.5 pl-4 pr-12 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-slate-700"
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        aria-hidden
      />
    </div>
  )
}
