// ============================================================================
// EDGE FUNCTION: crear-cliente
// ----------------------------------------------------------------------------
// Esta función vive en el servidor de Supabase (lugar seguro). Crea un cliente
// nuevo COMPLETO en un solo paso:
//   1) Verifica que quien llama sea super_admin (vos)
//   2) Crea la empresa
//   3) Crea el usuario admin (con mail y contraseña) usando la llave maestra
//   4) Vincula el usuario admin a la empresa
//
// La llave maestra (service_role) NUNCA sale de acá. El panel solo le manda
// los datos; la función hace el trabajo pesado de forma segura.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Permitir el "pre-vuelo" del navegador (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1) Cliente con la llave MAESTRA (service_role) ---
    // Esta llave la lee del entorno seguro de Supabase, nunca del panel.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // --- 2) Verificar que quien llama sea super_admin ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'No autorizado' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: errUser } = await supabaseAdmin.auth.getUser(token);
    if (errUser || !user) {
      return json({ error: 'No autorizado' }, 401);
    }
    // ¿Es super_admin?
    const { data: perfil } = await supabaseAdmin
      .from('users')
      .select('rol')
      .eq('id', user.id)
      .single();
    if (perfil?.rol !== 'super_admin') {
      return json({ error: 'Solo el super administrador puede crear clientes' }, 403);
    }

    // --- 3) Leer los datos que mandó el panel ---
    const body = await req.json();
    const {
      empresa_nombre,
      empresa_slug,
      empresa_telefono,
      empresa_email,
      empresa_direccion,
      plan,
      limite_dispositivos,
      admin_nombre,
      admin_email,
      admin_password,
    } = body;

    if (!empresa_nombre || !admin_email || !admin_password) {
      return json({ error: 'Faltan datos obligatorios (empresa, mail y contraseña del admin)' }, 400);
    }

    // --- 4) Crear la EMPRESA ---
    const { data: empresa, error: errEmpresa } = await supabaseAdmin
      .from('companies')
      .insert({
        nombre: empresa_nombre,
        slug: empresa_slug || empresa_nombre.toLowerCase().replace(/\s+/g, '-'),
        telefono: empresa_telefono || null,
        email: empresa_email || null,
        direccion: empresa_direccion || null,
        plan: plan || 'trial',
        limite_dispositivos: limite_dispositivos || 5,
        activo: true,
      })
      .select('id')
      .single();

    if (errEmpresa) {
      return json({ error: 'Error al crear la empresa: ' + errEmpresa.message }, 400);
    }

    // --- 5) Crear el USUARIO admin (con la llave maestra) ---
    const { data: nuevoUsuario, error: errAuth } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true, // queda activo al toque, sin mail de confirmación
    });

    if (errAuth || !nuevoUsuario.user) {
      // Si falló crear el usuario, borramos la empresa para no dejar basura
      await supabaseAdmin.from('companies').delete().eq('id', empresa.id);
      return json({ error: 'Error al crear el usuario: ' + (errAuth?.message ?? 'desconocido') }, 400);
    }

    // --- 6) Vincular el usuario admin a la empresa (perfil) ---
    const { error: errPerfil } = await supabaseAdmin.from('users').insert({
      id: nuevoUsuario.user.id,
      company_id: empresa.id,
      nombre: admin_nombre || admin_email,
      email: admin_email,
      rol: 'admin',
      activo: true,
    });

    if (errPerfil) {
      return json({ error: 'Error al vincular el usuario: ' + errPerfil.message }, 400);
    }

    // --- Listo ---
    return json({
      ok: true,
      empresa_id: empresa.id,
      usuario_id: nuevoUsuario.user.id,
      mensaje: 'Cliente creado correctamente',
    });
  } catch (e) {
    return json({ error: 'Error inesperado: ' + (e as Error).message }, 500);
  }
});

// Helper para responder en formato JSON con los headers de CORS
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
