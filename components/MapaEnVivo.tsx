'use client';

// ============================================================================
// MAPA EN VIVO · el corazón del Bloque 3
// ----------------------------------------------------------------------------
// Muestra un mapa de OpenStreetMap con los vehículos como puntitos. Cuando
// llega una posición nueva a la base (Supabase Realtime), el punto se mueve
// solo, sin recargar la página.
//
// Usamos Leaflet directamente (no react-leaflet) porque da menos problemas
// con Next.js y tenemos más control. La librería se carga solo en el navegador.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

// Tipo de dato de cada posición que mostramos en el mapa
type Posicion = {
  vehicle_id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  bateria: number | null;
  fecha_gps: string;
};

export default function MapaEnVivo() {
  const supabase = createClient();

  // Referencias a cosas de Leaflet que viven fuera de React
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const marcadoresRef = useRef<{ [vehicleId: string]: any }>({});
  const LRef = useRef<any>(null); // la librería Leaflet ya cargada

  const [cargando, setCargando] = useState(true);
  const [vehiculos, setVehiculos] = useState<Posicion[]>([]);

  // -------------------------------------------------------------------------
  // 1) Inicializar el mapa (una sola vez, al montar el componente)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      // Cargamos Leaflet dinámicamente (solo en el navegador)
      const L = (await import('leaflet')).default;
      if (cancelado || !contenedorRef.current) return;
      LRef.current = L;

      // Centro del mapa: La Pampa, Argentina (zona de trabajo de BBNet)
      const mapa = L.map(contenedorRef.current, {
        center: [-36.41, -64.29], // Catriló / La Pampa aprox
        zoom: 11,
        zoomControl: true,
      });

      // El "fondo" del mapa: las calles de OpenStreetMap (gratis)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapa);

      mapaRef.current = mapa;

      // Traemos las posiciones iniciales
      await cargarPosicionesIniciales();
      setCargando(false);
    }

    iniciar();

    // Limpieza: cuando salimos de la página, destruimos el mapa
    return () => {
      cancelado = true;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // 2) Traer la última posición de cada vehículo
  // -------------------------------------------------------------------------
  async function cargarPosicionesIniciales() {
    // Traemos las posiciones más recientes con el nombre del vehículo
    const { data, error } = await supabase
      .from('locations')
      .select('vehicle_id, latitud, longitud, velocidad, bateria, fecha_gps, vehicles(nombre)')
      .order('fecha_gps', { ascending: false })
      .limit(200);

    if (error || !data) return;

    // Nos quedamos solo con la posición MÁS RECIENTE de cada vehículo
    const ultimaPorVehiculo: { [id: string]: Posicion } = {};
    for (const fila of data as any[]) {
      const vid = fila.vehicle_id;
      if (!vid) continue;
      if (!ultimaPorVehiculo[vid]) {
        ultimaPorVehiculo[vid] = {
          vehicle_id: vid,
          nombre: fila.vehicles?.nombre ?? 'Vehículo',
          latitud: fila.latitud,
          longitud: fila.longitud,
          velocidad: fila.velocidad ?? 0,
          bateria: fila.bateria,
          fecha_gps: fila.fecha_gps,
        };
      }
    }

    const lista = Object.values(ultimaPorVehiculo);
    setVehiculos(lista);
    lista.forEach(dibujarOActualizarMarcador);
  }

  // -------------------------------------------------------------------------
  // 3) Dibujar o mover el puntito de un vehículo en el mapa
  // -------------------------------------------------------------------------
  function dibujarOActualizarMarcador(p: Posicion) {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;

    // El iconito del vehículo (un círculo azul con glow)
    const icono = L.divIcon({
      className: '',
      html: `
        <div style="
          width:18px;height:18px;border-radius:50%;
          background:#0066ff;border:3px solid #fff;
          box-shadow:0 0 0 4px rgba(0,102,255,0.35), 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const bateriaTxt = p.bateria != null ? `${p.bateria}%` : '—';
    const popup = `
      <div style="font-family:system-ui;min-width:160px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.nombre}</div>
        <div style="font-size:12px;color:#555">
          Velocidad: <b>${Math.round(p.velocidad)} km/h</b><br/>
          Batería: <b>${bateriaTxt}</b><br/>
          Última: <b>${new Date(p.fecha_gps).toLocaleTimeString('es-AR')}</b>
        </div>
      </div>`;

    const existente = marcadoresRef.current[p.vehicle_id];
    if (existente) {
      // Ya existe: solo lo movemos a la nueva posición
      existente.setLatLng([p.latitud, p.longitud]);
      existente.setPopupContent(popup);
    } else {
      // Nuevo: lo creamos
      const marcador = L.marker([p.latitud, p.longitud], { icon: icono })
        .addTo(mapa)
        .bindPopup(popup);
      marcadoresRef.current[p.vehicle_id] = marcador;
    }
  }

  // -------------------------------------------------------------------------
  // 4) Tiempo real: escuchar posiciones nuevas y mover los puntos solos
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canal = supabase
      .channel('locations-en-vivo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations' },
        async (payload) => {
          const nueva = payload.new as any;

          // Buscamos el nombre del vehículo (el INSERT no lo trae)
          const { data: veh } = await supabase
            .from('vehicles')
            .select('nombre')
            .eq('id', nueva.vehicle_id)
            .single();

          const p: Posicion = {
            vehicle_id: nueva.vehicle_id,
            nombre: veh?.nombre ?? 'Vehículo',
            latitud: nueva.latitud,
            longitud: nueva.longitud,
            velocidad: nueva.velocidad ?? 0,
            bateria: nueva.bateria,
            fecha_gps: nueva.fecha_gps,
          };

          dibujarOActualizarMarcador(p);

          // Actualizamos la lista lateral
          setVehiculos((prev) => {
            const otros = prev.filter((v) => v.vehicle_id !== p.vehicle_id);
            return [...otros, p];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', gap: '18px', height: 'calc(100vh - 140px)' }}>
      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--gris-borde)' }}>
        <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />
        {cargando && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'var(--gris-oscuro)', color: 'var(--texto-suave)',
            zIndex: 1000, fontSize: '14px',
          }}>
            Cargando mapa...
          </div>
        )}
      </div>

      {/* Panel lateral con la lista de vehículos */}
      <div style={{
        width: '280px', background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
        borderRadius: '14px', padding: '18px', overflowY: 'auto',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>
          Vehículos ({vehiculos.length})
        </div>
        {vehiculos.length === 0 && !cargando && (
          <div style={{ fontSize: '13px', color: 'var(--texto-suave)' }}>
            Todavía no hay posiciones. Cuando un dispositivo empiece a reportar,
            van a aparecer acá.
          </div>
        )}
        {vehiculos.map((v) => (
          <div
            key={v.vehicle_id}
            onClick={() => {
              const m = marcadoresRef.current[v.vehicle_id];
              if (m && mapaRef.current) {
                mapaRef.current.setView([v.latitud, v.longitud], 14);
                m.openPopup();
              }
            }}
            style={{
              padding: '12px', borderRadius: '10px', background: 'var(--gris-medio)',
              marginBottom: '8px', cursor: 'pointer', border: '1px solid transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--verde-online)', display: 'inline-block',
              }} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{v.nombre}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '6px' }}>
              {Math.round(v.velocidad)} km/h · batería {v.bateria != null ? `${v.bateria}%` : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
