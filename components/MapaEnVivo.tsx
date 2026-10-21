'use client';

// ============================================================================
// MAPA EN VIVO · v1.4.0 · Mapa MODERNO (MapLibre)
// ----------------------------------------------------------------------------
// Muestra un mapa con los vehículos como puntitos. Cuando llega una posición
// nueva (Supabase Realtime), el punto se mueve solo.
//
// NUEVO EN v1.4.0: se cambió el motor del mapa de Leaflet a MapLibre para tener
// un mapa MODERNO (tipo Google). Tres capas con el botón de arriba:
//   - Calles   → OpenFreeMap Liberty (moderno, gratis, sin API key)
//   - Satelital → Esri (fotos del terreno, gratis)
//   - Híbrido  → Esri satélite + nombres de calles encima
//
// MapLibre se carga desde CDN acá adentro, así NO hay que tocar package.json.
// Si algún día querés volver al mapa viejo, se reemplaza este archivo por el
// anterior (Leaflet) y listo.
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

type Vista = 'calles' | 'satelital' | 'hibrido';

// Capa de CALLES moderna (OpenFreeMap). Es una URL de estilo vectorial.
const ESTILO_CALLES = 'https://tiles.openfreemap.org/styles/liberty';

// Arma un estilo de SATÉLITE (Esri). Si conLabels=true, suma los nombres de
// calles encima (vista Híbrida).
function estiloSatelital(conLabels: boolean) {
  const sources: any = {
    'esri-sat': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
    },
  };
  const layers: any[] = [{ id: 'sat', type: 'raster', source: 'esri-sat' }];
  if (conLabels) {
    sources['esri-ref'] = {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri',
    };
    layers.push({ id: 'ref', type: 'raster', source: 'esri-ref' });
  }
  return { version: 8, sources, layers };
}

// Carga la librería MapLibre (JS + CSS) desde CDN una sola vez.
async function cargarMapLibre(): Promise<any> {
  if ((window as any).maplibregl) return (window as any).maplibregl;

  // CSS (controles, popups)
  if (!document.getElementById('maplibre-css')) {
    const link = document.createElement('link');
    link.id = 'maplibre-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
    document.head.appendChild(link);
  }

  // JS
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar MapLibre'));
    document.head.appendChild(s);
  });

  return (window as any).maplibregl;
}

export default function MapaEnVivo() {
  const supabase = createClient();

  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const mlRef = useRef<any>(null); // la librería maplibregl
  // Por cada vehículo guardamos su marcador, su popup y su elemento HTML
  const marcadoresRef = useRef<{ [vehicleId: string]: { marker: any; popup: any; el: HTMLDivElement } }>({});
  // ¿El plan del cliente tiene el "seguimiento en vivo" (efecto Google Maps)?
  const seguimientoVivoRef = useRef<boolean>(false);
  // Guarda las animaciones en curso de cada vehículo (para cancelarlas si llega otra)
  const animacionesRef = useRef<{ [vehicleId: string]: number }>({});

  const [cargando, setCargando] = useState(true);
  const [vehiculos, setVehiculos] = useState<Posicion[]>([]);
  const [vista, setVista] = useState<Vista>('calles');
  const [esCelular, setEsCelular] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [listaAbierta, setListaAbierta] = useState(false);

  // Detectar si es celular (para apilar mapa arriba / lista abajo)
  useEffect(() => {
    function chequear() {
      const celu = window.innerWidth <= 768;
      setEsCelular(celu);
      setTimeout(() => mapaRef.current?.resize?.(), 200);
    }
    chequear();
    window.addEventListener('resize', chequear);
    return () => window.removeEventListener('resize', chequear);
  }, []);

  // Pantalla completa: agranda el mapa a TODA la pantalla. MapLibre necesita
  // resize() cuando cambia de tamaño, si no quedan mosaicos grises.
  function togglePantallaCompleta() {
    setPantallaCompleta((prev) => !prev);
    setTimeout(() => mapaRef.current?.resize?.(), 160);
  }

  // Salir de pantalla completa con la tecla ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && pantallaCompleta) {
        setPantallaCompleta(false);
        setTimeout(() => mapaRef.current?.resize?.(), 160);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pantallaCompleta]);

  // -------------------------------------------------------------------------
  // 1) Inicializar el mapa (una sola vez)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      let maplibregl: any;
      try {
        maplibregl = await cargarMapLibre();
      } catch (e) {
        if (!cancelado) setCargando(false);
        return;
      }
      if (cancelado || !contenedorRef.current) return;
      mlRef.current = maplibregl;

      const mapa = new maplibregl.Map({
        container: contenedorRef.current,
        style: ESTILO_CALLES,
        center: [-64.29, -36.41], // OJO: MapLibre usa [longitud, latitud]
        zoom: 10,
        attributionControl: { compact: true },
      });
      mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

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
  // Cambiar de capa (Calles / Satelital / Híbrido)
  // Los marcadores NO se borran al cambiar de estilo (son overlays HTML).
  // -------------------------------------------------------------------------
  function cambiarVista(nueva: Vista) {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (nueva === 'calles') mapa.setStyle(ESTILO_CALLES);
    else if (nueva === 'satelital') mapa.setStyle(estiloSatelital(false) as any);
    else mapa.setStyle(estiloSatelital(true) as any);
    setVista(nueva);
  }

  // -------------------------------------------------------------------------
  // 2) Traer la última posición de cada vehículo
  // -------------------------------------------------------------------------
  async function cargarPosicionesIniciales() {
    const miEmpresa = await getMiCompanyId();
    if (!miEmpresa) return;

    // Posiciones y vehículos EN PARALELO, SIN join (rápido).
    const [posRes, vehRes] = await Promise.all([
      supabase
        .from('locations')
        .select('vehicle_id, latitud, longitud, velocidad, bateria, fecha_gps')
        .eq('company_id', miEmpresa)
        .order('fecha_gps', { ascending: false })
        .limit(200),
      supabase
        .from('vehicles')
        .select('id, nombre, icono')
        .eq('company_id', miEmpresa),
    ]);

    if (posRes.error || !posRes.data) return;

    const infoVeh: { [id: string]: { nombre: string; icono: string } } = {};
    for (const v of (vehRes.data as any[]) || []) {
      infoVeh[v.id] = { nombre: v.nombre ?? 'Vehículo', icono: v.icono ?? 'auto' };
    }

    const ultimaPorVehiculo: { [id: string]: Posicion } = {};
    for (const fila of posRes.data as any[]) {
      const vid = fila.vehicle_id;
      if (!vid) continue;
      if (!ultimaPorVehiculo[vid]) {
        ultimaPorVehiculo[vid] = {
          vehicle_id: vid,
          nombre: infoVeh[vid]?.nombre ?? 'Vehículo',
          latitud: fila.latitud,
          longitud: fila.longitud,
          velocidad: fila.velocidad ?? 0,
          bateria: fila.bateria,
          fecha_gps: fila.fecha_gps,
          icono: infoVeh[vid]?.icono ?? 'auto',
        };
      }
    }

    const lista = Object.values(ultimaPorVehiculo);
    setVehiculos(lista);
    lista.forEach(dibujarOActualizarMarcador);

    // Chequeo de plan premium (seguimiento en vivo) DESPUÉS de dibujar.
    try {
      const { data: emp } = await supabase
        .from('companies')
        .select('plan')
        .eq('id', miEmpresa)
        .maybeSingle();
      if (emp?.plan) {
        const { data: plan } = await supabase
          .from('planes')
          .select('seguimiento_vivo')
          .eq('codigo', emp.plan)
          .maybeSingle();
        seguimientoVivoRef.current = plan?.seguimiento_vivo === true;
      } else {
        seguimientoVivoRef.current = false;
      }
    } catch (_) {
      seguimientoVivoRef.current = false;
    }
  }

  // Imagen del vehículo según su tipo de ícono (public/iconos/*.png)
  function imgIcono(tipo: string): string {
    const validos = ['auto', 'camioneta', 'camion', 'moto'];
    const t = validos.includes(tipo) ? tipo : 'auto';
    return `<img src="/iconos/${t}.png" style="width:20px;height:20px;display:block;" />`;
  }

  // HTML del puntito del vehículo (círculo verde/rojo con el ícono)
  function htmlMarcador(p: Posicion, online: boolean): string {
    const color = online ? '#22d97a' : '#ff4d5e';
    const glow = online ? 'rgba(34,217,122,0.35)' : 'rgba(255,77,94,0.30)';
    return `<div style="
      width:34px;height:34px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 0 0 4px ${glow}, 0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;cursor:pointer;
    ">${imgIcono(p.icono ?? 'auto')}</div>`;
  }

  function htmlPopup(p: Posicion): string {
    const bateriaTxt = p.bateria != null ? `${p.bateria}%` : '—';
    return `
      <div style="font-family:system-ui;min-width:160px">
        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${p.nombre}</div>
        <div style="font-size:12px;color:#555">
          Velocidad: <b>${Math.round(p.velocidad)} km/h</b><br/>
          Batería: <b>${bateriaTxt}</b><br/>
          Última: <b>${new Date(p.fecha_gps).toLocaleTimeString('es-AR', { hour12: false })}</b>
        </div>
      </div>`;
  }

  // Mueve el marcador SUAVEMENTE (efecto Google Maps). Solo clientes premium.
  function deslizarMarcador(marker: any, destinoLat: number, destinoLon: number, vehicleId: string) {
    const inicio = marker.getLngLat(); // {lng, lat}
    const latIni = inicio.lat;
    const lonIni = inicio.lng;
    const dLat = destinoLat - latIni;
    const dLon = destinoLon - lonIni;

    if (Math.abs(dLat) < 0.000001 && Math.abs(dLon) < 0.000001) {
      marker.setLngLat([destinoLon, destinoLat]);
      return;
    }

    if (animacionesRef.current[vehicleId]) {
      cancelAnimationFrame(animacionesRef.current[vehicleId]);
    }

    const DURACION = 1500;
    const t0 = performance.now();

    function paso(ahora: number) {
      let pr = (ahora - t0) / DURACION;
      if (pr > 1) pr = 1;
      const suave = pr < 0.5 ? 2 * pr * pr : 1 - Math.pow(-2 * pr + 2, 2) / 2;
      marker.setLngLat([lonIni + dLon * suave, latIni + dLat * suave]);
      if (pr < 1) {
        animacionesRef.current[vehicleId] = requestAnimationFrame(paso);
      }
    }
    animacionesRef.current[vehicleId] = requestAnimationFrame(paso);
  }

  // -------------------------------------------------------------------------
  // 3) Dibujar o mover el marcador de un vehículo
  // -------------------------------------------------------------------------
  function dibujarOActualizarMarcador(p: Posicion) {
    const maplibregl = mlRef.current;
    const mapa = mapaRef.current;
    if (!maplibregl || !mapa) return;

    const minutosDesde = (Date.now() - new Date(p.fecha_gps).getTime()) / 60000;
    const online = minutosDesde < 5;

    const reg = marcadoresRef.current[p.vehicle_id];
    if (reg) {
      // Mover
      if (seguimientoVivoRef.current) {
        deslizarMarcador(reg.marker, p.latitud, p.longitud, p.vehicle_id);
      } else {
        reg.marker.setLngLat([p.longitud, p.latitud]);
      }
      reg.el.innerHTML = htmlMarcador(p, online);
      reg.popup.setHTML(htmlPopup(p));
    } else {
      const el = document.createElement('div');
      el.innerHTML = htmlMarcador(p, online);
      const popup = new maplibregl.Popup({ offset: 20, closeButton: true }).setHTML(htmlPopup(p));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.longitud, p.latitud])
        .setPopup(popup)
        .addTo(mapa);
      marcadoresRef.current[p.vehicle_id] = { marker, popup, el };
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

          const miEmpresa = await getMiCompanyId();
          if (nueva.company_id !== miEmpresa) return;

          const { data: veh } = await supabase
            .from('vehicles')
            .select('nombre, icono')
            .eq('id', nueva.vehicle_id)
            .maybeSingle();

          const p: Posicion = {
            vehicle_id: nueva.vehicle_id,
            nombre: veh?.nombre ?? 'Vehículo',
            latitud: nueva.latitud,
            longitud: nueva.longitud,
            velocidad: nueva.velocidad ?? 0,
            bateria: nueva.bateria,
            fecha_gps: nueva.fecha_gps,
            icono: (veh as any)?.icono ?? 'auto',
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

  // Centrar el mapa en un vehículo y abrir su popup
  function irAVehiculo(v: Posicion, zoom: number) {
    const reg = marcadoresRef.current[v.vehicle_id];
    const mapa = mapaRef.current;
    if (!reg || !mapa) return;
    mapa.flyTo({ center: [v.longitud, v.latitud], zoom });
    if (!reg.popup.isOpen()) reg.marker.togglePopup();
  }

  // Estilo de cada botón del selector de capa
  function btnCapa(activo: boolean): React.CSSProperties {
    return {
      padding: '7px 13px', borderRadius: '7px', border: 'none', fontSize: '13px',
      fontWeight: 600, cursor: 'pointer',
      background: activo ? 'var(--azul-electrico)' : 'transparent',
      color: activo ? '#fff' : 'var(--texto-suave)',
    };
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{
      display: 'flex',
      flexDirection: esCelular ? 'column' : 'row',
      gap: pantallaCompleta ? 0 : '18px',
      height: pantallaCompleta ? '100vh' : (esCelular ? 'auto' : 'calc(100vh - 140px)'),
      ...(pantallaCompleta ? {
        position: 'fixed' as const,
        inset: 0,
        zIndex: 9999,
        background: 'var(--gris-oscuro)',
        padding: 0,
      } : {}),
    }}>
      {/* Mapa */}
      <div style={{
        flex: pantallaCompleta ? 1 : (esCelular ? 'none' : 1),
        height: pantallaCompleta ? '100%' : (esCelular ? '55vh' : 'auto'),
        position: 'relative',
        borderRadius: pantallaCompleta ? 0 : '14px',
        overflow: 'hidden',
        border: pantallaCompleta ? 'none' : '1px solid var(--gris-borde)',
      }}>
        <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />

        {/* Selector de capa + pantalla completa (arriba a la derecha) */}
        <div style={{
          position: 'absolute',
          top: pantallaCompleta ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : '12px',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)', zIndex: 1000,
          display: 'flex', background: 'var(--gris-oscuro)', borderRadius: '10px',
          padding: '4px', border: '1px solid var(--gris-borde)', gap: '3px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)', flexWrap: 'wrap',
        }}>
          <button onClick={() => cambiarVista('calles')} style={btnCapa(vista === 'calles')}>Calles</button>
          <button onClick={() => cambiarVista('satelital')} style={btnCapa(vista === 'satelital')}>Satelital</button>
          <button onClick={() => cambiarVista('hibrido')} style={btnCapa(vista === 'hibrido')}>Híbrido</button>

          <div style={{ width: '1px', background: 'var(--gris-borde)', margin: '3px 2px' }} />

          <button
            onClick={togglePantallaCompleta}
            title={pantallaCompleta ? 'Salir de pantalla completa (ESC)' : 'Pantalla completa'}
            style={{
              padding: '7px 12px', borderRadius: '7px', border: 'none', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer',
              background: pantallaCompleta ? 'var(--azul-electrico)' : 'transparent',
              color: pantallaCompleta ? '#fff' : 'var(--texto-suave)',
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
            }}
          >
            {pantallaCompleta ? '✕ Salir' : '⛶ Pantalla completa'}
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

        {/* En pantalla completa: barra de vehículos ABAJO, colapsable */}
        {pantallaCompleta && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
            display: 'flex', flexDirection: 'column',
            background: 'var(--gris-oscuro)', borderTop: '1px solid var(--gris-borde)',
            boxShadow: '0 -4px 14px rgba(0,0,0,0.4)',
          }}>
            {listaAbierta && (
              <div style={{
                maxHeight: '45vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                {vehiculos.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--texto-suave)', padding: '4px' }}>
                    Todavía no hay posiciones.
                  </div>
                )}
                {vehiculos.map((v) => (
                  <div
                    key={v.vehicle_id}
                    onClick={() => irAVehiculo(v, 15)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', background: 'var(--gris-medio)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--verde-online)', display: 'inline-block' }} />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{v.nombre}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '4px' }}>
                      {Math.round(v.velocidad)} km/h · batería {v.bateria != null ? `${v.bateria}%` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setListaAbierta((v) => !v)}
              style={{
                width: '100%', padding: '14px 16px', border: 'none', background: 'transparent',
                color: '#fff', fontSize: '14px', fontWeight: 700, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              }}
            >
              <span>Vehículos ({vehiculos.length})</span>
              <span style={{ color: 'var(--texto-suave)', fontSize: '12px' }}>{listaAbierta ? '▼ ocultar' : '▲ ver'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Panel lateral (en celular: ancho completo, debajo del mapa) */}
      <div style={{
        display: pantallaCompleta ? 'none' : 'block',
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
            onClick={() => irAVehiculo(v, 14)}
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
