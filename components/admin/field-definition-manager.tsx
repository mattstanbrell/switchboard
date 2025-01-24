'use client'

import type { Database, Json } from '@/database.types'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, GripVertical, Settings2, Trash2, Type, Hash, Calendar, List } from 'lucide-react'
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DndContext, DragEndEvent, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

const fieldTypeIcons = {
  text: <Type className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  select: <List className="w-4 h-4" />
}

interface SortableFieldProps {
  field: FieldDefinition
  onEdit: () => void
  onDelete: () => void
}

function SortableField({ field, onEdit, onDelete }: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-card rounded-lg border ${
        isDragging ? 'shadow-lg' : ''
      } ${field.is_required ? 'border-custom-accent-red' : ''}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab hover:text-foreground text-muted-foreground">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            {fieldTypeIcons[field.field_type as keyof typeof fieldTypeIcons]}
          </div>
          <div>
            <div className="font-medium">{field.label}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {field.field_type === 'select' && field.allows_multiple && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Multiple</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Settings2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export function FieldDefinitionManager({ initialFieldDefinitions, companyId, onUpdate }: Props) {
  const [fields, setFields] = useState<FieldDefinition[]>(initialFieldDefinitions)
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null)
  const [showFieldDialog, setShowFieldDialog] = useState(false)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [isRequired, setIsRequired] = useState(false)
  const [allowsMultiple, setAllowsMultiple] = useState(false)
  const [options, setOptions] = useState<FieldOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null)
  const [editingOptionValue, setEditingOptionValue] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  )

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return

    const oldIndex = fields.findIndex(field => field.id === active.id)
    const newIndex = fields.findIndex(field => field.id === over.id)

    const newFields = [...fields]
    const [removed] = newFields.splice(oldIndex, 1)
    newFields.splice(newIndex, 0, removed)

    // Update local state immediately for smooth UI
    setFields(newFields)
    
    try {
      const supabase = createClient()
      
      // Update display_order for all affected fields
      const updates = newFields.map((field, index) => ({
        id: field.id,
        display_order: index + 1,
        company_id: field.company_id,
        name: field.name,
        label: field.label,
        field_type: field.field_type,
        is_required: field.is_required,
        allows_multiple: field.allows_multiple,
        options: field.options as unknown as Json[] | null
      }))
      
      const { error } = await supabase
        .from('field_definitions')
        .upsert(updates, { onConflict: 'id' })
      
      if (error) throw error
      
      onUpdate(newFields)
    } catch (e) {
      // Revert to old order if update fails
      setFields(fields)
      setError(e instanceof Error ? e.message : 'Failed to update field order')
    }
  }

  const resetForm = () => {
    setNewFieldLabel('')
    setNewFieldType('text')
    setIsRequired(false)
    setAllowsMultiple(false)
    setOptions([])
    setNewOptionLabel('')
    setEditingField(null)
    setShowFieldDialog(false)
  }

  const handleSaveField = async () => {
    if (!newFieldLabel.trim()) return
    
    if (newFieldType === 'select' && options.length === 0) {
      setError('Select fields must have at least one option')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      const fieldData: Omit<BaseFieldDefinition, 'id'> = { 
        name: generateInternalName(newFieldLabel),
        label: newFieldLabel.trim(),
        field_type: newFieldType,
        is_required: isRequired,
        allows_multiple: newFieldType === 'select' ? allowsMultiple : false,
        options: newFieldType === 'select' ? options as unknown as Json[] : null,
        company_id: companyId,
        display_order: fields.length + 1
      }

      if (editingField) {
        const { error } = await supabase
          .from('field_definitions')
          .update(fieldData)
          .eq('id', editingField.id)

        if (error) throw error

        const updatedFields = fields.map(field =>
          field.id === editingField.id
            ? { ...fieldData, id: editingField.id, options: options }
            : field
        )
        setFields(updatedFields)
        onUpdate(updatedFields)
      } else {
        const { data, error } = await supabase
          .from('field_definitions')
          .insert(fieldData)
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
      }
      
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save custom field')
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

  const handleEditOption = (index: number) => {
    setEditingOptionIndex(index)
    setEditingOptionValue(options[index].label)
  }

  const handleSaveOption = (index: number) => {
    if (!editingOptionValue.trim()) return
    
    const value = generateInternalName(editingOptionValue)
    
    // Check for duplicate values, excluding the current option
    if (options.some((opt, i) => i !== index && opt.value === value)) {
      setError('An option with this value already exists')
      return
    }

    const newOptions = [...options]
    newOptions[index] = {
      label: editingOptionValue.trim(),
      value
    }
    setOptions(newOptions)
    setEditingOptionIndex(null)
    setEditingOptionValue('')
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4">Custom Fields</h2>
        <p className="text-muted-foreground mb-6">
          Define custom fields that customers will fill out when creating tickets.
        </p>
      </div>

      <div className="space-y-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map((field) => (
                <SortableField
                  key={field.id}
                  field={field}
                  onEdit={() => {
                    setEditingField(field)
                    setNewFieldLabel(field.label)
                    setNewFieldType(field.field_type)
                    setIsRequired(field.is_required)
                    setAllowsMultiple(field.allows_multiple)
                    setOptions(field.options || [])
                    setShowFieldDialog(true)
                  }}
                  onDelete={() => handleDeleteField(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <Button
          variant="outline"
          className="w-full py-8 border-dashed"
          onClick={() => setShowFieldDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Field
        </Button>
      </div>

      <Dialog open={showFieldDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Field'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fieldLabel">Field Label</Label>
              <Input
                id="fieldLabel"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g., Order ID"
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                This is what users will see when filling out the field
              </p>
            </div>

            <div className="space-y-2">
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
                <SelectTrigger>
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

            <div className="flex items-center space-x-2">
              <Switch
                id="required"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
              <Label htmlFor="required">Required Field</Label>
            </div>

            {newFieldType === 'select' && (
              <div className="space-y-4 p-4 bg-secondary/40 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="multiple"
                    checked={allowsMultiple}
                    onCheckedChange={setAllowsMultiple}
                  />
                  <Label htmlFor="multiple" className="text-foreground">Allow Multiple Selections</Label>
                </div>

                <div className="space-y-3">
                  <Label className="text-foreground">Options</Label>
                  <div className="space-y-2">
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {editingOptionIndex === index ? (
                          <div className="flex-1 flex space-x-2">
                            <Input
                              value={editingOptionValue}
                              onChange={(e) => setEditingOptionValue(e.target.value)}
                              className="flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveOption(index)
                                } else if (e.key === 'Escape') {
                                  setEditingOptionIndex(null)
                                  setEditingOptionValue('')
                                }
                              }}
                              onBlur={() => handleSaveOption(index)}
                            />
                          </div>
                        ) : (
                          <div
                            className="flex-1 p-2.5 bg-background rounded-lg border cursor-pointer hover:border-input"
                            onClick={() => handleEditOption(index)}
                          >
                            {option.label}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex space-x-2">
                    <Input
                      value={newOptionLabel}
                      onChange={(e) => setNewOptionLabel(e.target.value)}
                      placeholder="Option label"
                      className="flex-1"
                    />
                    <Button 
                      type="button"
                      onClick={handleAddOption}
                      disabled={!newOptionLabel.trim()}
                    >
                      Add Option
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}

            <Button 
              className="w-full" 
              onClick={handleSaveField}
              disabled={isLoading || !newFieldLabel.trim()}
            >
              {isLoading ? 'Saving...' : editingField ? 'Save Changes' : 'Add Field'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 