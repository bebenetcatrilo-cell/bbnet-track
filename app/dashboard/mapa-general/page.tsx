'use client';

// ============================================================================
// SECCIÓN MAPA GENERAL · centro de control (solo super_admin)
// ----------------------------------------------------------------------------
// Muestra TODOS los vehículos de TODOS los clientes en un solo mapa.
//   - Verde = online / Rojo = offline
//   - Filtro por cliente (o ver todos)
//   - Para detectar de un vistazo quién está funcionando y quién no
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase-client';

const MapaGeneral = dynamic(() => import('@/components/MapaGeneral'), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--texto-suave)', padding: '40px' }}>Cargando mapa...</div>,
});

type Empresa = { id: string; nombre: string };

export default function PaginaMapaGeneral() {
  const router = useRouter();
  const supabase = createClient();

  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState(''); // '' = todos

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single();
      if (perfil?.rol !== 'super_admin') {
        setEsSuperAdmin(false);
        return;
      }
      setEsSuperAdmin(true);
      const { data } = await supabase.from('companies').select('id, nombre').order('nombre');
      setEmpresas(data ?? []);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (esSuperAdmin === false) {
    return (
      <div style={{ padding: '40px', color: 'var(--texto-suave)' }}>
        Esta sección es solo para el administrador.
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Mapa General</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Todos los vehículos de todos los clientes · verde online, rojo offline
        </p>
      </div>

      {/* Filtro por cliente */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '13px', color: 'var(--texto-suave)', fontWeight: 500 }}>Filtrar por cliente:</label>
        <select
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
          style={{
            background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
            borderRadius: '9px', padding: '10px 14px', color: 'var(--texto)', fontSize: '14px',
            minWidth: '260px',
          }}
        >
          <option value="">Todos los clientes</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* El mapa ocupa el resto del alto */}
      <div style={{ flex: 1, minHeight: '420px' }}>
        <MapaGeneral filtroEmpresa={filtroEmpresa} />
      </div>
    </div>
  );
}
