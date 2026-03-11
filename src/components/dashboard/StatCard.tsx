import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  trend?: {
    value: string
    positive: boolean
  }
  loading?: boolean
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white/85 backdrop-blur-sm p-5 shadow-md shadow-slate-200/60 border border-white animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-sm p-5 shadow-md shadow-slate-200/60 border border-white hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className={`text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {trend.positive ? '▲' : '▼'} {trend.value}
          </span>
          <span className="text-xs text-slate-400">vs yesterday</span>
        </div>
      )}
    </div>
  )
}
