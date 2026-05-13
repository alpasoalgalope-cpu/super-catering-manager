import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 1. If no user and trying to access dashboard -> redirect to login
  const isPublicPath = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. If user is logged in and tries to access login or register -> redirect to home
  if (user && isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. RBAC Check
  if (user) {
    let role = user.app_metadata?.role || user.user_metadata?.role || 'cocina'
    
    // Bypass temporal para el admin principal
    if (user.email === 'fschottenfeld@gmail.com') {
      role = 'admin'
    }
    // Bypass temporal para el usuario de cocina
    if (user.email === 'cocina@supercatering.com' || user.email === 'alpaso.algalope@gmail.com') {
      role = 'cocina'
    }

    if (role === 'cocina') {
      const restrictedPaths = [
        '/informes',
        '/clients',
        '/coordinadores',
        '/crm',
        '/settings',
        '/reglas-liberados',
        '/buses'
      ]
      
      const isRestricted = restrictedPaths.some(path => request.nextUrl.pathname.startsWith(path))
      
      if (isRestricted) {
        // Redirect to a safe page for cocina
        return NextResponse.redirect(new URL('/produccion', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
