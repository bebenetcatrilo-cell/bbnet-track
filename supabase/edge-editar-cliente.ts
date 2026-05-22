// ============================================================================
// EDGE FUNCTION: editar-cliente
// ----------------------------------------------------------------------------
// Permite al super_admin editar TODOS los datos de un cliente desde el panel,
// de forma segura:
//   1) Verifica que quien llama sea super_admin (vos)
//   2) Actualiza los datos de la empresa
//   3) Actualiza el perfil del usuario admin (nombre, email)
//   4) Si se mandó una contraseña nueva, la cambia (reseteo)
//   5) Si se cambió el email, lo actualiza también en el login
//
// La llave maestra (service_role) NUNCA sale de acá.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- Verificar que quien llama sea super_admin ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autorizado' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: errUser } = await supabaseAdmin.auth.getUser(token);
    if (errUser || !user) return json({ error: 'No autorizado' }, 401);

    const { data: perfil } = await supabaseAdmin
      .from('users').select('rol').eq('id', user.id).single();
    if (perfil?.rol !== 'super_admin') {
      return json({ error: 'Solo el super administrador puede editar clientes' }, 403);
    }

    // --- Leer los datos que mandó el panel ---
    const body = await req.json();
    const {
      empresa_id,
      empresa_nombre,
      empresa_telefono,
      empresa_email,
      empresa_direccion,
      plan,
      limite_dispositivos,
      activo,
      admin_id,           // el usuario admin del cliente (para email/contraseña)
      admin_nombre,
      admin_email,
      admin_password,     // opcional: solo si se quiere resetear
    } = body;

    if (!empresa_id) return json({ error: 'Falta el ID de la empresa' }, 400);

    // --- 1) Actualizar datos de la EMPRESA ---
    const updateEmpresa: Record<string, unknown> = {};
    if (empresa_nombre !== undefined) updateEmpresa.nombre = empresa_nombre;
    if (empresa_telefono !== undefined) updateEmpresa.telefono = empresa_telefono || null;
    if (empresa_email !== undefined) updateEmpresa.email = empresa_email || null;
    if (empresa_direccion !== undefined) updateEmpresa.direccion = empresa_direccion || null;
    if (plan !== undefined) updateEmpresa.plan = plan;
    if (limite_dispositivos !== undefined) updateEmpresa.limite_dispositivos = limite_dispositivos;
    if (activo !== undefined) updateEmpresa.activo = activo;

    if (Object.keys(updateEmpresa).length > 0) {
      const { error } = await supabaseAdmin
        .from('companies').update(updateEmpresa).eq('id', empresa_id);
      if (error) return json({ error: 'Error al actualizar la empresa: ' + error.message }, 400);
    }

    // --- 2) Actualizar el USUARIO admin (si nos mandaron su id) ---
    if (admin_id) {
      // Perfil (nombre, email en la tabla users)
      const updatePerfil: Record<string, unknown> = {};
      if (admin_nombre !== undefined) updatePerfil.nombre = admin_nombre;
      if (admin_email !== undefined) updatePerfil.email = admin_email;
      if (Object.keys(updatePerfil).length > 0) {
        await supabaseAdmin.from('users').update(updatePerfil).eq('id', admin_id);
      }

      // Email y/o contraseña en el LOGIN (auth) — esto requiere la llave maestra
      const updateAuth: Record<string, unknown> = {};
      if (admin_email) updateAuth.email = admin_email;
      if (admin_password) {
        if (admin_password.length < 6) {
          return json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' }, 400);
        }
        updateAuth.password = admin_password;
      }
      if (Object.keys(updateAuth).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(admin_id, updateAuth);
        if (error) return json({ error: 'Error al actualizar el login: ' + error.message }, 400);
      }
    }

    return json({ ok: true, mensaje: 'Cliente actualizado correctamente' });
  } catch (e) {
    return json({ error: 'Error inesperado: ' + (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
