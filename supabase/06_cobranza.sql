-- ============================================================================
-- BBNET TRACK · COBRANZA · tabla de cobros + día de vencimiento
-- ============================================================================
-- Crea:
--   - La tabla "cobros" (cada pago que registrás manualmente)
--   - Una tabla "config" para guardar ajustes editables (el día de vencimiento)
--
-- CÓMO USAR: pegá todo en el SQL Editor de Supabase y dale Run.
-- ============================================================================


-- 1) TABLA DE COBROS
-- ----------------------------------------------------------------------------
-- Cada fila = un pago registrado. Cubre un "período" (mes) de una empresa.
create table if not exists public.cobros (
    id              uuid primary key default uuid_generate_v4(),
    company_id      uuid not null references public.companies(id) on delete cascade,
    monto           numeric not null,
    medio           text default 'transferencia',  -- transferencia / efectivo / cheque / mercadopago / otro
    periodo         text not null,                  -- "2026-05" (el mes que cubre)
    fecha_pago      date not null default current_date,
    nota            text,                           -- comentario opcional
    created_at      timestamptz default now()
);

comment on table public.cobros is 'Pagos registrados manualmente por el super_admin';

create index if not exists idx_cobros_company on public.cobros(company_id);
create index if not exists idx_cobros_periodo on public.cobros(periodo);


-- 2) TABLA DE CONFIGURACIÓN (ajustes editables)
-- ----------------------------------------------------------------------------
create table if not exists public.config (
    clave           text primary key,
    valor           text not null,
    updated_at      timestamptz default now()
);

comment on table public.config is 'Ajustes globales del sistema (editables)';

-- Guardamos el día de vencimiento (10). Si ya existe, no lo pisa.
insert into public.config (clave, valor)
values ('dia_vencimiento', '10')
on conflict (clave) do nothing;


-- 3) SEGURIDAD (RLS)
-- ----------------------------------------------------------------------------
alter table public.cobros enable row level security;
alter table public.config enable row level security;

-- Solo el super_admin maneja los cobros
drop policy if exists "superadmin gestiona cobros" on public.cobros;
create policy "superadmin gestiona cobros" on public.cobros
    for all using (public.soy_super_admin()) with check (public.soy_super_admin());

-- La config: todos los logueados la pueden leer; solo super_admin la edita
drop policy if exists "todos leen config" on public.config;
create policy "todos leen config" on public.config
    for select using (auth.uid() is not null);

drop policy if exists "superadmin edita config" on public.config;
create policy "superadmin edita config" on public.config
    for all using (public.soy_super_admin()) with check (public.soy_super_admin());


-- ============================================================================
-- Listo. Ya tenés la base de la cobranza.
-- Próximo paso: la pantalla del panel para registrar pagos y ver deudores.
-- ============================================================================
