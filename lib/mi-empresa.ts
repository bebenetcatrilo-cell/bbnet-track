// ============================================================================
// HELPER · obtener la empresa del usuario actual
// ----------------------------------------------------------------------------
// El super_admin tiene permiso de ver TODO (para la sección Servicio).
// Pero en las secciones normales (Mapa, Vehículos, Dispositivos) queremos que
// vea SOLO su propia empresa. Por eso filtramos explícitamente con esta función.
// ============================================================================

import { createClient } from '@/lib/supabase-client';

// Devuelve el company_id del usuario logueado (o null si no se encuentra)
export async function getMiCompanyId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();
  return (data?.company_id as string) ?? null;
}
