import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X } from "lucide-react"

interface InternalNote {
  id: number
  ticket_id: number
  human_agent_id: string
  created_at: string
  content: string
  agent?: {
    full_name: string | null
  }
}

interface Props {
  ticketId: number
  onClose: () => void
}

export function InternalNotesPanel({ ticketId, onClose }: Props) {
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    const loadNotes = async () => {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('internal_notes')
        .select(`
          *,
          agent:human_agent_id (
            full_name
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setNotes(data)
      }
      setIsLoading(false)
    }

    loadNotes()

    // Set up real-time subscription
    const supabase = createClient()
    console.log('Setting up real-time subscription for ticket:', ticketId)
    const channel = supabase
      .channel(`internal_notes:ticket_id=eq.${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_notes',
          filter: `ticket_id=eq.${ticketId}`
        },
        async (payload) => {
          console.log('Received real-time update:', payload)
          if (payload.eventType === 'INSERT') {
            console.log('Processing INSERT event')
            // Immediately add the new note to the list
            const newNote: InternalNote = {
              id: payload.new.id,
              ticket_id: payload.new.ticket_id,
              human_agent_id: payload.new.human_agent_id,
              created_at: payload.new.created_at,
              content: payload.new.content,
              agent: undefined
            }
            console.log('Adding new note to state:', newNote)

            setNotes(prev => {
              console.log('Previous notes:', prev)
              const updated = [newNote, ...prev]
              console.log('Updated notes:', updated)
              return updated
            })

            // Then fetch the complete note with agent info
            console.log('Fetching full note data')
            const { data: fullNote } = await supabase
              .from('internal_notes')
              .select(`
                *,
                agent:human_agent_id (
                  full_name
                )
              `)
              .eq('id', payload.new.id)
              .single()

            console.log('Received full note data:', fullNote)
            if (fullNote) {
              // Update the note in the list with the full data
              setNotes(prev => prev.map(note => 
                note.id === fullNote.id ? fullNote : note
              ))
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Cleaning up subscription')
      supabase.removeChannel(channel)
    }
  }, [ticketId])

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return

    setIsSending(true)
    const supabase = createClient()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('internal_notes')
        .insert([
          {
            ticket_id: ticketId,
            content: newNoteContent.trim(),
            human_agent_id: user.id
          }
        ])

      if (error) throw error

      setNewNoteContent('')
    } catch (error) {
      console.error('Failed to add note:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddNote()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-custom-ui-medium">
        <div className="flex justify-between items-center px-6 py-4">
          <h2 className="text-lg font-semibold text-custom-text">Internal Notes</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-custom-text-secondary hover:text-custom-text"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1 [&_[data-radix-scroll-area-scrollbar]]:opacity-0 [&_[data-radix-scroll-area-scrollbar]]:transition-opacity hover:[&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-scrollbar]]:data-[state=visible]:opacity-100">
          <div className="p-6 space-y-4">
            {isLoading ? (
              <div className="text-center text-custom-text-secondary">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="text-center text-custom-text-secondary">No internal notes yet</div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="space-y-2 max-w-[85%]">
                  <div className="flex gap-2 text-sm text-custom-text-secondary">
                    <span>{note.agent?.full_name || 'Unknown Agent'}</span>
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-lg border bg-custom-background-secondary border-custom-ui-medium rounded-tl-none">
                    <div className="text-custom-text whitespace-pre-wrap">
                      {note.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-custom-ui-medium bg-custom-background">
          <Textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={handleKeyPress}
            className="min-h-[80px] resize-none bg-custom-background-secondary border-custom-ui-medium focus:border-custom-ui-medium/50 focus:ring-0"
          />
        </div>
      </div>
    </div>
  )
} 