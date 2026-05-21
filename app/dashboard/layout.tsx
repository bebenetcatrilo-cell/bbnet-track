// ============================================================================
// LAYOUT DEL DASHBOARD · el marco del panel admin
// ----------------------------------------------------------------------------
// Este es el "marco" del panel: el menú lateral de la izquierda y el header
// de arriba. Todo lo que vaya dentro del panel (mapa, vehículos, historial)
// se va a mostrar dentro de este marco. Por ahora es el esqueleto.
//
// Como es un Server Component, acá ya verificamos quién es el usuario logueado
// y traemos su nombre y empresa desde la base.
// ============================================================================

import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Traemos el perfil del usuario (nombre, rol) y el nombre de su empresa
  const { data: perfil } = await supabase
    .from('users')
    .select('nombre, rol, companies(nombre)')
    .eq('id', user.id)
    .single();

  const nombreUsuario = perfil?.nombre ?? 'Usuario';
  const rol = perfil?.rol ?? 'operario';
  // companies puede venir como objeto; tomamos el nombre con cuidado
  const empresa =
    (perfil?.companies as { nombre?: string } | null)?.nombre ?? 'Mi empresa';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar empresa={empresa} rol={rol} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header superior */}
        <header
          style={{
            height: '64px',
            borderBottom: '1px solid var(--gris-borde)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 28px',
            background: 'rgba(19,24,34,0.6)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{nombreUsuario}</div>
            <div style={{ fontSize: '12px', color: 'var(--texto-suave)', textTransform: 'capitalize' }}>
              {rol}
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              marginLeft: '14px',
              background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '15px',
              color: '#fff',
            }}
          >
            {nombreUsuario.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Contenido de cada página */}
        <main style={{ flex: 1, padding: '28px' }}>{children}</main>
      </div>
    </div>
  );
}
