import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. FAST-PATH BYPASS para rutas públicas y APIs:
  // Cero llamadas de red a Supabase para evitar congelamiento de Netlify Edge Function
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isLandingPage = pathname === '/'
  const isStoreOrCoordi = pathname.startsWith('/tienda') || pathname.startsWith('/coordi')
  const isApiRoute = pathname.startsWith('/api/')

  // Si es landing, tienda, coordi o API pública, responder de inmediato sin tocar Supabase
  if (isLandingPage || isStoreOrCoordi || isApiRoute) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

    // Protección anti-timeout para Edge Functions: máximo 2500ms
    const userPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise<{ data: { user: any }; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('Edge Auth Timeout')), 2500)
    )

    const { data: { user } } = await Promise.race([userPromise, timeoutPromise])

    // Si no está logueado y no está en página de auth -> redirigir a login
    if (!user && !isAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Si ya está logueado e intenta entrar a login -> mandar a dashboard
    if (user && isAuthPage) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // RBAC Check: Solo fschottenfeld@gmail.com queda activo en la plataforma
    if (user) {
      const userEmail = (user.email || '').toLowerCase().trim()

      // Desactivación de usuario cocina: solo fschottenfeld queda habilitado
      if (userEmail !== 'fschottenfeld@gmail.com') {
        const response = NextResponse.redirect(new URL('/login?error=disabled', request.url))
        response.cookies.delete('sb-access-token')
        response.cookies.delete('sb-refresh-token')
        return response
      }
    }

    return supabaseResponse
  } catch (err) {
    console.warn('[Middleware Safe Catch]', err)
    // Ante cualquier timeout de red o error de Deno/Edge, redirigir a login limpiamente en vez de crashear
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
