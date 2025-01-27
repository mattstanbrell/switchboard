import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const supabase = await createClient()
    
    // Extract and validate email content from form data
    const fromEmail = formData.get('from')
    if (!fromEmail || typeof fromEmail !== 'string') {
      throw new Error('Missing or invalid from email')
    }

    const subject = formData.get('subject') as string | null
    const text = formData.get('text') as string | null
    const html = formData.get('html') as string | null
    
    // Try to find existing customer profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('email', fromEmail)
      .single()

    let customerId: string
    let companyId: string

    if (existingProfile) {
      customerId = existingProfile.id
      companyId = existingProfile.company_id!
    } else {
      // For now, assign to the first company in the system
      // TODO: Implement proper company routing logic based on the receiving email address
      const { data: firstCompany } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .single()
      
      if (!firstCompany) {
        throw new Error('No company found to assign ticket to')
      }
      
      companyId = firstCompany.id

      // Generate a UUID for this email-based profile
      const profileId = uuidv4()

      // Create new profile with generated UUID
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: profileId,
          role: 'customer',
          company_id: companyId,
          email: fromEmail,
          full_name: fromEmail.split('@')[0]
        })
        .select('id')
        .single()

      if (profileError || !newProfile) {
        throw profileError || new Error('Failed to create profile')
      }

      customerId = newProfile.id
    }

    // Create the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        customer_id: customerId,
        status: 'new',
        email: fromEmail  // Store the original sender's email
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      throw ticketError || new Error('Failed to create ticket')
    }

    // Create the initial message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: customerId,
        content: text || html || 'No content provided',
        type: 'user'
      })

    if (messageError) {
      throw messageError
    }

    // Create ticket field for subject if it exists
    if (subject) {
      const { data: subjectField } = await supabase
        .from('field_definitions')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', 'subject')
        .single()

      if (subjectField) {
        await supabase
          .from('ticket_fields')
          .insert({
            ticket_id: ticket.id,
            field_definition_id: subjectField.id,
            value: subject
          })
      }
    }

    return NextResponse.json({ success: true, ticketId: ticket.id })
  } catch (error) {
    console.error('Error in inbound email route:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}