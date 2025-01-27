import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    console.log('=== INBOUND EMAIL PROCESSING STARTED ===')
    const formData = await request.formData()
    console.log('Form data received:', Object.fromEntries(formData.entries()))
    
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
    console.log('From email (raw):', fromEmail)
    console.log('From email type:', typeof fromEmail)
    
    if (!fromEmail || typeof fromEmail !== 'string') {
      console.error('Invalid from email:', fromEmail)
      throw new Error('Missing or invalid from email')
    }

    const subject = formData.get('subject')?.toString() || ''
    const text = formData.get('text')?.toString() || ''
    const html = formData.get('html')?.toString() || ''
    
    console.log('Parsed email content:', {
      fromEmail,
      subject: subject || '(empty)',
      hasText: !!text,
      hasHtml: !!html
    })

    // Get first company
    console.log('Fetching company...')
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    console.log('Company found:', company)

    if (!company) {
      throw new Error('No company found to handle the email')
    }

    // Check if user exists
    console.log('Checking for existing profile...')
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', fromEmail)
      .eq('company_id', company.id)
      .single()

    console.log('Existing profile:', existingProfile)

    let customerId: string

    if (!existingProfile) {
      console.log('No existing profile found, creating new user...')
      // Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: fromEmail,
        email_confirm: true,
        user_metadata: {
          full_name: fromEmail.split('@')[0],
          role: 'customer',
          company_id: company.id
        }
      })

      if (signUpError) {
        console.error('Error creating auth user:', signUpError)
        throw signUpError
      }
      if (!authData.user) {
        console.error('No user data returned')
        throw new Error('Failed to create user')
      }

      console.log('Auth user created:', {
        id: authData.user.id,
        email: authData.user.email
      })

      customerId = authData.user.id
    } else {
      console.log('Using existing profile')
      customerId = existingProfile.id
    }

    // Process the email
    console.log('Processing email with params:', {
      customer_id: customerId,
      company_id: company.id,
      from_email: fromEmail,
      has_subject: !!subject,
      has_text: !!text,
      has_html: !!html
    })
    
    const { data, error } = await supabase
      .rpc('process_inbound_email', {
        customer_id: customerId,
        company_id: company.id,
        from_email: fromEmail,
        subject,
        text_content: text,
        html_content: html
      })

    if (error) {
      console.error('Error processing email:', error)
      throw error
    }

    console.log('Email processed successfully:', data)
    console.log('=== INBOUND EMAIL PROCESSING COMPLETED ===')

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in inbound email route:', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}