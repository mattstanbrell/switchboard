import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Extract and validate email content from form data
    const fromEmail = formData.get('from')
    if (!fromEmail || typeof fromEmail !== 'string') {
      throw new Error('Missing or invalid from email')
    }

    const subject = formData.get('subject')?.toString() || ''
    const text = formData.get('text')?.toString() || ''
    const html = formData.get('html')?.toString() || ''

    // Call the security definer function to handle the email
    const { data, error } = await supabase
      .rpc('handle_inbound_email', {
        from_email: fromEmail,
        subject,
        text_content: text,
        html_content: html
      })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in inbound email route:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}