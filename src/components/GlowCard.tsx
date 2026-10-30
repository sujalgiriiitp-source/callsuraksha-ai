import type { ReactNode } from 'react'

export function GlowCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`glass-card p-6 ${className}`}>{children}</div>
}
