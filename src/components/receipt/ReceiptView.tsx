import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from '../ui/Table'

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

export interface ReceiptData {
  orderId: string
  storeName: string
  date: string
  customerName: string
  items: ReceiptItem[]
  subtotal: number
  total: number
  paymentMethod: string
  amountReceived?: number
  change?: number
}

function formatCurrency(value: number) {
  return `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface ReceiptViewProps {
  data: ReceiptData
  className?: string
}

export function ReceiptView({ data, className = '' }: ReceiptViewProps) {
  const {
    orderId,
    storeName,
    date,
    customerName,
    items,
    subtotal,
    total,
    paymentMethod,
    amountReceived,
    change,
  } = data

  const formattedDate = new Date(date).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div
      className={`receipt-print bg-white text-black max-w-sm mx-auto ${className}`}
      style={{ width: 280 }}
    >
      <div className="p-4 space-y-3 text-sm">
        <div className="text-center border-b border-dashed border-slate-300 pb-3">
          <h2 className="font-bold text-base uppercase tracking-wide">{storeName}</h2>
          <p className="text-xs text-slate-600 mt-1">Official Receipt</p>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Order</span>
          <span className="font-mono">#{orderId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Date</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Customer</span>
          <span>{customerName || 'Walk-in'}</span>
        </div>

        <div className="border-t border-dashed border-slate-300 pt-3 mt-2">
          <Table className="text-xs">
            <TableHead>
              <TableHeaderRow className="bg-transparent border-slate-200">
                <TableHeaderCell className="px-0 py-1 font-semibold normal-case tracking-normal">Item</TableHeaderCell>
                <TableHeaderCell className="px-0 py-1 text-right font-semibold normal-case tracking-normal">Qty</TableHeaderCell>
                <TableHeaderCell className="px-0 py-1 text-right font-semibold normal-case tracking-normal">Price</TableHeaderCell>
                <TableHeaderCell className="px-0 py-1 text-right font-semibold normal-case tracking-normal">Amount</TableHeaderCell>
              </TableHeaderRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx} className="border-slate-100">
                  <TableCell className="px-0 py-1.5 pr-2">{item.name}</TableCell>
                  <TableCell className="px-0 py-1.5 text-right">{item.quantity}</TableCell>
                  <TableCell className="px-0 py-1.5 text-right">{formatCurrency(item.price)}</TableCell>
                  <TableCell className="px-0 py-1.5 text-right font-medium">
                    {formatCurrency(item.quantity * item.price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-dashed border-slate-300 pt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm pt-1">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-500">Payment</span>
            <span className="capitalize">{paymentMethod}</span>
          </div>
          {amountReceived != null && (
            <div className="flex justify-between">
              <span className="text-slate-500">Amount received</span>
              <span>{formatCurrency(amountReceived)}</span>
            </div>
          )}
          {change != null && change > 0 && (
            <div className="flex justify-between font-medium">
              <span>Change</span>
              <span>{formatCurrency(change)}</span>
            </div>
          )}
        </div>

        <div className="text-center pt-4 border-t border-dashed border-slate-300 text-xs text-slate-500">
          Thank you for your order!
        </div>
      </div>
    </div>
  )
}

interface ReceiptModalProps {
  data: ReceiptData
  onClose: () => void
  actions?: ReactNode
}

export function ReceiptModal({ data, onClose, actions }: ReceiptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none">
        <ReceiptView data={data} className="shadow-none" />
        <div className="flex items-center justify-center gap-3 p-4 border-t border-slate-100 print:hidden">
          {actions ?? (
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Print receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
