import type { Database } from '@/database.types'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Tables = Database['public']['Tables']
type BaseFieldDefinition = Tables['field_definitions']['Row']
type TicketField = Tables['ticket_fields']['Row']

interface FieldOption {
  label: string
  value: string
}

interface CustomField extends Omit<BaseFieldDefinition, 'options'> {
  options: FieldOption[] | null
}

export default function CreateTicketForm({ onSuccess }: { onSuccess?: () => void }) {
  const [subject, setSubject] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<number, string | string[]>>({})

  useEffect(() => {
    const fetchCustomFields = async () => {
      const supabase = createClient()
      
      // Get the current user's company_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      
      if (!profile?.company_id) return

      // Get custom fields for this company
      const { data: fields } = await supabase
        .from('field_definitions')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')

      if (fields) {
        const typedFields: CustomField[] = fields.map(field => ({
          ...field,
          options: field.options as FieldOption[] | null
        }))
        setCustomFields(typedFields)
        // Initialize field values
        const initialValues: Record<number, string | string[]> = {}
        typedFields.forEach(field => {
          initialValues[field.id] = field.allows_multiple ? [] : ''
        })
        setFieldValues(initialValues)
      }
    }

    fetchCustomFields()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('User not authenticated')
      setIsLoading(false)
      return
    }

    try {
      // Insert the ticket
      const { data: ticket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          subject,
          customer_id: user.id,
          status: 'new'
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Insert custom field values
      if (ticket) {
        const fieldEntries = Object.entries(fieldValues)
          .filter(([fieldId, value]) => {
            const field = customFields.find(f => f.id === parseInt(fieldId))
            if (!field) return false
            if (field.allows_multiple) {
              return (value as string[]).length > 0
            }
            return (value as string).trim() !== ''
          })
          .map(([fieldId, value]) => {
            const field = customFields.find(f => f.id === parseInt(fieldId))
            return {
              ticket_id: ticket.id,
              field_definition_id: parseInt(fieldId),
              value: field?.allows_multiple ? JSON.stringify(value) : value as string
            } satisfies TicketField
          })

        if (fieldEntries.length > 0) {
          const { error: fieldsError } = await supabase
            .from('ticket_fields')
            .insert(fieldEntries)

          if (fieldsError) throw fieldsError
        }

        // Create initial message with all field values
        let messageContent = `Ticket created with subject: ${subject}\n\n`
        
        // Add field values to message
        const fieldMessages = fieldEntries.map(entry => {
          const field = customFields.find(f => f.id === entry.field_definition_id)
          if (!field) return null

          let valueStr: string
          if (field.allows_multiple) {
            const values = JSON.parse(entry.value) as string[]
            valueStr = values.join(', ')
          } else {
            valueStr = entry.value
          }

          return `${field.label}: ${valueStr}`
        }).filter(Boolean)

        if (fieldMessages.length > 0) {
          messageContent += 'Additional Information:\n'
          messageContent += fieldMessages.join('\n')
        }

        // Insert the initial message
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            ticket_id: ticket.id,
            sender_id: user.id,
            content: messageContent
          })

        if (messageError) throw messageError
      }

      // Reset form and notify parent
      setSubject('')
      setFieldValues({})
      setIsLoading(false)
      onSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ticket')
      setIsLoading(false)
    }
  }

  const handleFieldChange = (fieldId: number, value: string | string[]) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }))
  }

  const handleMultiSelectChange = (fieldId: number, value: string) => {
    setFieldValues(prev => {
      const currentValues = (prev[fieldId] || []) as string[]
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value]
      return {
        ...prev,
        [fieldId]: newValues
      }
    })
  }

  const renderField = (field: CustomField) => {
    switch (field.field_type) {
      case 'select':
        if (!field.options?.length) return null
        return field.allows_multiple ? (
          <div className="space-y-2">
            {field.options.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`${field.id}-${option.value}`}
                  checked={(fieldValues[field.id] as string[] || []).includes(option.value)}
                  onChange={() => handleMultiSelectChange(field.id, option.value)}
                  className="h-4 w-4 rounded border-custom-ui-medium text-custom-accent focus:ring-custom-accent"
                />
                <Label 
                  htmlFor={`${field.id}-${option.value}`}
                  className="text-sm font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        ) : (
          <Select
            value={fieldValues[field.id] as string}
            onValueChange={(value) => handleFieldChange(field.id, value)}
          >
            <SelectTrigger className="w-full bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'number':
        return (
          <Input
            type="number"
            value={fieldValues[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.is_required}
            className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
          />
        )
      case 'date':
        return (
          <Input
            type="date"
            value={fieldValues[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.is_required}
            className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
          />
        )
      default:
        return (
          <Input
            type="text"
            value={fieldValues[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.is_required}
            className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
          />
        )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-custom-text">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
          required
        />
      </div>

      {customFields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={`field-${field.id}`} className="text-custom-text">
            {field.label}
            {field.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {renderField(field)}
        </div>
      ))}
      
      {error && (
        <div className="text-destructive text-sm">
          {error}
        </div>
      )}
      
      <Button 
        type="submit" 
        disabled={isLoading}
        className="bg-custom-accent text-white hover:bg-custom-accent/90 focus:ring-2 focus:ring-custom-accent focus:ring-offset-2"
      >
        {isLoading ? 'Creating...' : 'Create Ticket'}
      </Button>
    </form>
  )
} 