'use client'

import type { Database } from '@/database.types'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2 } from 'lucide-react'

type Tables = Database['public']['Tables']
type FocusArea = Tables['focus_areas']['Row']

interface Props {
  initialFocusAreas: FocusArea[]
  companyId: string
  onUpdate: (focusAreas: FocusArea[]) => void
}

export function FocusAreaManager({ initialFocusAreas, companyId, onUpdate }: Props) {
  const [focusAreas, setFocusAreas] = useState(initialFocusAreas)
  const [newAreaName, setNewAreaName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAreaName.trim()) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('focus_areas')
        .insert([{ name: newAreaName.trim(), company_id: companyId }])
        .select()
        .single()

      if (error) throw error
      
      const updatedAreas = [...focusAreas, data]
      setFocusAreas(updatedAreas)
      onUpdate(updatedAreas)
      setNewAreaName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add focus area')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteArea = async (id: number) => {
    setError(null)
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('focus_areas')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      const updatedAreas = focusAreas.filter(area => area.id !== id)
      setFocusAreas(updatedAreas)
      onUpdate(updatedAreas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete focus area')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Focus Areas</h2>
        <p className="text-muted-foreground mb-6">
          Manage the focus areas that customers can select when creating tickets.
        </p>
      </div>

      <form onSubmit={handleAddArea} className="flex gap-4 items-start">
        <div className="flex-1">
          <Input
            placeholder="Enter new focus area name"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <Button type="submit" disabled={isLoading || !newAreaName.trim()}>
          Add Area
        </Button>
      </form>

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      <div className="space-y-2">
        {focusAreas.map((area) => (
          <div 
            key={area.id}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <span>{area.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteArea(area.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {focusAreas.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No focus areas yet. Add some above.
          </p>
        )}
      </div>
    </div>
  )
} 