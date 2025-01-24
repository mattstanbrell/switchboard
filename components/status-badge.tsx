'use client'

import { cn } from '@/lib/utils'

export type Status = 'new' | 'open' | 'resolved' | 'closed'

interface Props {
  status: Status
}

const statusStyles = {
  new: {
    background: 'bg-[rgb(246,226,160)]',
    border: 'border-custom-accent-yellow',
    text: 'text-[rgb(122,92,1)]'
  },
  open: {
    background: 'bg-[rgb(255,202,187)]',
    border: 'border-custom-accent-red',
    text: 'text-custom-accent-red'
  },
  resolved: {
    background: 'bg-[rgb(221,226,178)]',
    border: 'border-[rgb(102,128,11)]',
    text: 'text-[rgb(82,102,9)]'
  },
  closed: {
    background: 'bg-[rgb(230,228,217)]',
    border: 'border-[rgb(111,110,105)]',
    text: 'text-[rgb(78,77,74)]'
  }
}

export function StatusBadge({ status }: Props) {
  const styles = statusStyles[status]

  return (
    <div className={cn(
      "border px-3 py-1 h-auto font-medium text-xs rounded-full w-[80px] flex items-center justify-center",
      styles.background,
      styles.border,
      styles.text,
      "transition-colors duration-200"
    )}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  )
} 