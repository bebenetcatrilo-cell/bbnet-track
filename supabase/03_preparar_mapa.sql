-- ============================================================================
-- BBNET TRACK · BLOQUE 3 · PREPARAR EL MAPA EN VIVO
-- ============================================================================
-- Esto hace dos cosas:
--   1) Activa "Realtime" en la tabla de ubicaciones (para que el mapa se
--      actualice solo cuando llega una posición nueva).
--   2) Crea un dispositivo rastreador para cada uno de tus dos vehículos de
--      prueba, así el simulador tiene a quién mandarle posiciones.
--
-- CÓMO USAR: pegá todo en el SQL Editor de Supabase y dale Run.
-- ============================================================================


-- 1) ACTIVAR REALTIME en la tabla de ubicaciones
-- ----------------------------------------------------------------------------
-- Esto le dice a Supabase "avisá al instante cuando entre una posición nueva".
-- Es lo que hace que el punto se mueva solo en el mapa, sin recargar.
alter publication supabase_realtime add table public.locations;


-- 2) CREAR UN DISPOSITIVO (celular simulado) PARA CADA VEHÍCULO
-- ----------------------------------------------------------------------------
-- Conectamos un "celular" a cada vehículo de prueba que cargamos en el Bloque 1.
insert into public.tracker_devices (company_id, vehicle_id, nombre, tipo, online, bateria)
select
    v.company_id,
    v.id,
    'Celular ' || v.nombre,
    'celular',
    true,
    100
from public.vehicles v
where v.company_id = '11111111-1111-1111-1111-111111111111';


-- ============================================================================
-- Listo. Realtime activado y dispositivos creados.
-- Ahora desde el panel vas a poder simular el movimiento.
-- ============================================================================
