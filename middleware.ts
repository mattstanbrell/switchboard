import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

interface Profile {
  id: string
  role: 'admin' | 'human_agent' | 'customer'
  company_id: string
}

// List of public routes that don't require authentication
const publicRoutes = ['/', '/login', '/auth/confirm', '/auth/auth-code-error', '/register-company']

export async function middleware(request: NextRequest) {
  console.log(' [Middleware] Starting middleware check for path:', request.nextUrl.pathname);
  
  // Check if the current route is public
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith('/auth/')
  )
  console.log(' [Middleware] Is public route?', isPublicRoute);

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = await createClient()
  console.log(' [Middleware] Checking user session...');
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log(' [Middleware] User session result:', { 
    hasUser: !!user, 
    userId: user?.id,
    userError: userError?.message 
  });

  // If user is not logged in and trying to access protected routes
  if (!user && !isPublicRoute) {
    console.log(' [Middleware] No user found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If user is logged in and trying to access auth pages, redirect to their role-specific page
  if (user && isPublicRoute) {
    console.log(' [Middleware] User logged in, checking profile...');
    const { data, error: profileError } = await supabase
      .rpc('get_profile', { user_id: user.id })
      .single()
    
    const profile = data as Profile | null

    console.log(' [Middleware] Profile check result:', { 
      hasProfile: !!profile, 
      role: profile?.role,
      profileError: profileError?.message 
    });

    if (profile?.role === 'customer') {
      return NextResponse.redirect(new URL('/customer', request.url))
    } else if (profile?.role === 'human_agent') {
      return NextResponse.redirect(new URL('/human_agent', request.url))
    } else if (profile?.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // If user is logged in, check role-based access
  if (user) {
    console.log(' [Middleware] Checking role-based access...');
    const { data, error: profileError } = await supabase
      .rpc('get_profile', { user_id: user.id })
      .single()
    
    const profile = data as Profile | null

    console.log(' [Middleware] Role check result:', { 
      hasProfile: !!profile, 
      role: profile?.role,
      profileError: profileError?.message 
    });

    const path = request.nextUrl.pathname

    // Check role-based access
    if (path.startsWith('/customer') && profile?.role !== 'customer') {
      console.log(' [Middleware] Invalid role for /customer, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (path.startsWith('/human_agent') && profile?.role !== 'human_agent') {
      console.log(' [Middleware] Invalid role for /human_agent, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (path.startsWith('/admin') && profile?.role !== 'admin') {
      console.log(' [Middleware] Invalid role for /admin, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  console.log(' [Middleware] Access granted for path:', request.nextUrl.pathname);
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
} 