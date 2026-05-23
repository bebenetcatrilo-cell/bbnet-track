'use client';

// ============================================================================
// MAPA GENERAL · muestra TODOS los vehículos de TODOS los clientes
// ----------------------------------------------------------------------------
// Solo para super_admin. Centro de control para soporte:
//   - Ve todos los vehículos de todos los clientes en un solo mapa
//   - Color verde = online (reportó hace poco) / rojo = offline
//   - Al tocar un punto: cliente, vehículo, velocidad, batería, última conexión
//   - Filtro por cliente (para enfocarse en uno)
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { estaOnline } from '@/lib/estado-online';

type PuntoVehiculo = {
  vehicle_id: string;
  nombre: string;
  empresa: string;
  company_id: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  bateria: number | null;
  fecha_gps: string;
  online: boolean;
};

const CAPAS = {
  calles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satelital: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export default function MapaGeneral({ filtroEmpresa }: { filtroEmpresa: string }) {
  const supabase = createClient();

  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const capaFondoRef = useRef<any>(null);
  const marcadoresRef = useRef<{ [vehicleId: string]: any }>({});
  const LRef = useRef<any>(null);

  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'calles' | 'satelital'>('calles');
  const [sinDatos, setSinDatos] = useState(false);
  const [resumen, setResumen] = useState({ total: 0, online: 0, offline: 0 });

  // Inicializar mapa
  useEffect(() => {
    let cancelado = false;
    async function iniciar() {
      const L = (await import('leaflet')).default;
      if (cancelado || !contenedorRef.current) return;
      LRef.current = L;
      const mapa = L.map(contenedorRef.current, { center: [-36.41, -64.29], zoom: 7 });
      capaFondoRef.current = L.tileLayer(CAPAS.calles, { maxZoom: 19 }).addTo(mapa);
      mapaRef.current = mapa;
      await cargarPosiciones();
    }
    iniciar();
    return () => {
      cancelado = true;
      if (mapaRef.current) { mapaRef.current.remove(); mapaRef.current = null; }
      marcadoresRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEmpresa]);

  // Cambiar capa de fondo
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;
    if (capaFondoRef.current) mapa.removeLayer(capaFondoRef.current);
    capaFondoRef.current = L.tileLayer(CAPAS[vista], { maxZoom: 19 }).addTo(mapa);
    capaFondoRef.current.bringToBack();
  }, [vista]);

  async function cargarPosiciones() {
    setCargando(true);
    setSinDatos(false);

    // 1) Traemos todos los vehículos con su empresa
    let queryVeh = supabase
      .from('vehicles')
      .select('id, nombre, company_id, companies(nombre)');
    if (filtroEmpresa) queryVeh = queryVeh.eq('company_id', filtroEmpresa);
    const { data: vehs } = await queryVeh;

    if (!vehs || vehs.length === 0) {
      setCargando(false);
      setSinDatos(true);
      setResumen({ total: 0, online: 0, offline: 0 });
      return;
    }

    const L = LRef.current;
    const mapa = mapaRef.current;
    const puntos: [number, number][] = [];
    let online = 0, offline = 0;

    // Limpiamos marcadores anteriores
    Object.values(marcadoresRef.current).forEach((m: any) => mapa.removeLayer(m));
    marcadoresRef.current = {};

    // 2) Última posición de cada vehículo
    for (const v of vehs as any[]) {
      const { data: ult } = await supabase
        .from('locations')
        .select('latitud, longitud, velocidad, bateria, fecha_gps')
        .eq('vehicle_id', v.id)
        .order('fecha_gps', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ult) {
        const empresaNombre = v.companies?.nombre ?? 'Sin empresa';
        const online_ = estaOnline(ult.fecha_gps);
        if (online_) online++; else offline++;

        const color = online_ ? '#22d97a' : '#ff4d5e'; // verde / rojo
        const marcador = L.marker([ult.latitud, ult.longitud], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          }),
        }).addTo(mapa);

        const bateriaTxt = ult.bateria != null ? `${ult.bateria}%` : '—';
        const estadoTxt = online_ ? '🟢 Online' : '🔴 Offline';
        marcador.bindPopup(
          `<b>${empresaNombre}</b><br/>` +
          `🚗 ${v.nombre}<br/>` +
          `${estadoTxt}<br/>` +
          `${Math.round(ult.velocidad ?? 0)} km/h · Batería: ${bateriaTxt}<br/>` +
          `Última: ${new Date(ult.fecha_gps).toLocaleString('es-AR', { hour12: false })}`
        );
        marcadoresRef.current[v.id] = marcador;
        puntos.push([ult.latitud, ult.longitud]);
      } else {
        offline++;
      }
    }

    setResumen({ total: vehs.length, online, offline });

    if (puntos.length > 0) {
      mapa.fitBounds(puntos, { padding: [50, 50], maxZoom: 14 });
    } else {
      setSinDatos(true);
    }
    setCargando(false);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Resumen arriba a la izquierda */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
        display: 'flex', gap: '8px', background: 'var(--gris-oscuro)', borderRadius: '10px',
        padding: '8px 12px', border: '1px solid var(--gris-borde)', fontSize: '13px',
      }}>
        <span style={{ color: 'var(--texto)' }}><b>{resumen.total}</b> total</span>
        <span style={{ color: '#22d97a' }}>🟢 <b>{resumen.online}</b></span>
        <span style={{ color: '#ff4d5e' }}>🔴 <b>{resumen.offline}</b></span>
      </div>

      {/* Selector de capa */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
        display: 'flex', background: 'var(--gris-oscuro)', borderRadius: '10px',
        padding: '4px', border: '1px solid var(--gris-borde)', gap: '4px',
      }}>
        <button onClick={() => setVista('calles')} style={botonCapa(vista === 'calles')}>Calles</button>
        <button onClick={() => setVista('satelital')} style={botonCapa(vista === 'satelital')}>Satélite</button>
      </div>

      {cargando && (
        <div style={avisoEstilo}>Cargando vehículos...</div>
      )}
      {sinDatos && !cargando && (
        <div style={avisoEstilo}>No hay vehículos con posiciones para mostrar.</div>
      )}

      <div ref={contenedorRef} style={{ width: '100%', height: '100%', borderRadius: '14px' }} />
    </div>
  );
}

function botonCapa(activo: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600,
    background: activo ? 'var(--azul-electrico)' : 'transparent',
    color: activo ? '#fff' : 'var(--texto-suave)',
  };
}

const avisoEstilo: React.CSSProperties = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  zIndex: 1000, background: 'var(--gris-oscuro)', color: 'var(--texto-suave)',
  padding: '12px 20px', borderRadius: '10px', fontSize: '14px', border: '1px solid var(--gris-borde)',
};
