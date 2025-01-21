import { createClient } from '@/utils/supabase/server'
import { supabaseService } from '@/utils/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { email, password, fullName, companyId } = json

    const supabase = await createClient()

    // First verify the current user is an admin of the company
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !adminProfile) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (adminProfile.role !== 'admin' || adminProfile.company_id !== companyId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Create the new user using the service client (admin API)
    const { data: newUser, error: createError } = await supabaseService.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'human_agent',
        company_id: companyId
      }
    })

    if (createError) {
      throw createError
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  } catch (error) {
    console.error('Error registering agent:', error)
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    )
  }
} 