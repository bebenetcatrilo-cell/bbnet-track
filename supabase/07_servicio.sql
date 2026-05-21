-- ============================================================================
-- BBNET TRACK · SERVICIO · permisos de soporte para el super_admin
-- ============================================================================
-- Para que el sector "Servicio" funcione, el super_admin necesita poder VER
-- los vehículos, dispositivos y ubicaciones de TODAS las empresas (no solo
-- la suya). Esto es solo LECTURA, para dar soporte.
--
-- Los clientes normales siguen viendo SOLO lo suyo (eso no cambia).
--
-- CÓMO USAR: pegá todo en el SQL Editor de Supabase y dale Run.
-- ============================================================================


-- El super_admin puede VER vehículos de cualquier empresa
drop policy if exists "superadmin ve todos los vehiculos" on public.vehicles;
create policy "superadmin ve todos los vehiculos" on public.vehicles
    for select using (public.soy_super_admin());


-- El super_admin puede VER dispositivos de cualquier empresa
drop policy if exists "superadmin ve todos los dispositivos" on public.tracker_devices;
create policy "superadmin ve todos los dispositivos" on public.tracker_devices
    for select using (public.soy_super_admin());


-- El super_admin puede VER ubicaciones de cualquier empresa (para el mapa)
drop policy if exists "superadmin ve todas las ubicaciones" on public.locations;
create policy "superadmin ve todas las ubicaciones" on public.locations
    for select using (public.soy_super_admin());


-- ============================================================================
-- Listo. El super_admin ya puede dar soporte viendo la flota de cualquier
-- cliente desde el sector Servicio. Los clientes siguen aislados entre sí.
-- ============================================================================
