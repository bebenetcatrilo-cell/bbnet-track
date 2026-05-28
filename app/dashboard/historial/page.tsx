'use client';

// ============================================================================
// SECCIÓN HISTORIAL · recorridos por fecha
// ----------------------------------------------------------------------------
// Elegís un vehículo y una fecha, y te muestra:
//   - El recorrido dibujado sobre el mapa (línea + inicio/fin + paradas)
//   - Los datos: km recorridos, velocidad máxima, duración, cantidad de paradas
// ============================================================================

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase-client';
import { getMiCompanyId } from '@/lib/mi-empresa';

const MapaHistorial = dynamic(() => import('@/components/MapaHistorial'), {
  ssr: false,
  loading: () => <div style={{ color: 'var(--texto-suave)', padding: '40px' }}>Cargando mapa...</div>,
});

type Punto = {
  latitud: number;
  longitud: number;
  velocidad: number;
  fecha_gps: string;
};

type Parada = {
  latitud: number;
  longitud: number;
  desde: string;
  hasta: string;
  minutos: number;
};

type Vehiculo = { id: string; nombre: string };

export default function PaginaHistorial() {
  const supabase = createClient();

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculoId, setVehiculoId] = useState('');
  // Fecha por defecto: hoy
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [vista, setVista] = useState<'calles' | 'satelital'>('calles');

  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [yaBuscado, setYaBuscado] = useState(false);
  // ¿El vehículo mostrado usa celular (app) o GPS de hardware (cableado)?
  // Los celulares necesitan filtro de limpieza; el hardware se dibuja tal cual.
  const [esCelular, setEsCelular] = useState(true);

  // Días que tienen recorrido (para marcarlos con puntito en el calendario)
  const [diasConDatos, setDiasConDatos] = useState<Set<string>>(new Set());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  // Mes que se muestra en el calendario (primer día del mes)
  const [mesCalendario, setMesCalendario] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });

  // Cuando cambia el vehículo o el mes mostrado, buscamos qué días tienen datos
  useEffect(() => {
    async function cargarDiasConDatos() {
      if (!vehiculoId) { setDiasConDatos(new Set()); return; }
      const inicio = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1);
      const fin = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0, 23, 59, 59);

      // Traemos las fechas en tandas de 1000 (Supabase limita a 1000 por consulta).
      // Solo pedimos la columna fecha_gps, que es liviana, para saber qué días
      // tienen recorrido y marcarlos con el puntito en el calendario.
      const TANDA = 1000;
      let pagina = 0;
      const dias = new Set<string>();
      while (true) {
        const { data, error } = await supabase
          .from('locations')
          .select('fecha_gps')
          .eq('vehicle_id', vehiculoId)
          .gte('fecha_gps', inicio.toISOString())
          .lte('fecha_gps', fin.toISOString())
          .order('fecha_gps', { ascending: true })
          .range(pagina * TANDA, pagina * TANDA + TANDA - 1);
        if (error || !data || data.length === 0) break;
        data.forEach((r: any) => {
          dias.add(new Date(r.fecha_gps).toISOString().slice(0, 10));
        });
        if (data.length < TANDA) break;
        pagina++;
        if (pagina > 200) break; // tope de seguridad
      }
      setDiasConDatos(dias);
    }
    cargarDiasConDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId, mesCalendario]);

  // Cargar la lista de vehículos al inicio
  useEffect(() => {
    async function cargar() {
      const miEmpresa = await getMiCompanyId();
      const { data } = await supabase.from('vehicles').select('id, nombre').eq('company_id', miEmpresa).order('nombre');
      setVehiculos(data ?? []);
      if (data && data.length > 0) setVehiculoId(data[0].id);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trae TODAS las posiciones de un vehículo en un día, en tandas de 1000.
  // Supabase devuelve máximo 1000 filas por consulta, así que paginamos para
  // no perder posiciones en días con mucho recorrido (más de 1000 puntos).
  // Averigua si el vehículo usa celular (app) o GPS de hardware (cableado).
  // Mira el dispositivo vinculado a ese vehículo en tracker_devices.
  async function averiguarTipoDispositivo(vehId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('tracker_devices')
        .select('tipo')
        .eq('vehicle_id', vehId)
        .maybeSingle();
      // Si es gps_cableado => NO es celular (devolvemos false = no filtrar fuerte)
      // Cualquier otro caso (celular, o sin dato) => tratamos como celular (filtrar)
      return data?.tipo !== 'gps_cableado';
    } catch (_) {
      return true; // ante la duda, filtramos (más seguro para no dejar telar)
    }
  }

  async function traerPosiciones(vehId: string, dia: string): Promise<Punto[]> {
    const TANDA = 1000;
    const desde = `${dia}T00:00:00`;
    const hasta = `${dia}T23:59:59`;
    let pagina = 0;
    let todas: Punto[] = [];
    while (true) {
      const { data, error } = await supabase
        .from('locations')
        .select('latitud, longitud, velocidad, fecha_gps')
        .eq('vehicle_id', vehId)
        .gte('fecha_gps', desde)
        .lte('fecha_gps', hasta)
        .order('fecha_gps', { ascending: true })
        .range(pagina * TANDA, pagina * TANDA + TANDA - 1);
      if (error || !data || data.length === 0) break;
      todas = todas.concat(data as Punto[]);
      if (data.length < TANDA) break; // era la última tanda
      pagina++;
      if (pagina > 200) break; // tope de seguridad
    }
    return todas;
  }

  // Buscar el recorrido
  async function buscar() {
    if (!vehiculoId) {
      alert('Elegí un vehículo.');
      return;
    }
    setBuscando(true);
    setYaBuscado(true);

    const celular = await averiguarTipoDispositivo(vehiculoId);
    setEsCelular(celular);
    const pts = await traerPosiciones(vehiculoId, fecha);
    setPuntos(pts);
    setParadas(calcularParadas(pts, celular));
    setBuscando(false);
  }

  // Navega al día anterior o siguiente QUE TENGA datos.
  // direccion: -1 = anterior, +1 = siguiente
  function navegarDia(direccion: number) {
    // Ordenamos los días con datos (vienen del calendario del mes actual)
    const dias = Array.from(diasConDatos).sort();
    if (dias.length === 0) return;

    // Buscamos la posición del día actual en la lista
    const idx = dias.indexOf(fecha);

    let nuevoDia: string | null = null;
    if (idx === -1) {
      // El día actual no está en la lista: vamos al más cercano según dirección
      if (direccion < 0) {
        nuevoDia = [...dias].reverse().find((d) => d < fecha) ?? null;
      } else {
        nuevoDia = dias.find((d) => d > fecha) ?? null;
      }
    } else {
      const nuevoIdx = idx + direccion;
      if (nuevoIdx >= 0 && nuevoIdx < dias.length) nuevoDia = dias[nuevoIdx];
    }

    if (nuevoDia) {
      setFecha(nuevoDia);
      // Buscamos automáticamente el recorrido del nuevo día
      setTimeout(() => buscarFecha(nuevoDia!), 0);
    }
  }

  // Versión de buscar que recibe una fecha directa (para la navegación)
  async function buscarFecha(f: string) {
    if (!vehiculoId) return;
    setBuscando(true);
    setYaBuscado(true);
    const celular = await averiguarTipoDispositivo(vehiculoId);
    setEsCelular(celular);
    const pts = await traerPosiciones(vehiculoId, f);
    setPuntos(pts);
    setParadas(calcularParadas(pts, celular));
    setBuscando(false);
  }

  // ¿Hay día anterior/siguiente con datos? (para habilitar/deshabilitar botones)
  const diasOrdenados = Array.from(diasConDatos).sort();
  const hayAnterior = diasOrdenados.some((d) => d < fecha);
  const haySiguiente = diasOrdenados.some((d) => d > fecha);

  // ---- Cálculos del recorrido ----

  // Distancia entre dos puntos GPS (fórmula de Haversine), en km
  function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Kilómetros totales: suma de las distancias entre puntos consecutivos
  const kmTotales = puntos.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const ant = puntos[i - 1];
    return acc + distanciaKm(ant.latitud, ant.longitud, p.latitud, p.longitud);
  }, 0);

  // Velocidad máxima
  const velMax = puntos.reduce((max, p) => Math.max(max, p.velocidad ?? 0), 0);

  // Duración (entre el primer y último punto)
  const duracionMin =
    puntos.length >= 2
      ? Math.round(
          (new Date(puntos[puntos.length - 1].fecha_gps).getTime() -
            new Date(puntos[0].fecha_gps).getTime()) /
            60000
        )
      : 0;

  // Detectar paradas: cuando el vehículo se queda casi quieto varios puntos seguidos.
  // Pensado para tolerar el "baile" del GPS de celular (que salta de velocidad y de
  // posición unos metros aunque el auto esté parado).
  function calcularParadas(pts: Punto[], celular: boolean = true): Parada[] {
    const resultado: Parada[] = [];
    if (pts.length < 3) return resultado;

    const UMBRAL_VEL = 7;      // km/h: por debajo de esto consideramos "quieto" (antes 3)
    const MIN_MINUTOS = 3;     // tiene que estar quieto al menos 3 minutos para contar
    const METROS_ALEJARSE = 60; // tiene que alejarse al menos 60m del punto de parada para que "arranque" de verdad

    let inicioParada: number | null = null;

    for (let i = 0; i < pts.length; i++) {
      const vel = pts[i].velocidad ?? 0;

      if (inicioParada === null) {
        // No estamos en una parada: si se queda quieto, arranca una posible parada
        if (vel < UMBRAL_VEL) inicioParada = i;
      } else {
        // Estamos en una parada. Para considerar que "arrancó" de verdad, no alcanza
        // con que la velocidad suba un toque: tiene que ALEJARSE físicamente del lugar.
        // Así los saltitos del GPS del celular no cortan la parada.
        const dist = distanciaKm(
          pts[inicioParada].latitud, pts[inicioParada].longitud,
          pts[i].latitud, pts[i].longitud
        ) * 1000; // en metros

        if (vel >= UMBRAL_VEL && dist >= METROS_ALEJARSE) {
          // Arrancó de verdad: cerramos la parada en el punto anterior
          cerrarParada(pts, inicioParada, i - 1, resultado, MIN_MINUTOS);
          inicioParada = null;
        }
      }
    }
    // Si terminó quieto
    if (inicioParada !== null) {
      cerrarParada(pts, inicioParada, pts.length - 1, resultado, MIN_MINUTOS);
    }

    // FUSIÓN: solo para celulares (el baile del GPS de celu genera paradas
    // amontonadas). El GPS de hardware reporta limpio, no hace falta fusionar.
    return celular ? fusionarParadasCercanas(resultado) : resultado;
  }

  // Junta paradas que están a menos de DISTANCIA_FUSION metros entre sí.
  function fusionarParadasCercanas(paradas: Parada[]): Parada[] {
    if (paradas.length <= 1) return paradas;
    const DISTANCIA_FUSION = 80; // metros: paradas más cerca que esto = una sola
    const fusionadas: Parada[] = [];

    for (const par of paradas) {
      const ultima = fusionadas[fusionadas.length - 1];
      if (ultima) {
        const dist = distanciaKm(ultima.latitud, ultima.longitud, par.latitud, par.longitud) * 1000;
        if (dist < DISTANCIA_FUSION) {
          // Está pegada a la anterior: las unimos (extendemos el tiempo hasta esta)
          ultima.hasta = par.hasta;
          ultima.minutos = Math.round(
            (new Date(par.hasta).getTime() - new Date(ultima.desde).getTime()) / 60000
          );
          continue; // no la agregamos como parada nueva
        }
      }
      fusionadas.push({ ...par });
    }
    return fusionadas;
  }

  function cerrarParada(pts: Punto[], desde: number, hasta: number, out: Parada[], minMin: number) {
    const min = Math.round(
      (new Date(pts[hasta].fecha_gps).getTime() - new Date(pts[desde].fecha_gps).getTime()) / 60000
    );
    if (min >= minMin) {
      out.push({
        latitud: pts[desde].latitud,
        longitud: pts[desde].longitud,
        desde: pts[desde].fecha_gps,
        hasta: pts[hasta].fecha_gps,
        minutos: min,
      });
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Historial</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Mirá el recorrido de un vehículo en una fecha
        </p>
      </div>

      {/* Selectores */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={s.label}>Vehículo</label>
          <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} style={s.input}>
            {vehiculos.length === 0 && <option value="">No hay vehículos</option>}
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 1 180px', position: 'relative' }}>
          <label style={s.label}>Fecha</label>
          <button
            type="button"
            onClick={() => setMostrarCalendario(!mostrarCalendario)}
            style={{ ...s.input, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>{fecha.split('-').reverse().join('/')}</span>
            <span style={{ color: 'var(--texto-tenue)' }}>📅</span>
          </button>
          {mostrarCalendario && (
            <CalendarioConPuntitos
              fechaSeleccionada={fecha}
              mes={mesCalendario}
              diasConDatos={diasConDatos}
              onCambiarMes={setMesCalendario}
              onElegirDia={(d) => { setFecha(d); setMostrarCalendario(false); }}
              onCerrar={() => setMostrarCalendario(false)}
            />
          )}
        </div>
        <button onClick={buscar} disabled={buscando} style={{ ...s.botonPrimario, opacity: buscando ? 0.6 : 1 }}>
          {buscando ? 'Buscando...' : 'Buscar recorrido'}
        </button>
        {/* Navegación rápida entre días con datos */}
        {yaBuscado && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navegarDia(-1)}
              disabled={!hayAnterior}
              title="Día anterior con recorrido"
              style={{ ...s.botonNav, opacity: hayAnterior ? 1 : 0.35, cursor: hayAnterior ? 'pointer' : 'default' }}
            >‹ Día anterior</button>
            <button
              type="button"
              onClick={() => navegarDia(1)}
              disabled={!haySiguiente}
              title="Día siguiente con recorrido"
              style={{ ...s.botonNav, opacity: haySiguiente ? 1 : 0.35, cursor: haySiguiente ? 'pointer' : 'default' }}
            >Día siguiente ›</button>
          </div>
        )}
      </div>

      {/* Tarjetas de datos */}
      {yaBuscado && puntos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          <Tarjeta label="Distancia" valor={`${kmTotales.toFixed(1)} km`} color="var(--azul-electrico)" />
          <Tarjeta label="Velocidad máx" valor={`${Math.round(velMax)} km/h`} color="var(--rojo-offline)" />
          <Tarjeta label="Duración" valor={`${duracionMin} min`} color="var(--amarillo)" />
          <Tarjeta label="Paradas" valor={`${paradas.length}`} color="var(--verde-online)" />
        </div>
      )}

      {/* Mapa */}
      <div style={{ position: 'relative', height: 'calc(100vh - 320px)', minHeight: '380px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--gris-borde)' }}>
        {/* Selector de vista */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          display: 'flex', background: 'var(--gris-oscuro)', borderRadius: '10px',
          padding: '4px', border: '1px solid var(--gris-borde)', gap: '4px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}>
          {(['calles', 'satelital'] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} style={{
              padding: '7px 14px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600,
              background: vista === v ? 'var(--azul-electrico)' : 'transparent',
              color: vista === v ? '#fff' : 'var(--texto-suave)', textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>

        {!yaBuscado ? (
          <div style={s.aviso}>Elegí un vehículo y una fecha, después tocá "Buscar recorrido".</div>
        ) : puntos.length === 0 ? (
          <div style={s.aviso}>No hay recorrido para ese vehículo en esa fecha.</div>
        ) : (
          <MapaHistorial puntos={puntos} paradas={paradas} vista={vista} esCelular={esCelular} />
        )}
      </div>
    </div>
  );
}

function Tarjeta({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{valor}</div>
      <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  botonPrimario: {
    background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
    border: 'none', borderRadius: '10px', padding: '11px 18px', color: '#fff',
    fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 18px var(--azul-glow)', height: '44px',
  },
  label: { display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginBottom: '5px', fontWeight: 500 },
  botonNav: {
    background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '9px',
    padding: '11px 14px', color: 'var(--texto)', fontSize: '13px', fontWeight: 600, height: '44px', whiteSpace: 'nowrap',
  },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none', height: '44px',
  },
  aviso: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--gris-oscuro)', color: 'var(--texto-suave)', fontSize: '14px', textAlign: 'center', padding: '20px',
  },
};

// ============================================================================
// CALENDARIO CON PUNTITOS · marca los días que tienen recorrido
// ============================================================================
function CalendarioConPuntitos({
  fechaSeleccionada, mes, diasConDatos, onCambiarMes, onElegirDia, onCerrar,
}: {
  fechaSeleccionada: string;
  mes: Date;
  diasConDatos: Set<string>;
  onCambiarMes: (d: Date) => void;
  onElegirDia: (dia: string) => void;
  onCerrar: () => void;
}) {
  const año = mes.getFullYear();
  const mesNum = mes.getMonth();
  const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const diasSemana = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  // Primer día del mes y cuántos días tiene
  const primerDia = new Date(año, mesNum, 1).getDay(); // 0=domingo
  const diasEnMes = new Date(año, mesNum + 1, 0).getDate();
  const hoy = new Date().toISOString().slice(0, 10);

  // Armamos las celdas: huecos al inicio + días
  const celdas: (number | null)[] = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  function fechaDe(dia: number): string {
    const m = String(mesNum + 1).padStart(2, '0');
    const dd = String(dia).padStart(2, '0');
    return `${año}-${m}-${dd}`;
  }

  return (
    <>
      {/* Fondo para cerrar al hacer clic afuera */}
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
      <div style={{
        position: 'absolute', top: '76px', left: 0, zIndex: 51,
        background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
        borderRadius: '12px', padding: '14px', width: '280px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Cabecera: mes y flechas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <button type="button" onClick={() => onCambiarMes(new Date(año, mesNum - 1, 1))}
            style={calBtn}>‹</button>
          <span style={{ fontWeight: 600, color: 'var(--texto)', fontSize: '14px' }}>
            {nombresMes[mesNum]} {año}
          </span>
          <button type="button" onClick={() => onCambiarMes(new Date(año, mesNum + 1, 1))}
            style={calBtn}>›</button>
        </div>

        {/* Días de la semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {diasSemana.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--texto-tenue)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Días del mes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={`v${i}`} />;
            const f = fechaDe(dia);
            const tieneData = diasConDatos.has(f);
            const esSeleccionado = f === fechaSeleccionada;
            const esHoy = f === hoy;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onElegirDia(f)}
                style={{
                  position: 'relative', aspectRatio: '1', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '13px', fontWeight: esSeleccionado ? 700 : 500,
                  background: esSeleccionado ? 'var(--azul-electrico)' : 'transparent',
                  color: esSeleccionado ? '#fff' : esHoy ? 'var(--azul-brillante)' : 'var(--texto)',
                  outline: esHoy && !esSeleccionado ? '1px solid var(--azul-electrico)' : 'none',
                }}
              >
                {dia}
                {/* Puntito si ese día tiene recorrido */}
                {tieneData && (
                  <span style={{
                    position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)',
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: esSeleccionado ? '#fff' : 'var(--verde-online)',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '11px', color: 'var(--texto-tenue)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--verde-online)', display: 'inline-block' }} />
          Días con recorrido
        </div>
      </div>
    </>
  );
}

const calBtn: React.CSSProperties = {
  background: 'var(--negro)', border: '1px solid var(--gris-borde)', borderRadius: '8px',
  color: 'var(--texto)', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px',
};
