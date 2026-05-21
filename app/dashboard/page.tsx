// ============================================================================
// DASHBOARD · página principal
// ----------------------------------------------------------------------------
// La primera pantalla al entrar. Por ahora muestra unas tarjetas de resumen
// que YA leen datos reales de tu base (cantidad de vehículos, dispositivos,
// etc.). El mapa en vivo y lo demás vienen en los próximos bloques.
// ============================================================================

import { createClient } from '@/lib/supabase-server';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Contamos cosas reales de la base (gracias a RLS, solo cuenta las de tu empresa)
  const [{ count: vehiculos }, { count: dispositivos }, { count: jornadas }] =
    await Promise.all([
      supabase.from('vehicles').select('*', { count: 'exact', head: true }),
      supabase.from('tracker_devices').select('*', { count: 'exact', head: true }),
      supabase.from('work_sessions').select('*', { count: 'exact', head: true }),
    ]);

  const tarjetas = [
    { label: 'Vehículos', valor: vehiculos ?? 0, icono: '⊞', color: 'var(--azul-electrico)' },
    { label: 'Dispositivos', valor: dispositivos ?? 0, icono: '⊡', color: 'var(--verde-online)' },
    { label: 'Jornadas registradas', valor: jornadas ?? 0, icono: '↻', color: 'var(--amarillo)' },
    { label: 'Online ahora', valor: 0, icono: '◎', color: 'var(--azul-brillante)' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Dashboard</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Resumen general de tu flota
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          marginBottom: '28px',
        }}
      >
        {tarjetas.map((t) => (
          <div
            key={t.label}
            style={{
              background: 'var(--gris-oscuro)',
              border: '1px solid var(--gris-borde)',
              borderRadius: '14px',
              padding: '22px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '11px',
                background: 'var(--gris-medio)',
                color: t.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                marginBottom: '16px',
              }}
            >
              {t.icono}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>{t.valor}</div>
            <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Aviso de próximos pasos */}
      <div
        style={{
          background: 'var(--gris-oscuro)',
          border: '1px solid var(--gris-borde)',
          borderRadius: '14px',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>◎</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>El mapa en vivo viene en el próximo bloque</h2>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '8px', maxWidth: '440px', margin: '8px auto 0' }}>
          Por ahora el login, la seguridad multiempresa y el esqueleto del panel
          están funcionando. En el Bloque 3 sumamos el mapa con los vehículos en
          tiempo real.
        </p>
      </div>
    </div>
  );
}
