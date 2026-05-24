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

const UMBRAL_VEL = 7;     // km/h: por debajo de esto, "quieto" (tolera baile del celular)
const MIN_MINUTOS = 3;    // minutos quieto para contar como parada
const METROS_ALEJARSE = 60; // metros que hay que alejarse para considerar que arrancó

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

      // Detección de paradas (igual criterio que el Historial): para cortar una
      // parada no alcanza con que suba la velocidad, tiene que ALEJARSE de verdad.
      if (inicioParada === null) {
        if (vel < UMBRAL_VEL) inicioParada = i;
      } else {
        const dist = distanciaKm(
          pts[inicioParada].latitud, pts[inicioParada].longitud,
          pts[i].latitud, pts[i].longitud
        ) * 1000; // metros
        if (vel >= UMBRAL_VEL && dist >= METROS_ALEJARSE) {
          if (esParada(pts, inicioParada, i - 1)) paradas++;
          inicioParada = null;
        }
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
      const listaVeh = vehs ?? [];

      // Calculamos vehículo por vehículo (cada uno trae SUS posiciones por separado).
      // Así es imposible que las posiciones de un vehículo "tapen" a las de otro.
      const resultado: ResumenVehiculo[] = [];
      for (const v of listaVeh as any[]) {
        const pts = await traerTodas('vehicle_id', v.id, desde, hasta);
        const calc = calcularDeLista(pts);
        resultado.push({ id: v.id, nombre: v.nombre, ...calc });
      }
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

  // ---- Exportar a PDF (usando la impresión del navegador) ----
  // Arma una página HTML limpia con el logo de BBNet, los datos del período y el
  // contenido según la solapa (flota = tabla / vehículo = detalle), y abre el
  // diálogo de impresión, donde el usuario elige "Guardar como PDF".
  function exportarPDF() {
    const fecha = new Date().toLocaleDateString('es-AR');
    const titulo = vista === 'flota'
      ? 'Reporte de flota'
      : `Reporte de ${unico?.nombre ?? 'vehículo'}`;

    // Logo de BBNet (pin de ubicación, igual al del login) + nombre
    const logo = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#0066ff;display:flex;align-items:center;justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="12" cy="9" r="2.5" stroke="#fff" stroke-width="2"/>
          </svg>
        </div>
        <div>
          <div style="font-size:20px;font-weight:800;color:#0066ff;letter-spacing:-0.5px;">BBNet Track</div>
          <div style="font-size:11px;color:#888;">Sistema de rastreo GPS</div>
        </div>
      </div>`;

    // Cuerpo según la solapa
    let cuerpo = '';
    if (vista === 'flota') {
      const filasHtml = filas.map((f) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">${f.nombre}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${f.km.toFixed(1)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${Math.round(f.velMax)} km/h</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${f.paradas}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${formatHoras(f.minMovimiento)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${formatHoras(f.minDetenido)}</td>
        </tr>`).join('');
      cuerpo = `
        <div style="margin:18px 0;display:flex;gap:24px;flex-wrap:wrap;">
          <div><div style="font-size:22px;font-weight:800;color:#0066ff;">${kmTotal.toFixed(1)} km</div><div style="font-size:11px;color:#888;">Km totales</div></div>
          <div><div style="font-size:22px;font-weight:800;color:#c0392b;">${Math.round(velMaxFlota)} km/h</div><div style="font-size:11px;color:#888;">Velocidad máxima</div></div>
          <div><div style="font-size:22px;font-weight:800;color:#2e7d32;">${vehiculosConActividad}</div><div style="font-size:11px;color:#888;">Vehículos con actividad</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="padding:8px 10px;text-align:left;">Vehículo</th>
            <th style="padding:8px 10px;text-align:right;">Km</th>
            <th style="padding:8px 10px;text-align:right;">Vel. máx</th>
            <th style="padding:8px 10px;text-align:right;">Paradas</th>
            <th style="padding:8px 10px;text-align:right;">En movim.</th>
            <th style="padding:8px 10px;text-align:right;">Detenido</th>
          </tr></thead>
          <tbody>${filasHtml}</tbody>
        </table>`;
    } else if (unico) {
      const barras = kmPorDia.filter((d) => d.km > 0).map((d) => {
        const [, mm, dd] = d.dia.split('-');
        const pct = (d.km / kmMaxDia) * 100;
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;font-size:12px;">
            <span style="width:48px;color:#666;">${dd}/${mm}</span>
            <span style="flex:1;background:#eee;border-radius:4px;height:16px;position:relative;">
              <span style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:#0066ff;border-radius:4px;"></span>
            </span>
            <span style="width:60px;text-align:right;font-weight:600;">${d.km.toFixed(1)} km</span>
          </div>`;
      }).join('');
      cuerpo = `
        <div style="margin:18px 0;display:flex;gap:20px;flex-wrap:wrap;">
          <div><div style="font-size:22px;font-weight:800;color:#0066ff;">${unico.km.toFixed(1)} km</div><div style="font-size:11px;color:#888;">Km recorridos</div></div>
          <div><div style="font-size:22px;font-weight:800;color:#c0392b;">${Math.round(unico.velMax)} km/h</div><div style="font-size:11px;color:#888;">Velocidad máxima</div></div>
          <div><div style="font-size:22px;font-weight:800;color:#2e7d32;">${unico.paradas}</div><div style="font-size:11px;color:#888;">Paradas</div></div>
          <div><div style="font-size:22px;font-weight:800;color:#e67e22;">${formatHoras(unico.minMovimiento)}</div><div style="font-size:11px;color:#888;">En movimiento</div></div>
          <div><div style="font-size:22px;font-weight:800;color:#888;">${formatHoras(unico.minDetenido)}</div><div style="font-size:11px;color:#888;">Detenido</div></div>
        </div>
        <h3 style="font-size:14px;margin:18px 0 10px;">Kilómetros por día</h3>
        ${barras || '<p style="color:#888;font-size:13px;">Sin recorridos en este período.</p>'}`;
    }

    const html = `
      <html><head><title>${titulo}</title><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;color:#222;padding:30px;max-width:800px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0066ff;padding-bottom:14px;">
          ${logo}
          <div style="text-align:right;font-size:12px;color:#666;">
            <div style="font-size:16px;font-weight:700;color:#222;">${titulo}</div>
            <div>Período: ${etiquetaPeriodo}</div>
            <div>Emitido: ${fecha}</div>
          </div>
        </div>
        ${cuerpo}
        <div style="margin-top:40px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center;">
          Informe generado por BBNet Track · www.bbnetsystem.com
        </div>
      </body></html>`;

    const ventana = window.open('', '_blank');
    if (!ventana) {
      alert('Habilitá las ventanas emergentes para poder exportar el PDF.');
      return;
    }
    ventana.document.write(html);
    ventana.document.close();
    // Le damos un momentito para que cargue todo y abrimos el diálogo de imprimir
    setTimeout(() => ventana.print(), 400);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Reportes</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Estadísticas de tu flota · {etiquetaPeriodo}
          </p>
        </div>
        <button onClick={exportarPDF} style={{
          background: 'var(--azul-electrico)', color: '#fff', border: 'none', borderRadius: '9px',
          padding: '11px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Exportar PDF
        </button>
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
