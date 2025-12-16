import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Simple middleware - token validation happens on backend
  // Just check if user is trying to access dashboard without auth
  const pathname = request.nextUrl.pathname

  // Allow access to login/register pages
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.next()
  }

  // For dashboard routes, let the frontend handle auth
  // The API will return 401 if token is invalid
  if (pathname.startsWith('/dashboard')) {
    // Check if token exists in cookie or let it pass (client-side will handle)
    const token = request.cookies.get('auth_token')?.value
    
    // If no token in cookie, let it pass - client-side API will handle auth
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
