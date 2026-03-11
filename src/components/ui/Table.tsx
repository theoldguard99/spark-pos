import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function TableContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('overflow-x-auto', className)} {...props} />
}

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cx('w-full text-sm', className)} {...props} />
}

export function TableHead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx('border-b border-slate-50', className)} {...props} />
}

export function TableHeaderRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx('border-b border-slate-100 bg-slate-50/80', className)} {...props} />
}

export function TableHeaderCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx(
        'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('px-5 py-3 text-slate-700', className)} {...props} />
}

export function TableEmptyState({
  colSpan,
  children,
  className,
}: {
  colSpan: number
  children: string
  className?: string
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cx('py-10 text-center text-slate-400', className)}>
        {children}
      </TableCell>
    </TableRow>
  )
}
