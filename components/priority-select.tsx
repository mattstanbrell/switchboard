'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from '@/lib/utils'
import type { Ticket } from '@/components/human-agent/dashboard'

type Priority = 'Low' | 'Medium' | 'High'

interface Props {
  ticket: Pick<Ticket, 'id' | 'priority'>
}

const priorityStyles = {
  Low: {
    background: 'bg-[rgb(230,228,217)]',
    border: 'border-[rgb(111,110,105)]',
    hover: 'hover:bg-[rgb(230,228,217)]/90',
    ring: 'focus:ring-[rgb(111,110,105)]',
    text: 'text-[rgb(78,77,74)]'
  },
  Medium: {
    background: 'bg-[rgb(246,226,160)]',
    border: 'border-custom-accent-yellow',
    hover: 'hover:bg-[rgb(246,226,160)]/90',
    ring: 'focus:ring-custom-accent-yellow',
    text: 'text-[rgb(122,92,1)]'
  },
  High: {
    background: 'bg-[rgb(255,202,187)]',
    border: 'border-custom-accent-red',
    hover: 'hover:bg-[rgb(255,202,187)]/90',
    ring: 'focus:ring-custom-accent-red',
    text: 'text-custom-accent-red'
  }
}

export function PrioritySelect({ ticket }: Props) {
  const [priority, setPriority] = useState<Priority>(ticket.priority)
  const [isUpdating, setIsUpdating] = useState(false)

  const handlePriorityChange = async (newPriority: Priority) => {
    setIsUpdating(true)
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticket.id)

      if (error) throw error
      setPriority(newPriority)
    } catch (error) {
      console.error('Failed to update priority:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const styles = priorityStyles[priority]

  return (
    <Select
      value={priority}
      onValueChange={handlePriorityChange}
      disabled={isUpdating}
    >
      <SelectTrigger className={cn(
        "border px-3 py-1 h-auto font-medium text-xs rounded-full w-[70px] justify-center",
        styles.background,
        styles.border,
        styles.hover,
        styles.ring,
        styles.text,
        "transition-colors duration-200",
        "[&>svg]:hidden",
        {
          'opacity-50': isUpdating,
          'cursor-not-allowed': isUpdating
        }
      )}>
        {priority}
      </SelectTrigger>
      <SelectContent>
        <SelectItem 
          value="High"
          className={cn(
            "text-custom-text data-[highlighted]:text-custom-text cursor-pointer",
            "data-[state=checked]:bg-[rgb(255,202,187)] data-[state=checked]:text-custom-accent-red",
            "hover:bg-[rgb(255,202,187)] data-[highlighted]:bg-[rgb(255,202,187)]",
            "data-[highlighted]:text-custom-accent-red"
          )}
        >
          High
        </SelectItem>
        <SelectItem 
          value="Medium"
          className={cn(
            "text-custom-text data-[highlighted]:text-custom-text cursor-pointer",
            "data-[state=checked]:bg-[rgb(246,226,160)] data-[state=checked]:text-[rgb(122,92,1)]",
            "hover:bg-[rgb(246,226,160)] data-[highlighted]:bg-[rgb(246,226,160)]",
            "data-[highlighted]:text-[rgb(122,92,1)]"
          )}
        >
          Medium
        </SelectItem>
        <SelectItem 
          value="Low"
          className={cn(
            "text-custom-text data-[highlighted]:text-custom-text cursor-pointer",
            "data-[state=checked]:bg-[rgb(230,228,217)] data-[state=checked]:text-[rgb(78,77,74)]",
            "hover:bg-[rgb(230,228,217)] data-[highlighted]:bg-[rgb(230,228,217)]",
            "data-[highlighted]:text-[rgb(78,77,74)]"
          )}
        >
          Low
        </SelectItem>
      </SelectContent>
    </Select>
  )
} 