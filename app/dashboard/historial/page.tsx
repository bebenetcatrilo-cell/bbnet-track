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
      const { data } = await supabase
        .from('locations')
        .select('fecha_gps')
        .eq('vehicle_id', vehiculoId)
        .gte('fecha_gps', inicio.toISOString())
        .lte('fecha_gps', fin.toISOString());
      const dias = new Set<string>();
      (data ?? []).forEach((r: any) => {
        // Guardamos cada día (YYYY-MM-DD) que tenga al menos una posición
        dias.add(new Date(r.fecha_gps).toISOString().slice(0, 10));
      });
      setDiasConDatos(dias);
    }
    cargarDiasConDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId, mesCalendario]);

  // Cargar la lista de vehículos al inicio
  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('vehicles').select('id, nombre').order('nombre');
      setVehiculos(data ?? []);
      if (data && data.length > 0) setVehiculoId(data[0].id);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buscar el recorrido
  async function buscar() {
    if (!vehiculoId) {
      alert('Elegí un vehículo.');
      return;
    }
    setBuscando(true);
    setYaBuscado(true);

    // El día va de las 00:00 a las 23:59
    const desde = `${fecha}T00:00:00`;
    const hasta = `${fecha}T23:59:59`;

    const { data } = await supabase
      .from('locations')
      .select('latitud, longitud, velocidad, fecha_gps')
      .eq('vehicle_id', vehiculoId)
      .gte('fecha_gps', desde)
      .lte('fecha_gps', hasta)
      .order('fecha_gps', { ascending: true });

    const pts = (data ?? []) as Punto[];
    setPuntos(pts);
    setParadas(calcularParadas(pts));
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
    const { data } = await supabase
      .from('locations')
      .select('latitud, longitud, velocidad, fecha_gps')
      .eq('vehicle_id', vehiculoId)
      .gte('fecha_gps', `${f}T00:00:00`)
      .lte('fecha_gps', `${f}T23:59:59`)
      .order('fecha_gps', { ascending: true });
    const pts = (data ?? []) as Punto[];
    setPuntos(pts);
    setParadas(calcularParadas(pts));
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

  // Detectar paradas: cuando el vehículo se queda casi quieto varios puntos seguidos
  function calcularParadas(pts: Punto[]): Parada[] {
    const resultado: Parada[] = [];
    if (pts.length < 3) return resultado;

    const UMBRAL_VEL = 3; // km/h: por debajo de esto consideramos "quieto"
    const MIN_MINUTOS = 2; // tiene que estar quieto al menos 2 minutos para contar como parada

    let inicioParada: number | null = null;

    for (let i = 0; i < pts.length; i++) {
      const quieto = (pts[i].velocidad ?? 0) < UMBRAL_VEL;

      if (quieto && inicioParada === null) {
        inicioParada = i;
      } else if (!quieto && inicioParada !== null) {
        cerrarParada(pts, inicioParada, i - 1, resultado, MIN_MINUTOS);
        inicioParada = null;
      }
    }
    // Si terminó quieto
    if (inicioParada !== null) {
      cerrarParada(pts, inicioParada, pts.length - 1, resultado, MIN_MINUTOS);
    }
    return resultado;
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
          <MapaHistorial puntos={puntos} paradas={paradas} vista={vista} />
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
