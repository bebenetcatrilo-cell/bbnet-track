'use client';

// ============================================================================
// SECCIÓN SERVICIO · centro de soporte (solo super_admin)
// ----------------------------------------------------------------------------
// Elegís un cliente y ves todo lo suyo para dar soporte:
//   - Resumen (vehículos, dispositivos, online/offline, plan, estado de pago)
//   - Mapa con sus vehículos
//   - Última actividad de cada dispositivo (quién reporta, quién dejó de hacerlo)
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase-client';
import { estaOnline } from '@/lib/estado-online';

const MapaServicio = dynamic(() => import('@/components/MapaServicio'), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--texto-suave)', padding: '40px' }}>Cargando mapa...</div>,
});

type Empresa = {
  id: string;
  nombre: string;
  plan: string;
  limite_dispositivos: number;
  activo: boolean;
};

type DispositivoActividad = {
  id: string;
  nombre: string;
  tipo: string;
  online: boolean;
  bateria: number | null;
  ultima_conexion: string | null;
  vehiculo: string;
};

export default function PaginaServicio() {
  const router = useRouter();
  const supabase = createClient();

  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [cargando, setCargando] = useState(true);

  // Datos del cliente elegido
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [resumen, setResumen] = useState({ vehiculos: 0, dispositivos: 0, online: 0 });
  const [actividad, setActividad] = useState<DispositivoActividad[]>([]);

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single();
      const ok = perfil?.rol === 'super_admin';
      setEsSuperAdmin(ok);
      if (ok) {
        const { data } = await supabase.from('companies').select('id, nombre, plan, limite_dispositivos, activo').order('nombre');
        setEmpresas(data ?? []);
        if (data && data.length > 0) setEmpresaId(data[0].id);
      }
      setCargando(false);
    }
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando cambia la empresa elegida, cargar su detalle
  useEffect(() => {
    if (empresaId) cargarDetalle(empresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function cargarDetalle(id: string) {
    setCargandoDetalle(true);

    const [{ data: vehs }, { data: disps }] = await Promise.all([
      supabase.from('vehicles').select('id, nombre').eq('company_id', id),
      supabase.from('tracker_devices').select('*').eq('company_id', id),
    ]);

    const vehiculos = vehs ?? [];
    const dispositivos = disps ?? [];
    const online = dispositivos.filter((d: any) => estaOnline(d.ultima_conexion)).length;

    setResumen({ vehiculos: vehiculos.length, dispositivos: dispositivos.length, online });

    // Armar la tabla de actividad
    const mapaVeh: { [id: string]: string } = {};
    vehiculos.forEach((v: any) => { mapaVeh[v.id] = v.nombre; });

    const act: DispositivoActividad[] = dispositivos.map((d: any) => ({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      online: estaOnline(d.ultima_conexion),
      bateria: d.bateria,
      ultima_conexion: d.ultima_conexion,
      vehiculo: d.vehicle_id ? (mapaVeh[d.vehicle_id] ?? 'Sin asignar') : 'Sin asignar',
    }));
    setActividad(act);

    setCargandoDetalle(false);
  }

  function tiempoDesde(fecha: string | null): string {
    if (!fecha) return 'Nunca';
    const ms = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const hs = Math.floor(min / 60);
    if (hs < 24) return `Hace ${hs} h`;
    const dias = Math.floor(hs / 24);
    return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
  }

  const empresaActual = empresas.find((e) => e.id === empresaId);

  if (esSuperAdmin === false) {
    return (
      <div style={{ ...s.tarjeta, textAlign: 'center', padding: '50px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Acceso restringido</div>
        <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '8px' }}>
          Esta sección es solo para el super administrador.
        </div>
      </div>
    );
  }

  if (cargando) {
    return <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Servicio</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Centro de soporte · revisá la flota de cualquier cliente
        </p>
      </div>

      {/* Selector de cliente */}
      <div style={{ marginBottom: '22px' }}>
        <label style={s.label}>Cliente a revisar</label>
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={{ ...s.input, maxWidth: '360px' }}>
          {empresas.length === 0 && <option value="">No hay clientes</option>}
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {empresaActual && (
        <>
          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <Tarjeta label="Vehículos" valor={`${resumen.vehiculos}`} color="var(--azul-electrico)" />
            <Tarjeta label="Dispositivos" valor={`${resumen.dispositivos}`} sufijo={`de ${empresaActual.limite_dispositivos}`} color="var(--azul-brillante)" />
            <Tarjeta label="Online ahora" valor={`${resumen.online}`} color="var(--verde-online)" />
            <Tarjeta label="Plan" valor={empresaActual.plan} color="var(--amarillo)" esTexto />
            <Tarjeta label="Estado" valor={empresaActual.activo ? 'Activo' : 'Inactivo'} color={empresaActual.activo ? 'var(--verde-online)' : 'var(--rojo-offline)'} esTexto />
          </div>

          {/* Mapa */}
          <div style={{ height: '380px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--gris-borde)', marginBottom: '22px' }}>
            <MapaServicio companyId={empresaId} key={empresaId} />
          </div>

          {/* Última actividad */}
          <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, padding: '16px 18px 12px' }}>Última actividad de los dispositivos</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: 'var(--texto-suave)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={s.th}>Dispositivo</th>
                    <th style={s.th}>Vehículo</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Estado</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Batería</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Último reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {cargandoDetalle ? (
                    <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>Cargando...</td></tr>
                  ) : actividad.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>Este cliente no tiene dispositivos.</td></tr>
                  ) : (
                    actividad.map((d) => (
                      <tr key={d.id} style={{ borderTop: '1px solid var(--gris-borde)' }}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{d.nombre}</td>
                        <td style={{ ...s.td, color: 'var(--texto-suave)' }}>{d.vehiculo}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <span style={{
                            fontSize: '12px', padding: '3px 9px', borderRadius: '6px', fontWeight: 600,
                            background: d.online ? 'rgba(34,217,122,0.15)' : 'var(--gris-medio)',
                            color: d.online ? 'var(--verde-online)' : 'var(--texto-tenue)',
                          }}>{d.online ? 'Online' : 'Offline'}</span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'right' }}>{d.bateria != null ? `${d.bateria}%` : '—'}</td>
                        <td style={{ ...s.td, textAlign: 'right', color: d.ultima_conexion ? 'var(--texto-suave)' : 'var(--rojo-offline)' }}>
                          {tiempoDesde(d.ultima_conexion)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tarjeta({ label, valor, sufijo, color, esTexto }: { label: string; valor: string; sufijo?: string; color: string; esTexto?: boolean }) {
  return (
    <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ fontSize: esTexto ? '18px' : '26px', fontWeight: 700, color, letterSpacing: '-0.5px', textTransform: esTexto ? 'capitalize' : 'none' }}>
        {valor} {sufijo && <span style={{ fontSize: '13px', color: 'var(--texto-suave)', fontWeight: 500 }}>{sufijo}</span>}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '3px' }}>{label}</div>
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  tarjeta: { background: 'var(--gris-oscuro)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '20px' },
  th: { textAlign: 'left', padding: '12px 18px', fontWeight: 600 },
  td: { padding: '13px 18px' },
  label: { display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginBottom: '5px', fontWeight: 500 },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none',
  },
};
