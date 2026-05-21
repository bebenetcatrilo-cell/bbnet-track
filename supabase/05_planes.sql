-- ============================================================================
-- BBNET TRACK · PLANES · PASO 1: CATÁLOGO DE PLANES
-- ============================================================================
-- Crea la tabla "planes" con los 3 planes + la prueba gratis.
-- Los precios y límites quedan EDITABLES desde el panel del super_admin.
--
-- CÓMO USAR: pegá todo en el SQL Editor de Supabase y dale Run.
-- ============================================================================


-- 1) LA TABLA DE PLANES
-- ----------------------------------------------------------------------------
create table if not exists public.planes (
    id              uuid primary key default uuid_generate_v4(),
    codigo          text unique not null,          -- 'trial', 'basico', 'pro', 'premium'
    nombre          text not null,                 -- "Prueba gratis", "Básico", etc.
    descripcion     text,                          -- texto corto para mostrar
    precio_mensual  numeric default 0,             -- en pesos argentinos
    limite_dispositivos int default 5,             -- cuántos rastreadores permite
    dias_prueba     int default 0,                 -- solo para el trial (0 = no es prueba)
    orden           int default 0,                 -- para ordenarlos al mostrar
    activo          boolean default true,          -- si se ofrece o no
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

comment on table public.planes is 'Catálogo de planes de suscripción (editable por super_admin)';


-- 2) CARGAR EL CATÁLOGO INICIAL (la propuesta)
-- ----------------------------------------------------------------------------
-- Si ya existen (por código), no los duplica.
insert into public.planes (codigo, nombre, descripcion, precio_mensual, limite_dispositivos, dias_prueba, orden)
values
    ('trial',   'Prueba gratis', 'Probá el sistema sin costo',        0,     3,  15, 1),
    ('basico',  'Básico',        'Para flotas chicas',                15000, 5,  0,  2),
    ('pro',     'Pro',           'Para flotas medianas',              35000, 15, 0,  3),
    ('premium', 'Premium',       'Para flotas grandes',               90000, 50, 0,  4)
on conflict (codigo) do nothing;


-- 3) TRIGGER para mantener updated_at al día
-- ----------------------------------------------------------------------------
create or replace function public.tocar_updated_at_planes()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_planes_updated on public.planes;
create trigger trg_planes_updated
    before update on public.planes
    for each row execute function public.tocar_updated_at_planes();


-- 4) SEGURIDAD (RLS)
-- ----------------------------------------------------------------------------
alter table public.planes enable row level security;

-- Cualquiera logueado puede VER los planes (para mostrarlos)
drop policy if exists "todos ven planes" on public.planes;
create policy "todos ven planes" on public.planes
    for select using (auth.uid() is not null);

-- Solo el super_admin puede CREAR / EDITAR / BORRAR planes
drop policy if exists "superadmin gestiona planes" on public.planes;
create policy "superadmin gestiona planes" on public.planes
    for all using (public.soy_super_admin()) with check (public.soy_super_admin());


-- ============================================================================
-- Listo. Ya tenés el catálogo de planes cargado y editable.
-- Próximo paso: la pantalla del panel para verlos y editarlos.
-- ============================================================================
