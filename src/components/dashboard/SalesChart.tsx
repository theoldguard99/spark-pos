import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { useWeeklySales } from '../../hooks/useDashboard'

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 border border-indigo-100 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-indigo-600">Revenue: {formatCurrency(payload[0]?.value ?? 0)}</p>
        <p className="text-slate-500">Orders: {payload[1]?.value ?? 0}</p>
      </div>
    )
  }
  return null
}

export default function SalesChart() {
  const { data, isLoading } = useWeeklySales()

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-sm p-5 shadow-md shadow-slate-200/60 border border-white">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-800">Sales Overview</h3>
          <p className="text-xs text-slate-400 mt-0.5">Revenue for the last 7 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" /> Revenue
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-1 rounded-sm bg-emerald-500" /> Orders
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="revenue"
              tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="orders"
              orientation="right"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="revenue" dataKey="revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Line
              yAxisId="orders"
              type="monotone"
              dataKey="orders"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
