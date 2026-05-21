// ============================================================================
// CONEXIÓN CON SUPABASE · LADO SERVIDOR
// ----------------------------------------------------------------------------
// Igual que el otro archivo, pero para el lado del servidor (lo que Next.js
// procesa antes de mostrarte la página). Lo usa el "portero" que revisa si
// estás logueado antes de dejarte entrar al panel.
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorado: pasa cuando se llama desde un Server Component.
            // El refresco de sesión lo maneja el proxy.
          }
        },
      },
    }
  );
}
