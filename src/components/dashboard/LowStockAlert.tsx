import { AlertTriangle, Package } from 'lucide-react'
import { useLowStockProducts } from '../../hooks/useDashboard'

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        Out of stock
      </span>
    )
  }
  if (stock <= 3) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
        Critical ({stock})
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      Low ({stock})
    </span>
  )
}

export default function LowStockAlert() {
  const { data: products, isLoading } = useLowStockProducts()

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-sm p-5 shadow-md shadow-slate-200/60 border border-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Low Stock Alerts</h3>
          <p className="text-xs text-slate-400 mt-0.5">Products below 10 units</p>
        </div>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50">
          <AlertTriangle size={18} className="text-amber-500" />
        </div>
      </div>

      <div className="space-y-2.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg" />
                <div>
                  <div className="h-3.5 w-28 bg-slate-100 rounded mb-1" />
                  <div className="h-3 w-16 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-5 w-16 bg-slate-100 rounded-full" />
            </div>
          ))
        ) : products && products.length > 0 ? (
          products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-amber-50/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
                  <Package size={14} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 leading-tight">{product.name}</p>
                  <p className="text-xs text-slate-400">{product.category}</p>
                </div>
              </div>
              <StockBadge stock={product.stock} />
            </div>
          ))
        ) : (
          <div className="text-center py-6">
            <Package size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">All products well-stocked</p>
          </div>
        )}
      </div>
    </div>
  )
}
