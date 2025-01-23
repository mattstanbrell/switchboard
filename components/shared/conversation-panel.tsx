'use client'

import type { Database } from '@/database.types'
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Badge } from "@/components/ui/badge"
import { X, Send } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RealtimeChannel } from '@supabase/supabase-js'

type Tables = Database['public']['Tables']
type Message = Tables['messages']['Row'] & {
  sender?: {
    full_name: string | null
  }
}
type Ticket = Tables['tickets']['Row']

interface Props {
  ticket: Ticket
  onClose: () => void
  variant: 'customer' | 'agent'
  onOpenTicket?: () => void
  onResolveTicket?: () => void
  onCloseTicket?: () => void
}

export function ConversationPanel({ 
  ticket: initialTicket, 
  onClose,
  variant,
  onOpenTicket,
  onResolveTicket,
  onCloseTicket
}: Props) {
  const [ticket, setTicket] = useState(initialTicket)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [otherPartyName, setOtherPartyName] = useState<string>('Unknown')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    setTicket(initialTicket)
  }, [initialTicket])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            full_name
          )
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
      }

      if (!error && data) {
        // If agent view, get customer name
        if (variant === 'agent') {
          const { data: customerData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', ticket.customer_id)
            .single()
          setOtherPartyName(customerData?.full_name || 'Customer')
        }
        setMessages(data)
      }
      setIsLoading(false)
    }

    fetchMessages()

    // Set up real-time subscription
    const supabase = createClient()
    channelRef.current = supabase
      .channel(`messages:ticket_id=eq.${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${ticket.id}`
        },
        async (payload) => {
          console.log('Real-time message update:', payload)
          
          if (payload.eventType === 'INSERT') {
            // Fetch the complete message with sender info
            const { data: newMessage } = await supabase
              .from('messages')
              .select(`
                *,
                sender:sender_id (
                  full_name
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newMessage) {
              setMessages(prev => [...prev, newMessage])
            }
          }
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [ticket.id, ticket.customer_id, variant])

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    setIsSending(true)
    const supabase = createClient()
    
    try {
      const { data: profile } = await supabase.auth.getUser()
      if (!profile.user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('messages')
        .insert([
          {
            ticket_id: ticket.id,
            content: newMessage.trim(),
            sender_id: profile.user.id,
            type: 'user'
          }
        ])

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const renderTicketActions = () => {
    if (variant !== 'agent') return null

    return (
      <div className="flex gap-2 items-center">
        {ticket.status === 'new' && onOpenTicket && (
          <Button
            variant="outline"
            onClick={onOpenTicket}
            disabled={isOpening}
          >
            Open Ticket
          </Button>
        )}
        {ticket.status === 'open' && onResolveTicket && (
          <Button
            variant="outline"
            onClick={onResolveTicket}
          >
            Resolve
          </Button>
        )}
        {ticket.status === 'resolved' && onCloseTicket && (
          <Button
            variant="outline"
            onClick={onCloseTicket}
          >
            Close
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-custom-ui-medium">
        <div className="flex justify-between items-center px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-custom-text">#{ticket.id} - {ticket.subject}</h2>
            <div className="flex gap-2 items-center mt-1">
              <Badge variant="outline">
                {ticket.status}
              </Badge>
              {renderTicketActions()}
            </div>
          </div>
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
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="text-center text-custom-text-secondary">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-custom-text-secondary">No messages yet</div>
            ) : (
              messages.map((message) => {
                const isMyMessage = message.sender_id === currentUserId
                const isSystemMessage = message.type === 'system'

                if (isSystemMessage) {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="bg-custom-background-secondary/50 text-custom-text-secondary text-sm px-4 py-2 rounded-full">
                        {message.content}
                      </div>
                    </div>
                  )
                }

                return (
                  <div 
                    key={message.id}
                    className={`space-y-2 max-w-[85%] ${isMyMessage ? 'ml-auto' : 'mr-auto'}`}
                  >
                    <div className={`flex gap-2 text-sm text-custom-text-secondary ${isMyMessage ? 'flex-row-reverse' : ''}`}>
                      {!isMyMessage && (
                        <span>
                          {variant === 'customer' 
                            ? (message.sender?.full_name || 'Support Agent')
                            : otherPartyName
                          }
                        </span>
                      )}
                      <span>{new Date(message.created_at).toLocaleString()}</span>
                    </div>
                    <div className={`p-4 rounded-lg border ${
                      isMyMessage 
                        ? 'bg-custom-accent/10 border-custom-accent/20 rounded-tr-none' 
                        : 'bg-custom-background-secondary border-custom-ui-medium rounded-tl-none'
                    }`}>
                      <div className="text-custom-text whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {variant === 'customer' && ticket.status === 'new' ? (
          <div className="border-t border-custom-ui-medium bg-custom-background p-4">
            <Alert>
              <AlertDescription>
                Your ticket has been submitted. Please wait for a support agent to respond.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="border-t border-custom-ui-medium bg-custom-background p-4">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="min-h-[80px] resize-none bg-custom-background-secondary border-custom-ui-medium focus:border-custom-accent focus:ring-custom-accent"
              />
              <Button
                className="bg-custom-accent text-white hover:bg-custom-accent/90"
                size="icon"
                disabled={isSending || !newMessage.trim()}
                onClick={handleSendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 