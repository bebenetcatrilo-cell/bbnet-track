'use client';

// ============================================================================
// SECCIÓN REPORTES · estadísticas de la flota  (versión ampliada)
// ----------------------------------------------------------------------------
// Tiene DOS vistas:
//
//   1) FLOTA  → resumen de todos los vehículos en el período elegido:
//        - Totales (km, vel. máx, vehículos activos, tiempo en movimiento)
//        - Tabla por vehículo: km, vel. máx, paradas, tiempo movimiento/detenido
//        - Gráfico de barras de km por vehículo
//
//   2) UN VEHÍCULO → el detalle de un solo vehículo en el período:
//        - Sus totales (km, vel. máx, paradas, tiempo movimiento/detenido)
//        - Gráfico de barras de KM POR DÍA (lo más vistoso para el cliente)
//
// Se puede elegir el período con botones rápidos (hoy / semana / mes) o
// poniendo las fechas a mano (rango personalizado).
//
// Todos los cálculos usan la MISMA lógica del Historial (Haversine + orden por
// fecha_gps + paradas a <3 km/h por +2 min), así los números coinciden siempre.
// ============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { getMiCompanyId } from '@/lib/mi-empresa';

type Punto = {
  vehicle_id: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  fecha_gps: string;
};

type Vehiculo = { id: string; nombre: string };

type ResumenVehiculo = {
  id: string;
  nombre: string;
  km: number;
  velMax: number;
  reportes: number;
  paradas: number;
  minMovimiento: number;
  minDetenido: number;
};

type DiaKm = { dia: string; km: number };

const PERIODOS = [
  { valor: '1', etiqueta: 'Hoy' },
  { valor: '7', etiqueta: 'Última semana' },
  { valor: '30', etiqueta: 'Último mes' },
];

const UMBRAL_VEL = 3;     // km/h: por debajo de esto, "quieto"
const MIN_MINUTOS = 2;    // minutos quieto para contar como parada

export default function PaginaReportes() {
  const supabase = createClient();

  const [vista, setVista] = useState<'flota' | 'vehiculo'>('flota');

  const [periodo, setPeriodo] = useState('7');
  const [usaFechas, setUsaFechas] = useState(false);
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().slice(0, 10));

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculoSel, setVehiculoSel] = useState('');

  const [cargando, setCargando] = useState(true);
  const [filas, setFilas] = useState<ResumenVehiculo[]>([]);
  const [kmPorDia, setKmPorDia] = useState<DiaKm[]>([]);

  function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calcularDeLista(pts: Punto[]): Omit<ResumenVehiculo, 'id' | 'nombre'> {
    let km = 0;
    let velMax = 0;
    let minMovimiento = 0;
    let minDetenido = 0;
    let paradas = 0;
    let inicioParada: number | null = null;

    for (let i = 0; i < pts.length; i++) {
      const vel = pts[i].velocidad ?? 0;
      velMax = Math.max(velMax, vel);

      if (i > 0) {
        const ant = pts[i - 1];
        km += distanciaKm(ant.latitud, ant.longitud, pts[i].latitud, pts[i].longitud);
        const minTramo =
          (new Date(pts[i].fecha_gps).getTime() - new Date(ant.fecha_gps).getTime()) / 60000;
        if (minTramo > 0 && minTramo < 30) {
          if (vel < UMBRAL_VEL) minDetenido += minTramo;
          else minMovimiento += minTramo;
        }
      }

      const quieto = vel < UMBRAL_VEL;
      if (quieto && inicioParada === null) {
        inicioParada = i;
      } else if (!quieto && inicioParada !== null) {
        if (esParada(pts, inicioParada, i - 1)) paradas++;
        inicioParada = null;
      }
    }
    if (inicioParada !== null && esParada(pts, inicioParada, pts.length - 1)) paradas++;

    return {
      km,
      velMax,
      reportes: pts.length,
      paradas,
      minMovimiento: Math.round(minMovimiento),
      minDetenido: Math.round(minDetenido),
    };
  }

  function esParada(pts: Punto[], desde: number, hasta: number): boolean {
    const min =
      (new Date(pts[hasta].fecha_gps).getTime() - new Date(pts[desde].fecha_gps).getTime()) / 60000;
    return min >= MIN_MINUTOS;
  }

  useEffect(() => {
    async function cargar() {
      const miEmpresa = await getMiCompanyId();
      const { data } = await supabase
        .from('vehicles')
        .select('id, nombre')
        .eq('company_id', miEmpresa)
        .order('nombre');
      const vehs = data ?? [];
      setVehiculos(vehs);
      if (vehs.length > 0) setVehiculoSel(vehs[0].id);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, usaFechas, fechaDesde, fechaHasta, vista, vehiculoSel]);

  function rangoFechas(): { desde: Date; hasta: Date } {
    if (usaFechas) {
      const desde = new Date(`${fechaDesde}T00:00:00`);
      const hasta = new Date(`${fechaHasta}T23:59:59`);
      return { desde, hasta };
    }
    const dias = parseInt(periodo, 10);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias + 1);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date();
    hasta.setHours(23, 59, 59, 999);
    return { desde, hasta };
  }

  // Trae TODAS las posiciones en tandas de 1000 (Supabase limita a 1000 por consulta).
  // columna: 'company_id' (vista flota) o 'vehicle_id' (vista un vehículo).
  async function traerTodas(
    columna: 'company_id' | 'vehicle_id',
    valor: string,
    desde: Date,
    hasta: Date
  ): Promise<Punto[]> {
    const TANDA = 1000;
    let pagina = 0;
    let todas: Punto[] = [];
    while (true) {
      const { data, error } = await supabase
        .from('locations')
        .select('vehicle_id, latitud, longitud, velocidad, fecha_gps')
        .eq(columna, valor)
        .gte('fecha_gps', desde.toISOString())
        .lte('fecha_gps', hasta.toISOString())
        .order('fecha_gps', { ascending: true })
        .range(pagina * TANDA, pagina * TANDA + TANDA - 1);
      if (error || !data || data.length === 0) break;
      todas = todas.concat(data as Punto[]);
      if (data.length < TANDA) break; // era la última tanda
      pagina++;
      if (pagina > 200) break; // tope de seguridad (200.000 posiciones)
    }
    return todas;
  }

  async function calcular() {
    setCargando(true);
    const miEmpresa = await getMiCompanyId();
    const { desde, hasta } = rangoFechas();

    if (vista === 'flota') {
      const { data: vehs } = await supabase
        .from('vehicles').select('id, nombre').eq('company_id', miEmpresa).order('nombre');
      const posiciones = await traerTodas('company_id', miEmpresa as string, desde, hasta);

      const listaVeh = vehs ?? [];

      const porVehiculo: { [id: string]: Punto[] } = {};
      for (const p of posiciones) {
        if (!p.vehicle_id) continue;
        (porVehiculo[p.vehicle_id] ??= []).push(p);
      }

      const resultado: ResumenVehiculo[] = listaVeh.map((v: any) => {
        const pts = porVehiculo[v.id] ?? [];
        const calc = calcularDeLista(pts);
        return { id: v.id, nombre: v.nombre, ...calc };
      });
      resultado.sort((a, b) => b.km - a.km);
      setFilas(resultado);
      setKmPorDia([]);
    } else {
      if (!vehiculoSel) {
        setFilas([]);
        setKmPorDia([]);
        setCargando(false);
        return;
      }
      const pts = await traerTodas('vehicle_id', vehiculoSel, desde, hasta);
      const veh = vehiculos.find((v) => v.id === vehiculoSel);
      const calc = calcularDeLista(pts);
      setFilas([{ id: vehiculoSel, nombre: veh?.nombre ?? 'Vehículo', ...calc }]);

      const porDia: { [dia: string]: Punto[] } = {};
      for (const p of pts) {
        const dia = p.fecha_gps.slice(0, 10);
        (porDia[dia] ??= []).push(p);
      }
      const dias: DiaKm[] = Object.keys(porDia)
        .sort()
        .map((dia) => ({ dia, km: calcularDeLista(porDia[dia]).km }));
      setKmPorDia(dias);
    }
    setCargando(false);
  }

  const kmTotal = filas.reduce((a, f) => a + f.km, 0);
  const velMaxFlota = filas.reduce((a, f) => Math.max(a, f.velMax), 0);
  const vehiculosConActividad = filas.filter((f) => f.reportes > 0).length;
  const kmMaximo = Math.max(1, ...filas.map((f) => f.km));
  const minMovTotal = filas.reduce((a, f) => a + f.minMovimiento, 0);

  const unico = filas.length === 1 ? filas[0] : null;
  const kmMaxDia = Math.max(1, ...kmPorDia.map((d) => d.km));

  function formatHoras(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} min`;
    return `${h}h ${m}m`;
  }

  const etiquetaPeriodo = usaFechas
    ? `${fechaDesde.split('-').reverse().join('/')} al ${fechaHasta.split('-').reverse().join('/')}`
    : PERIODOS.find((p) => p.valor === periodo)?.etiqueta ?? '';

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Reportes</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Estadísticas de tu flota · {etiquetaPeriodo}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '4px', background: 'var(--gris-oscuro)', borderRadius: '10px', padding: '4px', border: '1px solid var(--gris-borde)', marginBottom: '18px', width: 'fit-content' }}>
        <button onClick={() => setVista('flota')} style={tab(vista === 'flota')}>Toda la flota</button>
        <button onClick={() => setVista('vehiculo')} style={tab(vista === 'vehiculo')}>Un vehículo</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
        {vista === 'vehiculo' && (
          <div style={{ flex: '1 1 220px', maxWidth: '320px' }}>
            <label style={s.label}>Vehículo</label>
            <select value={vehiculoSel} onChange={(e) => setVehiculoSel(e.target.value)} style={s.input}>
              {vehiculos.length === 0 && <option value="">No hay vehículos</option>}
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={s.label}>Período</label>
          <div style={{ display: 'flex', background: 'var(--gris-oscuro)', borderRadius: '10px', padding: '4px', border: '1px solid var(--gris-borde)', gap: '4px' }}>
            {PERIODOS.map((p) => (
              <button key={p.valor} onClick={() => { setPeriodo(p.valor); setUsaFechas(false); }} style={{
                padding: '8px 14px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600,
                background: !usaFechas && periodo === p.valor ? 'var(--azul-electrico)' : 'transparent',
                color: !usaFechas && periodo === p.valor ? '#fff' : 'var(--texto-suave)',
              }}>{p.etiqueta}</button>
            ))}
            <button onClick={() => setUsaFechas(true)} style={{
              padding: '8px 14px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: usaFechas ? 'var(--azul-electrico)' : 'transparent',
              color: usaFechas ? '#fff' : 'var(--texto-suave)',
            }}>Fechas a mano</button>
          </div>
        </div>

        {usaFechas && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label style={s.label}>Desde</label>
              <input type="date" value={fechaDesde} max={fechaHasta} onChange={(e) => setFechaDesde(e.target.value)} style={{ ...s.input, width: '150px' }} />
            </div>
            <div>
              <label style={s.label}>Hasta</label>
              <input type="date" value={fechaHasta} min={fechaDesde} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFechaHasta(e.target.value)} style={{ ...s.input, width: '150px' }} />
            </div>
          </div>
        )}
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Calculando...</div>
      ) : vista === 'flota' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <Tarjeta label="Km totales (flota)" valor={kmTotal.toFixed(1)} sufijo="km" color="var(--azul-electrico)" />
            <Tarjeta label="Velocidad máxima" valor={`${Math.round(velMaxFlota)}`} sufijo="km/h" color="var(--rojo-offline)" />
            <Tarjeta label="Vehículos con actividad" valor={`${vehiculosConActividad}`} sufijo={`de ${filas.length}`} color="var(--verde-online)" />
            <Tarjeta label="Tiempo en movimiento" valor={formatHoras(minMovTotal)} sufijo="" color="var(--amarillo)" />
          </div>

          <div style={panel}>
            <div style={tituloPanel}>Kilómetros por vehículo</div>
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
                    <div style={barraFondo}>
                      <div style={{ ...barraRelleno, width: `${(f.km / kmMaximo) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '6px 0', overflow: 'hidden' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, padding: '16px 22px 12px' }}>Detalle por vehículo</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: 'var(--texto-suave)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={s.th}>Vehículo</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Km</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Vel. máx</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Paradas</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>En movim.</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Detenido</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid var(--gris-borde)' }}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{f.nombre}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{f.km.toFixed(1)}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{Math.round(f.velMax)} km/h</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{f.paradas}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: 'var(--verde-online)' }}>{formatHoras(f.minMovimiento)}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: 'var(--texto-suave)' }}>{formatHoras(f.minDetenido)}</td>
                    </tr>
                  ))}
                  {filas.length === 0 && (
                    <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>No hay vehículos cargados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {!unico || unico.reportes === 0 ? (
            <div style={{ ...panel, textAlign: 'center', color: 'var(--texto-suave)' }}>
              No hay actividad de este vehículo en el período elegido.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                <Tarjeta label="Km recorridos" valor={unico.km.toFixed(1)} sufijo="km" color="var(--azul-electrico)" />
                <Tarjeta label="Velocidad máxima" valor={`${Math.round(unico.velMax)}`} sufijo="km/h" color="var(--rojo-offline)" />
                <Tarjeta label="Paradas" valor={`${unico.paradas}`} sufijo="" color="var(--verde-online)" />
                <Tarjeta label="En movimiento" valor={formatHoras(unico.minMovimiento)} sufijo="" color="var(--amarillo)" />
                <Tarjeta label="Detenido" valor={formatHoras(unico.minDetenido)} sufijo="" color="var(--texto-suave)" />
              </div>

              <div style={panel}>
                <div style={tituloPanel}>Kilómetros por día</div>
                {kmPorDia.filter((d) => d.km > 0).length === 0 ? (
                  <div style={{ color: 'var(--texto-suave)', fontSize: '14px' }}>Sin recorridos en este período.</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '220px', overflowX: 'auto', paddingTop: '10px' }}>
                    {kmPorDia.map((d) => {
                      const alturaPct = (d.km / kmMaxDia) * 100;
                      const [, mm, dd] = d.dia.split('-');
                      return (
                        <div key={d.dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '34px', flex: '1 0 34px', height: '100%' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: 'var(--texto-suave)', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                              {d.km >= 1 ? d.km.toFixed(0) : d.km.toFixed(1)}
                            </span>
                            <div title={`${d.km.toFixed(1)} km`} style={{
                              width: '70%', height: `${Math.max(alturaPct, 2)}%`,
                              background: 'linear-gradient(180deg, var(--azul-brillante), var(--azul-electrico))',
                              borderRadius: '5px 5px 0 0', minHeight: '3px',
                            }} />
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--texto-tenue)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                            {dd}/{mm}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={panel}>
                <div style={tituloPanel}>Resumen del período</div>
                <div style={{ fontSize: '14px', lineHeight: 1.9, color: 'var(--texto)' }}>
                  El vehículo <b>{unico.nombre}</b> recorrió <b>{unico.km.toFixed(1)} km</b> en total
                  {kmPorDia.filter((d) => d.km > 0).length > 0 && (
                    <> a lo largo de <b>{kmPorDia.filter((d) => d.km > 0).length} día(s)</b> con actividad</>
                  )}.
                  Alcanzó una velocidad máxima de <b>{Math.round(unico.velMax)} km/h</b>,
                  hizo <b>{unico.paradas} parada(s)</b>,
                  estuvo <b>{formatHoras(unico.minMovimiento)}</b> en movimiento
                  y <b>{formatHoras(unico.minDetenido)}</b> detenido.
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Tarjeta({ label, valor, sufijo, color }: { label: string; valor: string; sufijo: string; color: string }) {
  return (
    <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '20px' }}>
      <div style={{ fontSize: '26px', fontWeight: 700, color, letterSpacing: '-1px' }}>
        {valor} {sufijo && <span style={{ fontSize: '14px', color: 'var(--texto-suave)', fontWeight: 500 }}>{sufijo}</span>}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function tab(activo: boolean): React.CSSProperties {
  return {
    padding: '9px 18px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600,
    background: activo ? 'var(--azul-electrico)' : 'transparent',
    color: activo ? '#fff' : 'var(--texto-suave)', cursor: 'pointer',
  };
}

const panel: React.CSSProperties = {
  background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
  borderRadius: '14px', padding: '22px', marginBottom: '24px',
};
const tituloPanel: React.CSSProperties = { fontSize: '15px', fontWeight: 700, marginBottom: '18px' };
const barraFondo: React.CSSProperties = { height: '12px', background: 'var(--gris-medio)', borderRadius: '6px', overflow: 'hidden' };
const barraRelleno: React.CSSProperties = {
  height: '100%', background: 'linear-gradient(90deg, var(--azul-electrico), var(--azul-brillante))', borderRadius: '6px',
};

const s: { [k: string]: React.CSSProperties } = {
  th: { textAlign: 'left', padding: '10px 22px', fontWeight: 600 },
  td: { padding: '13px 22px' },
  label: { display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginBottom: '5px', fontWeight: 500 },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none', height: '44px',
  },
};
