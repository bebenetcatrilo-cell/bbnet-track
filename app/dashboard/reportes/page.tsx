'use client';

// ============================================================================
// SECCIÓN REPORTES · estadísticas de la flota
// ----------------------------------------------------------------------------
// Muestra, para el período elegido:
//   - Totales generales (km de toda la flota, velocidad máx, vehículos activos)
//   - Tabla por vehículo (km, velocidad máx, cantidad de reportes)
//   - Gráfico de barras comparando los km de cada vehículo (SVG, sin librerías)
// ============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

type FilaVehiculo = {
  id: string;
  nombre: string;
  km: number;
  velMax: number;
  reportes: number;
};

// Períodos predefinidos (en días hacia atrás desde hoy)
const PERIODOS = [
  { valor: '1', etiqueta: 'Hoy' },
  { valor: '7', etiqueta: 'Última semana' },
  { valor: '30', etiqueta: 'Último mes' },
];

export default function PaginaReportes() {
  const supabase = createClient();

  const [periodo, setPeriodo] = useState('7');
  const [cargando, setCargando] = useState(true);
  const [filas, setFilas] = useState<FilaVehiculo[]>([]);

  useEffect(() => {
    calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  // Distancia entre dos puntos GPS (Haversine), en km
  function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function calcular() {
    setCargando(true);

    // Fecha de inicio según el período
    const dias = parseInt(periodo, 10);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias + 1);
    desde.setHours(0, 0, 0, 0);

    // Traemos los vehículos y todas las posiciones del período
    const [{ data: vehs }, { data: locs }] = await Promise.all([
      supabase.from('vehicles').select('id, nombre').order('nombre'),
      supabase
        .from('locations')
        .select('vehicle_id, latitud, longitud, velocidad, fecha_gps')
        .gte('fecha_gps', desde.toISOString())
        .order('fecha_gps', { ascending: true }),
    ]);

    const vehiculos = vehs ?? [];
    const posiciones = (locs ?? []) as any[];

    // Agrupamos las posiciones por vehículo
    const porVehiculo: { [id: string]: any[] } = {};
    for (const p of posiciones) {
      if (!p.vehicle_id) continue;
      (porVehiculo[p.vehicle_id] ??= []).push(p);
    }

    // Calculamos km, velocidad máx y reportes para cada vehículo
    const resultado: FilaVehiculo[] = vehiculos.map((v: any) => {
      const pts = porVehiculo[v.id] ?? [];
      let km = 0;
      let velMax = 0;
      for (let i = 0; i < pts.length; i++) {
        velMax = Math.max(velMax, pts[i].velocidad ?? 0);
        if (i > 0) {
          km += distanciaKm(pts[i - 1].latitud, pts[i - 1].longitud, pts[i].latitud, pts[i].longitud);
        }
      }
      return { id: v.id, nombre: v.nombre, km, velMax, reportes: pts.length };
    });

    // Ordenamos por km (el que más anduvo primero)
    resultado.sort((a, b) => b.km - a.km);
    setFilas(resultado);
    setCargando(false);
  }

  // Totales generales
  const kmTotal = filas.reduce((a, f) => a + f.km, 0);
  const velMaxFlota = filas.reduce((a, f) => Math.max(a, f.velMax), 0);
  const vehiculosConActividad = filas.filter((f) => f.reportes > 0).length;
  const kmMaximo = Math.max(1, ...filas.map((f) => f.km)); // para escalar el gráfico

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Reportes</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Estadísticas de tu flota
          </p>
        </div>
        {/* Selector de período */}
        <div style={{ display: 'flex', background: 'var(--gris-oscuro)', borderRadius: '10px', padding: '4px', border: '1px solid var(--gris-borde)', gap: '4px' }}>
          {PERIODOS.map((p) => (
            <button key={p.valor} onClick={() => setPeriodo(p.valor)} style={{
              padding: '8px 14px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: periodo === p.valor ? 'var(--azul-electrico)' : 'transparent',
              color: periodo === p.valor ? '#fff' : 'var(--texto-suave)',
            }}>{p.etiqueta}</button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Calculando...</div>
      ) : (
        <>
          {/* Totales generales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <Tarjeta label="Km totales (flota)" valor={`${kmTotal.toFixed(1)}`} sufijo="km" color="var(--azul-electrico)" />
            <Tarjeta label="Velocidad máxima" valor={`${Math.round(velMaxFlota)}`} sufijo="km/h" color="var(--rojo-offline)" />
            <Tarjeta label="Vehículos con actividad" valor={`${vehiculosConActividad}`} sufijo={`de ${filas.length}`} color="var(--verde-online)" />
            <Tarjeta label="Total de reportes GPS" valor={`${filas.reduce((a, f) => a + f.reportes, 0)}`} sufijo="" color="var(--amarillo)" />
          </div>

          {/* Gráfico de barras: km por vehículo */}
          <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '22px', marginBottom: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '18px' }}>Kilómetros por vehículo</div>
            {filas.filter((f) => f.km > 0).length === 0 ? (
              <div style={{ color: 'var(--texto-suave)', fontSize: '14px' }}>No hay actividad registrada en este período.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filas.filter((f) => f.km > 0).map((f) => (
                  <div key={f.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 600 }}>{f.nombre}</span>
                      <span style={{ color: 'var(--texto-suave)' }}>{f.km.toFixed(1)} km</span>
                    </div>
                    <div style={{ height: '12px', background: 'var(--gris-medio)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${(f.km / kmMaximo) * 100}%`,
                        background: 'linear-gradient(90deg, var(--azul-electrico), var(--azul-brillante))',
                        borderRadius: '6px',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla por vehículo */}
          <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '6px 0', overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, padding: '16px 22px 12px' }}>Detalle por vehículo</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: 'var(--texto-suave)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={s.th}>Vehículo</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Km</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Vel. máx</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Reportes</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid var(--gris-borde)' }}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{f.nombre}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{f.km.toFixed(1)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{Math.round(f.velMax)} km/h</td>
                      <td style={{ ...s.td, textAlign: 'right', color: 'var(--texto-suave)' }}>{f.reportes}</td>
                    </tr>
                  ))}
                  {filas.length === 0 && (
                    <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>No hay vehículos cargados.</td></tr>
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

function Tarjeta({ label, valor, sufijo, color }: { label: string; valor: string; sufijo: string; color: string }) {
  return (
    <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '20px' }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color, letterSpacing: '-1px' }}>
        {valor} <span style={{ fontSize: '14px', color: 'var(--texto-suave)', fontWeight: 500 }}>{sufijo}</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  th: { textAlign: 'left', padding: '10px 22px', fontWeight: 600 },
  td: { padding: '13px 22px' },
};
