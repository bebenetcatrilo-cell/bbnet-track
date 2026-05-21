// ============================================================================
// CONEXIÓN CON SUPABASE · LADO NAVEGADOR
// ----------------------------------------------------------------------------
// Este archivito crea la "línea telefónica" entre el panel (en el navegador)
// y tu base de datos Supabase. Lo usan los componentes que corren en pantalla,
// como el formulario de login.
// ============================================================================

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
