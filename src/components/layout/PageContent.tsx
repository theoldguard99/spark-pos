import type { ReactNode } from 'react'

const PAGE_CONTENT_WIDTH_CLASS = 'max-w-7xl'

export default function PageContent({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`${PAGE_CONTENT_WIDTH_CLASS} mx-auto px-6 py-6 ${className}`.trim()}>
      {children}
    </div>
  )
}
