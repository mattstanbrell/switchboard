'use client'

import type { Database } from '@/database.types'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import CreateTicketForm from '@/components/tickets/create-ticket-form'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { CustomerConversationPanel } from '@/components/customer/conversation-panel'
import { ResizableLayout } from '@/components/shared/resizable-layout'

type Tables = Database['public']['Tables']
type Ticket = Tables['tickets']['Row']
type Profile = Tables['profiles']['Row']

export default function CustomerPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const router = useRouter()
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const supabase = createClient()
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/')
        return
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profileData)

      // Fetch tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
      
      setTickets(ticketsData || [])
      setIsLoading(false)
    }

    fetchData()
  }, [router, open]) // Refetch when dialog closes

  const ticketTable = (
    <Table>
      <TableHeader className="sticky top-0 bg-custom-background z-10">
        <TableRow className="hover:bg-custom-background">
          <TableHead className="text-custom-text">ID</TableHead>
          <TableHead className="text-custom-text">Subject</TableHead>
          <TableHead className="text-custom-text">Status</TableHead>
          <TableHead className="text-custom-text">Created</TableHead>
          <TableHead className="text-custom-text">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-custom-text-secondary">
              Loading tickets...
            </TableCell>
          </TableRow>
        ) : tickets.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-custom-text-secondary">
              No tickets found. Create your first ticket to get started.
            </TableCell>
          </TableRow>
        ) : (
          tickets.map((ticket) => (
            <TableRow 
              key={ticket.id}
              className={
                selectedTicket?.id === ticket.id 
                  ? "bg-custom-ui-faint hover:bg-custom-ui-faint" 
                  : "hover:bg-custom-background-secondary"
              }
            >
              <TableCell className="text-custom-text">#{ticket.id}</TableCell>
              <TableCell className="text-custom-text">{ticket.subject}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-custom-ui-faint">
                  {ticket.status}
                </span>
              </TableCell>
              <TableCell className="text-custom-text-secondary">
                {new Date(ticket.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-custom-background border-custom-ui-medium hover:bg-custom-ui-faint text-custom-text"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  const conversationPanel = selectedTicket ? (
    <CustomerConversationPanel 
      ticket={selectedTicket}
      onClose={() => setSelectedTicket(null)}
    />
  ) : undefined

  return (
    <div className="flex flex-col h-screen bg-custom-background">
      {/* Header */}
      <header className="border-b border-custom-ui-medium">
        <div className="flex justify-between items-center p-8">
          <div>
            <h1 className="text-2xl font-bold text-custom-text">Customer Dashboard</h1>
            <p className="text-custom-text-secondary">Hi, {profile?.full_name}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-custom-accent text-white hover:bg-custom-accent/90">
                Create New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-custom-background-secondary border-custom-ui-medium">
              <DialogHeader>
                <DialogTitle className="text-custom-text">Create New Ticket</DialogTitle>
              </DialogHeader>
              <CreateTicketForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <ResizableLayout 
        mainContent={ticketTable}
        sideContent={conversationPanel}
      />
    </div>
  )
} 