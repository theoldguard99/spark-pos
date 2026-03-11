import type { ReactNode } from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
  className?: string
  optionClassName?: string
  activeClassName?: string
  inactiveClassName?: string
}

export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  optionClassName,
  activeClassName,
  inactiveClassName,
}: SegmentedControlProps<T>) {
  return (
    <div className={cx('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
              isActive
                ? activeClassName ?? 'bg-indigo-600 border-indigo-600 text-white'
                : inactiveClassName ?? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              optionClassName,
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
