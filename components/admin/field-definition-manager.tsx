'use client'

import type { Database, Json } from '@/database.types'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from 'lucide-react'
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Tables = Database['public']['Tables']
type BaseFieldDefinition = Tables['field_definitions']['Row']

interface FieldOption {
  label: string
  value: string
}

interface FieldDefinition extends Omit<BaseFieldDefinition, 'options'> {
  options: FieldOption[] | null
}

interface Props {
  initialFieldDefinitions: FieldDefinition[]
  companyId: string
  onUpdate: (fields: FieldDefinition[]) => void
}

export function FieldDefinitionManager({ initialFieldDefinitions, companyId, onUpdate }: Props) {
  const [fields, setFields] = useState<FieldDefinition[]>(initialFieldDefinitions)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [isRequired, setIsRequired] = useState(false)
  const [allowsMultiple, setAllowsMultiple] = useState(false)
  const [options, setOptions] = useState<FieldOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const generateInternalName = (label: string) => {
    return label.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim()
  }

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOptionLabel.trim()) return

    const value = generateInternalName(newOptionLabel)
    
    // Check for duplicate values
    if (options.some(opt => opt.value === value)) {
      setError('An option with this value already exists')
      return
    }

    setOptions([...options, { 
      label: newOptionLabel.trim(), 
      value 
    }])
    setNewOptionLabel('')
    setError(null)
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFieldLabel.trim()) return
    
    // Validate options for select fields
    if (newFieldType === 'select' && options.length === 0) {
      setError('Select fields must have at least one option')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const newField: Omit<BaseFieldDefinition, 'id'> = { 
        name: generateInternalName(newFieldLabel),
        label: newFieldLabel.trim(),
        field_type: newFieldType,
        is_required: isRequired,
        allows_multiple: newFieldType === 'select' ? allowsMultiple : false,
        options: newFieldType === 'select' ? options as unknown as Json[] : null,
        company_id: companyId 
      }

      const { data, error } = await supabase
        .from('field_definitions')
        .insert(newField)
        .select()
        .single()

      if (error) throw error
      
      const typedData: FieldDefinition = {
        ...data,
        options: data.options as FieldOption[] | null
      }
      
      const updatedFields = [...fields, typedData]
      setFields(updatedFields)
      onUpdate(updatedFields)
      
      // Reset form
      setNewFieldLabel('')
      setNewFieldType('text')
      setIsRequired(false)
      setAllowsMultiple(false)
      setOptions([])
      setNewOptionLabel('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add custom field')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteField = async (id: number) => {
    setError(null)
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('field_definitions')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      const updatedFields = fields.filter(field => field.id !== id)
      setFields(updatedFields)
      onUpdate(updatedFields)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete custom field')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Custom Fields</h2>
        <p className="text-muted-foreground mb-6">
          Define custom fields that customers will fill out when creating tickets.
        </p>
      </div>

      <form onSubmit={handleAddField} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fieldLabel">Field Label</Label>
          <Input
            id="fieldLabel"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
            placeholder="e.g., Order ID"
            disabled={isLoading}
            className="relative z-10"
          />
          <p className="text-sm text-muted-foreground">
            This is what users will see when filling out the field
          </p>
        </div>

        <div className="space-y-2 relative z-20">
          <Label htmlFor="fieldType">Field Type</Label>
          <Select
            value={newFieldType}
            onValueChange={(value) => {
              setNewFieldType(value)
              if (value !== 'select') {
                setOptions([])
                setAllowsMultiple(false)
              }
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="select">Select</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {newFieldType === 'select' && (
          <>
            <div className="space-y-4 p-4 bg-custom-background-secondary border border-custom-ui-medium rounded-lg relative z-10">
              <div className="flex items-center space-x-2 p-2 bg-background rounded border border-custom-ui-medium">
                <Switch
                  id="multiple"
                  checked={allowsMultiple}
                  onCheckedChange={setAllowsMultiple}
                />
                <Label htmlFor="multiple" className="font-medium">Allow Multiple Selections</Label>
              </div>

              <div className="space-y-3">
                <Label className="text-base">Options</Label>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="flex-1 p-2.5 bg-background rounded border border-custom-ui-medium">
                        {option.label}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2 mt-4">
                  <Input
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    placeholder="Option label"
                    className="flex-1 bg-background border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
                  />
                  <Button 
                    type="button"
                    onClick={handleAddOption}
                    disabled={!newOptionLabel.trim()}
                    className="bg-custom-accent text-white hover:bg-custom-accent/90"
                  >
                    Add Option
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center space-x-2 relative z-10">
          <Switch
            id="required"
            checked={isRequired}
            onCheckedChange={setIsRequired}
          />
          <Label htmlFor="required">Required Field</Label>
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isLoading || !newFieldLabel.trim() || (newFieldType === 'select' && options.length === 0)}
          className="relative z-10"
        >
          Add Field
        </Button>
      </form>

      <div className="space-y-2">
        {fields.map((field) => (
          <div 
            key={field.id}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div>
              <p className="font-medium">{field.label}</p>
              <p className="text-sm text-muted-foreground">
                {field.name} • {field.field_type} 
                {field.is_required && ' • required'}
                {field.field_type === 'select' && field.allows_multiple && ' • multiple'}
              </p>
              {field.field_type === 'select' && field.options && field.options.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Options: {field.options.map(o => o.label).join(', ')}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteField(field.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        {fields.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No custom fields defined yet. Add some above.
          </p>
        )}
      </div>
    </div>
  )
} 