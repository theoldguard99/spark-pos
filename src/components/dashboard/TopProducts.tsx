import { TrendingUp } from 'lucide-react'
import { useTopProducts } from '../../hooks/useDashboard'

function formatCurrency(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TopProducts() {
  const { data: products, isLoading } = useTopProducts()

  const maxQty = products?.[0]?.total_quantity ?? 1

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-sm p-5 shadow-md shadow-slate-200/60 border border-white">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-800">Top Products</h3>
          <p className="text-xs text-slate-400 mt-0.5">Best sellers by quantity</p>
        </div>
        <TrendingUp size={18} className="text-indigo-500" />
      </div>

      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex justify-between mb-1.5">
                  <div className="h-3.5 w-32 bg-slate-100 rounded" />
                  <div className="h-3.5 w-12 bg-slate-100 rounded" />
                </div>
                <div className="h-2 bg-slate-100 rounded-full" />
              </div>
            ))
          : products && products.length > 0
          ? products.map((product, index) => {
              const barWidth = Math.round((product.total_quantity / maxQty) * 100)
              const colors = [
                'bg-indigo-500',
                'bg-violet-500',
                'bg-sky-500',
                'bg-emerald-500',
                'bg-amber-500',
              ]
              return (
                <div key={product.product_id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700 truncate max-w-[140px]">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700">
                        {product.total_quantity} sold
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100/90 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${colors[index % colors.length]} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatCurrency(product.total_revenue)} revenue
                  </p>
                </div>
              )
            })
          : (
            <p className="text-sm text-slate-400 text-center py-4">No data available</p>
          )}
      </div>
    </div>
  )
}
