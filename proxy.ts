// ============================================================================
// EL "PORTERO" DEL SISTEMA · proxy.ts
// ----------------------------------------------------------------------------
// Este archivo es el portero que revisa a cada uno antes de dejarlo pasar.
// Se ejecuta ANTES de cargar cualquier página. Su trabajo:
//   - Si NO estás logueado e intentás entrar al panel -> te manda al login
//   - Si YA estás logueado e intentás ir al login     -> te manda al dashboard
//   - De paso, mantiene tu sesión fresca (que no se cierre sola)
//
// NOTA: en Next.js 16+ este archivo se llama "proxy.ts" y la función "proxy"
// (antes se llamaba "middleware"). Es el mismo cambio que hicimos en BBNet Systems.
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Revisamos si hay un usuario logueado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esRutaPublica = ruta === '/login' || ruta === '/';

  // Si NO está logueado y quiere entrar a una ruta protegida -> al login
  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Si YA está logueado y va al login o al inicio -> al dashboard
  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

// Acá le decimos en qué rutas tiene que actuar el portero.
// Dejamos afuera archivos estáticos (imágenes, iconos) para no frenarlos al pedo.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
