'use client';

// ============================================================================
// MAPA DE SERVICIO · muestra los vehículos de UNA empresa específica
// ----------------------------------------------------------------------------
// Parecido al mapa en vivo, pero filtrado por la empresa que el super_admin
// elige en el sector Servicio. Se usa para dar soporte: ver dónde están los
// vehículos de ese cliente.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

type Posicion = {
  vehicle_id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  bateria: number | null;
  fecha_gps: string;
};

const CAPAS = {
  calles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satelital: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export default function MapaServicio({ companyId }: { companyId: string }) {
  const supabase = createClient();

  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const capaFondoRef = useRef<any>(null);
  const marcadoresRef = useRef<{ [vehicleId: string]: any }>({});
  const LRef = useRef<any>(null);

  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'calles' | 'satelital'>('calles');
  const [sinDatos, setSinDatos] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    let cancelado = false;
    async function iniciar() {
      const L = (await import('leaflet')).default;
      if (cancelado || !contenedorRef.current) return;
      LRef.current = L;
      const mapa = L.map(contenedorRef.current, { center: [-36.41, -64.29], zoom: 11 });
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
  }, [companyId]);

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

    // Vehículos de esta empresa
    const { data: vehs } = await supabase
      .from('vehicles')
      .select('id, nombre')
      .eq('company_id', companyId);

    if (!vehs || vehs.length === 0) {
      setCargando(false);
      setSinDatos(true);
      return;
    }

    // Última posición de cada vehículo
    const L = LRef.current;
    const mapa = mapaRef.current;
    const puntos: [number, number][] = [];

    for (const v of vehs) {
      const { data: ult } = await supabase
        .from('locations')
        .select('latitud, longitud, velocidad, fecha_gps')
        .eq('vehicle_id', v.id)
        .order('fecha_gps', { ascending: false })
        .limit(1)
        .single();

      if (ult) {
        const marcador = L.marker([ult.latitud, ult.longitud], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:22px;height:22px;border-radius:50%;background:#0066ff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          }),
        }).addTo(mapa);
        marcador.bindPopup(`<b>${v.nombre}</b><br/>${Math.round(ult.velocidad ?? 0)} km/h<br/>${new Date(ult.fecha_gps).toLocaleString('es-AR')}`);
        marcadoresRef.current[v.id] = marcador;
        puntos.push([ult.latitud, ult.longitud]);
      }
    }

    if (puntos.length > 0) {
      mapa.fitBounds(puntos, { padding: [50, 50], maxZoom: 14 });
    } else {
      setSinDatos(true);
    }
    setCargando(false);
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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

      {(cargando || sinDatos) && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--gris-oscuro)', color: 'var(--texto-suave)', fontSize: '14px',
        }}>
          {cargando ? 'Cargando mapa...' : 'Este cliente todavía no tiene posiciones registradas.'}
        </div>
      )}

      <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
