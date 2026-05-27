'use client';

// ============================================================================
// MAPA EN VIVO · con selector Calles / Satelital
// ----------------------------------------------------------------------------
// Muestra un mapa con los vehículos como puntitos. Cuando llega una posición
// nueva (Supabase Realtime), el punto se mueve solo.
//
// NUEVO: botón arriba para cambiar entre vista de Calles (OpenStreetMap) y
// vista Satelital (fotos del terreno, de Esri, gratis).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { getMiCompanyId } from '@/lib/mi-empresa';

type Posicion = {
  vehicle_id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  bateria: number | null;
  fecha_gps: string;
  icono?: string;
};

// Las dos "capas" de fondo disponibles
const CAPAS = {
  calles: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
  },
  satelital: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
  },
};

export default function MapaEnVivo() {
  const supabase = createClient();

  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const capaFondoRef = useRef<any>(null); // la capa de fondo actual (calles o satelital)
  const marcadoresRef = useRef<{ [vehicleId: string]: any }>({});
  const LRef = useRef<any>(null);
  // ¿El plan del cliente tiene el "seguimiento en vivo" (efecto Google Maps)?
  const seguimientoVivoRef = useRef<boolean>(false);
  // Guarda las animaciones en curso de cada vehículo (para cancelarlas si llega otra posición)
  const animacionesRef = useRef<{ [vehicleId: string]: number }>({});

  const [cargando, setCargando] = useState(true);
  const [vehiculos, setVehiculos] = useState<Posicion[]>([]);
  const [vista, setVista] = useState<'calles' | 'satelital'>('calles');
  const [esCelular, setEsCelular] = useState(false);

  // Detectar si es celular (para apilar mapa arriba / lista abajo)
  useEffect(() => {
    function chequear() {
      const celu = window.innerWidth <= 768;
      setEsCelular(celu);
      // El mapa necesita recalcular su tamaño cuando cambia el layout
      setTimeout(() => mapaRef.current?.invalidateSize?.(), 200);
    }
    chequear();
    window.addEventListener('resize', chequear);
    return () => window.removeEventListener('resize', chequear);
  }, []);

  // -------------------------------------------------------------------------
  // 1) Inicializar el mapa (una sola vez)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      const L = (await import('leaflet')).default;
      if (cancelado || !contenedorRef.current) return;
      LRef.current = L;

      const mapa = L.map(contenedorRef.current, {
        center: [-36.41, -64.29],
        zoom: 11,
        zoomControl: true,
      });

      // Capa de fondo inicial: calles
      capaFondoRef.current = L.tileLayer(CAPAS.calles.url, {
        attribution: CAPAS.calles.attribution,
        maxZoom: 19,
      }).addTo(mapa);

      mapaRef.current = mapa;

      await cargarPosicionesIniciales();
      setCargando(false);
    }

    iniciar();

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
  // Cambiar entre Calles y Satelital
  // -------------------------------------------------------------------------
  function cambiarVista(nueva: 'calles' | 'satelital') {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;

    // Sacamos la capa actual y ponemos la nueva
    if (capaFondoRef.current) {
      mapa.removeLayer(capaFondoRef.current);
    }
    capaFondoRef.current = L.tileLayer(CAPAS[nueva].url, {
      attribution: CAPAS[nueva].attribution,
      maxZoom: 19,
    }).addTo(mapa);

    // La capa de fondo va atrás de los marcadores
    capaFondoRef.current.bringToBack();
    setVista(nueva);
  }

  // -------------------------------------------------------------------------
  // 2) Traer la última posición de cada vehículo
  // -------------------------------------------------------------------------
  async function cargarPosicionesIniciales() {
    // Solo las posiciones de NUESTRA empresa (los clientes se ven en Servicio)
    const miEmpresa = await getMiCompanyId();

    // Averiguamos si el plan de esta empresa tiene "seguimiento en vivo" (premium).
    // 1) buscamos el código de plan de la empresa, 2) miramos si ese plan lo tiene activado.
    try {
      const { data: emp } = await supabase
        .from('companies')
        .select('plan')
        .eq('id', miEmpresa)
        .single();
      if (emp?.plan) {
        const { data: plan } = await supabase
          .from('planes')
          .select('seguimiento_vivo')
          .eq('codigo', emp.plan)
          .single();
        seguimientoVivoRef.current = plan?.seguimiento_vivo === true;
      }
    } catch (_) {
      seguimientoVivoRef.current = false; // ante cualquier duda, sin efecto
    }

    const { data, error } = await supabase
      .from('locations')
      .select('vehicle_id, latitud, longitud, velocidad, bateria, fecha_gps, vehicles(nombre, icono)')
      .eq('company_id', miEmpresa)
      .order('fecha_gps', { ascending: false })
      .limit(200);

    if (error || !data) return;

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
          icono: fila.vehicles?.icono ?? 'auto',
        };
      }
    }

    const lista = Object.values(ultimaPorVehiculo);
    setVehiculos(lista);
    lista.forEach(dibujarOActualizarMarcador);
  }

  // Devuelve la imagen del vehículo según su tipo de ícono.
  // Las imágenes están en public/iconos/ (auto.png, camioneta.png, camion.png, moto.png)
  function imgIcono(tipo: string): string {
    const validos = ['auto', 'camioneta', 'camion', 'moto'];
    const t = validos.includes(tipo) ? tipo : 'auto';
    return `<img src="/iconos/${t}.png" style="width:20px;height:20px;display:block;" />`;
  }

  // Mueve el marcador SUAVEMENTE de su posición actual a la nueva (efecto Google Maps).
  // En vez de saltar, se desliza en ~1.5 segundos. Solo se usa para clientes premium.
  function deslizarMarcador(marcador: any, destinoLat: number, destinoLon: number, vehicleId: string) {
    const inicio = marcador.getLatLng();
    const latIni = inicio.lat;
    const lonIni = inicio.lng;
    const dLat = destinoLat - latIni;
    const dLon = destinoLon - lonIni;

    // Si casi no se movió, lo ponemos directo (no vale la pena animar)
    if (Math.abs(dLat) < 0.000001 && Math.abs(dLon) < 0.000001) {
      marcador.setLatLng([destinoLat, destinoLon]);
      return;
    }

    // Cancelamos cualquier animación anterior de este vehículo
    if (animacionesRef.current[vehicleId]) {
      cancelAnimationFrame(animacionesRef.current[vehicleId]);
    }

    const DURACION = 1500; // milisegundos que tarda en deslizarse
    const t0 = performance.now();

    function paso(ahora: number) {
      let p = (ahora - t0) / DURACION;
      if (p > 1) p = 1;
      // Suavizado (easing): arranca y termina suave, no constante
      const suave = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      marcador.setLatLng([latIni + dLat * suave, lonIni + dLon * suave]);
      if (p < 1) {
        animacionesRef.current[vehicleId] = requestAnimationFrame(paso);
      }
    }
    animacionesRef.current[vehicleId] = requestAnimationFrame(paso);
  }

  // -------------------------------------------------------------------------
  // 3) Dibujar o mover el marcador de un vehículo
  // -------------------------------------------------------------------------
  function dibujarOActualizarMarcador(p: Posicion) {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;

    // ¿Está online? Si la última posición es de hace menos de 5 minutos, sí.
    const minutosDesde = (Date.now() - new Date(p.fecha_gps).getTime()) / 60000;
    const online = minutosDesde < 5;
    const colorCirculo = online ? '#22d97a' : '#ff4d5e'; // verde / rojo
    const glow = online ? 'rgba(34,217,122,0.35)' : 'rgba(255,77,94,0.30)';

    const icono = L.divIcon({
      className: '',
      html: `
        <div style="
          width:34px;height:34px;border-radius:50%;
          background:${colorCirculo};border:3px solid #fff;
          box-shadow:0 0 0 4px ${glow}, 0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        ">${imgIcono(p.icono ?? 'auto')}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const bateriaTxt = p.bateria != null ? `${p.bateria}%` : '—';
    const popup = `
      <div style="font-family:system-ui;min-width:160px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.nombre}</div>
        <div style="font-size:12px;color:#555">
          Velocidad: <b>${Math.round(p.velocidad)} km/h</b><br/>
          Batería: <b>${bateriaTxt}</b><br/>
          Última: <b>${new Date(p.fecha_gps).toLocaleTimeString('es-AR', { hour12: false })}</b>
        </div>
      </div>`;

    const existente = marcadoresRef.current[p.vehicle_id];
    if (existente) {
      // Si el cliente es premium (seguimiento en vivo), el marcador se DESLIZA suave.
      // Si no, salta directo a la posición nueva (como siempre).
      if (seguimientoVivoRef.current) {
        deslizarMarcador(existente, p.latitud, p.longitud, p.vehicle_id);
      } else {
        existente.setLatLng([p.latitud, p.longitud]);
      }
      existente.setPopupContent(popup);
      existente.setIcon(icono);
    } else {
      const marcador = L.marker([p.latitud, p.longitud], { icon: icono })
        .addTo(mapa)
        .bindPopup(popup);
      marcadoresRef.current[p.vehicle_id] = marcador;
    }
  }

  // -------------------------------------------------------------------------
  // 4) Tiempo real
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canal = supabase
      .channel('locations-en-vivo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations' },
        async (payload) => {
          const nueva = payload.new as any;

          // Solo procesamos posiciones de NUESTRA empresa
          const miEmpresa = await getMiCompanyId();
          if (nueva.company_id !== miEmpresa) return;

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
    <div style={{
      display: 'flex',
      flexDirection: esCelular ? 'column' : 'row',
      gap: '18px',
      height: esCelular ? 'auto' : 'calc(100vh - 140px)',
    }}>
      {/* Mapa */}
      <div style={{
        flex: esCelular ? 'none' : 1,
        height: esCelular ? '55vh' : 'auto',
        position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--gris-borde)',
      }}>
        <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />

        {/* Selector Calles / Satelital (flota arriba a la DERECHA del mapa,
            así no se pisa con los controles de zoom que están a la izquierda) */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
          display: 'flex', background: 'var(--gris-oscuro)', borderRadius: '10px',
          padding: '4px', border: '1px solid var(--gris-borde)', gap: '4px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}>
          <button
            onClick={() => cambiarVista('calles')}
            style={{
              padding: '7px 14px', borderRadius: '7px', border: 'none', fontSize: '13px',
              fontWeight: 600, background: vista === 'calles' ? 'var(--azul-electrico)' : 'transparent',
              color: vista === 'calles' ? '#fff' : 'var(--texto-suave)',
            }}
          >
            Calles
          </button>
          <button
            onClick={() => cambiarVista('satelital')}
            style={{
              padding: '7px 14px', borderRadius: '7px', border: 'none', fontSize: '13px',
              fontWeight: 600, background: vista === 'satelital' ? 'var(--azul-electrico)' : 'transparent',
              color: vista === 'satelital' ? '#fff' : 'var(--texto-suave)',
            }}
          >
            Satelital
          </button>
        </div>

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

      {/* Panel lateral (en celular: ancho completo, debajo del mapa) */}
      <div style={{
        width: esCelular ? '100%' : '280px',
        flexShrink: 0,
        background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
        borderRadius: '14px', padding: '18px', overflowY: 'auto',
        maxHeight: esCelular ? '40vh' : 'none',
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
