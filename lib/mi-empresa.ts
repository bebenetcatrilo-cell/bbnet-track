// ============================================================================
// HELPER · obtener la empresa del usuario actual  (versión rápida)
// ----------------------------------------------------------------------------
// El super_admin tiene permiso de ver TODO (para la sección Servicio).
// Pero en las secciones normales (Mapa, Vehículos, Dispositivos) queremos que
// vea SOLO su propia empresa. Por eso filtramos explícitamente con esta función.
//
// POR QUÉ ESTA VERSIÓN ES MÁS RÁPIDA:
// 1) Antes usaba supabase.auth.getUser(), que va hasta el servidor de Supabase
//    a verificar la sesión por internet (~900ms). Ahora usa getSession(), que
//    lee la sesión LOCAL, al instante, sin ir al servidor. La seguridad real la
//    sigue garantizando RLS del lado de la base, así que no perdemos protección.
// 2) Antes se preguntaba la empresa en CADA pantalla y en CADA posición que
//    llegaba. Ahora la "recordamos" (cache) mientras la página está abierta:
//    la averiguamos una sola vez y después la devolvemos al instante.
// 3) Si varias partes la piden al mismo tiempo, comparten la misma consulta
//    (no se dispara 5 veces en paralelo).
//
// El cache se borra solo al recargar la página. Al cerrar sesión conviene
// llamar a limpiarCacheEmpresa() por prolijidad.
// ============================================================================

import { createClient } from '@/lib/supabase-client';

let cacheCompanyId: string | null = null;
let cachePromesa: Promise<string | null> | null = null;

export async function getMiCompanyId(): Promise<string | null> {
  // Ya la sabemos → la devolvemos al instante.
  if (cacheCompanyId) return cacheCompanyId;
  // Ya hay una consulta en curso → esperamos esa misma (evita pedirla varias veces juntas).
  if (cachePromesa) return cachePromesa;

  cachePromesa = (async () => {
    try {
      const supabase = createClient();

      // getSession() lee la sesión guardada localmente (rápido, sin red).
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;

      const { data } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      cacheCompanyId = (data?.company_id as string) ?? null;
      return cacheCompanyId;
    } finally {
      // Liberamos la promesa en curso (el resultado ya quedó en cacheCompanyId
      // si se pudo resolver).
      cachePromesa = null;
    }
  })();

  return cachePromesa;
}

// Limpia el cache (llamar al cerrar sesión, por las dudas).
export function limpiarCacheEmpresa() {
  cacheCompanyId = null;
  cachePromesa = null;
}
