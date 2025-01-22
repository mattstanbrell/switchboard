import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

interface AdminSignupMetadata {
  full_name: string
  company_name: string
  role: 'admin'
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const formData = await request.formData()
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const full_name = String(formData.get('full_name'))
  const company_name = String(formData.get('company_name'))
  const role = String(formData.get('role'))

  if (!email || !password || !full_name || !company_name || role !== 'admin') {
    return NextResponse.redirect(
      `${requestUrl.origin}/register-company?error=Missing required fields`,
      {
        status: 301,
      }
    )
  }

  const supabase = await createClient()

  // First check if user already exists
  const { data: existingUser } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (existingUser?.user) {
    return NextResponse.redirect(
      `${requestUrl.origin}/register-company?error=User already exists`,
      {
        status: 301,
      }
    )
  }

  // Create new user and sign them in
  console.log(' [Admin Signup] Starting signup process...', { email, role, company_name });
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        company_name,
        role,
      } as AdminSignupMetadata,
      emailRedirectTo: `${requestUrl.origin}/auth/callback`,
    },
  })

  console.log(' [Admin Signup] Signup result:', { 
    success: !!signUpData?.user,
    userId: signUpData?.user?.id,
    error: signUpError?.message
  });

  if (signUpError) {
    console.error(' [Admin Signup] Signup failed:', signUpError);
    return NextResponse.redirect(
      `${requestUrl.origin}/register-company?error=${encodeURIComponent(signUpError.message)}`,
      {
        status: 301,
      }
    )
  }

  // Company creation is handled by the handle_new_user trigger
  console.log(' [Admin Signup] Company creation handled by trigger');

  // For development/testing, users are auto-confirmed
  // Sign in the user immediately after signup
  console.log(' [Admin Signup] Attempting immediate sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  console.log(' [Admin Signup] Sign in result:', {
    success: !!signInData?.user,
    userId: signInData?.user?.id,
    error: signInError?.message,
    session: !!signInData?.session
  });

  if (signInError) {
    console.error(' [Admin Signup] Sign in failed:', signInError);
    return NextResponse.redirect(
      `${requestUrl.origin}/register-company?error=${encodeURIComponent(signInError.message)}`,
      {
        status: 301,
      }
    )
  }

  // Create response with redirect
  console.log(' [Admin Signup] Success! Redirecting to admin dashboard...');
  const response = NextResponse.redirect(
    `${requestUrl.origin}/admin`,
    {
      status: 301,
    }
  )

  return response
}