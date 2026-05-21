-- ============================================================================
-- BBNET TRACK · SUPER-ADMIN · PASO 1: ROL Y PERMISOS
-- ============================================================================
-- Esto hace 3 cosas:
--   1) Permite que el rol de usuario sea 'super_admin' (vos, el dueño)
--   2) Te convierte a VOS en super_admin
--   3) Ajusta los permisos para que el super_admin pueda crear empresas
--      y ver/administrar todo (no solo su propia empresa)
--
-- CÓMO USAR: pegá todo en el SQL Editor de Supabase y dale Run.
-- ============================================================================


-- 1) PERMITIR EL ROL 'super_admin'
-- ----------------------------------------------------------------------------
-- La tabla users tenía un control que solo aceptaba 'admin' u 'operario'.
-- Lo ampliamos para que también acepte 'super_admin'.
alter table public.users drop constraint if exists rol_valido;
alter table public.users add constraint rol_valido
    check (rol in ('super_admin', 'admin', 'operario'));


-- 2) CONVERTIRTE A VOS EN SUPER_ADMIN
-- ----------------------------------------------------------------------------
-- Usamos tu User UID (el mismo que cargamos en el Bloque 1).
update public.users
set rol = 'super_admin'
where id = 'ac740d86-b133-4235-892b-f974ea24354a';


-- 3) FUNCIÓN AUXILIAR: saber si el usuario logueado es super_admin
-- ----------------------------------------------------------------------------
create or replace function public.soy_super_admin()
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1 from public.users
        where id = auth.uid() and rol = 'super_admin'
    );
$$;


-- 4) PERMISOS DE SUPER_ADMIN SOBRE LAS EMPRESAS
-- ----------------------------------------------------------------------------
-- El super_admin puede ver, crear, editar y borrar CUALQUIER empresa
-- (no solo la suya). Estas políticas se suman a las que ya existían.

create policy "superadmin ve todas las empresas" on public.companies
    for select using (public.soy_super_admin());

create policy "superadmin crea empresas" on public.companies
    for insert with check (public.soy_super_admin());

create policy "superadmin edita cualquier empresa" on public.companies
    for update using (public.soy_super_admin());

create policy "superadmin borra empresas" on public.companies
    for delete using (public.soy_super_admin());


-- 5) PERMISOS DE SUPER_ADMIN SOBRE LOS USUARIOS
-- ----------------------------------------------------------------------------
-- El super_admin puede ver y administrar usuarios de cualquier empresa
-- (necesario para crear el admin de cada cliente nuevo).

create policy "superadmin ve todos los usuarios" on public.users
    for select using (public.soy_super_admin());

create policy "superadmin crea usuarios en cualquier empresa" on public.users
    for insert with check (public.soy_super_admin());

create policy "superadmin edita cualquier usuario" on public.users
    for update using (public.soy_super_admin());


-- ============================================================================
-- Listo. Ya sos super_admin y tenés permisos para administrar todo.
-- Próximo paso: la función segura que crea los usuarios (Edge Function).
-- ============================================================================
