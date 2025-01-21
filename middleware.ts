import { createClient } from '@/utils/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // If user is not logged in and trying to access protected routes
  if (!session?.user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // If user is logged in, check role-based access
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const path = request.nextUrl.pathname

    // Check role-based access
    if (path.startsWith('/customer') && profile?.role !== 'customer') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (path.startsWith('/human_agent') && profile?.role !== 'human_agent') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (path.startsWith('/admin') && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

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