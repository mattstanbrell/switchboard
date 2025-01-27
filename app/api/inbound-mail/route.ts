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

    // Get first company (TODO: implement proper routing)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    if (!company) {
      throw new Error('No company found to handle the email')
    }

    // Check if user exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', fromEmail)
      .eq('company_id', company.id)
      .single()

    let customerId: string

    if (!existingProfile) {
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

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Failed to create user')

      customerId = authData.user.id
    } else {
      customerId = existingProfile.id
    }

    // Process the email
    const { data, error } = await supabase
      .rpc('process_inbound_email', {
        customer_id: customerId,
        company_id: company.id,
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