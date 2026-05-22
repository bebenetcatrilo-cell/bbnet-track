'use client';

// ============================================================================
// MAPA DE HISTORIAL · dibuja un recorrido pasado
// ----------------------------------------------------------------------------
// Recibe una lista de posiciones (de un vehículo en una fecha) y dibuja:
//   - La línea del recorrido sobre las calles
//   - Un marcador verde donde empezó y uno rojo donde terminó
//   - Marcadores de las PARADAS (donde el vehículo estuvo quieto un rato)
//
// Es distinto al mapa en vivo: este no escucha en tiempo real, solo muestra
// un recorrido ya ocurrido.
// ============================================================================

import { useEffect, useRef } from 'react';

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

type Props = {
  puntos: Punto[];
  paradas: Parada[];
  vista: 'calles' | 'satelital';
};

const CAPAS = {
  calles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satelital: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export default function MapaHistorial({ puntos, paradas, vista }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<any>(null);
  const capaFondoRef = useRef<any>(null);
  const capaDibujoRef = useRef<any>(null); // grupo con la línea y marcadores
  const LRef = useRef<any>(null);

  // Inicializar el mapa una vez
  useEffect(() => {
    let cancelado = false;
    async function iniciar() {
      const L = (await import('leaflet')).default;
      if (cancelado || !contenedorRef.current) return;
      LRef.current = L;

      const mapa = L.map(contenedorRef.current, {
        center: [-36.41, -64.29],
        zoom: 11,
      });
      capaFondoRef.current = L.tileLayer(CAPAS.calles, { maxZoom: 19 }).addTo(mapa);
      capaDibujoRef.current = L.layerGroup().addTo(mapa);
      mapaRef.current = mapa;

      dibujar();
    }
    iniciar();
    return () => {
      cancelado = true;
      if (mapaRef.current) { mapaRef.current.remove(); mapaRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambiar capa de fondo cuando cambia la vista
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;
    if (capaFondoRef.current) mapa.removeLayer(capaFondoRef.current);
    capaFondoRef.current = L.tileLayer(CAPAS[vista], { maxZoom: 19 }).addTo(mapa);
    capaFondoRef.current.bringToBack();
  }, [vista]);

  // Redibujar cuando cambian los puntos
  useEffect(() => {
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos, paradas]);

  function dibujar() {
    const L = LRef.current;
    const mapa = mapaRef.current;
    const grupo = capaDibujoRef.current;
    if (!L || !mapa || !grupo) return;

    grupo.clearLayers();

    if (puntos.length === 0) return;

    // La línea del recorrido
    const coords = puntos.map((p) => [p.latitud, p.longitud]);
    const linea = L.polyline(coords, {
      color: '#0066ff',
      weight: 4,
      opacity: 0.85,
    });
    grupo.addLayer(linea);

    // Marcador de INICIO (verde)
    const inicio = puntos[0];
    grupo.addLayer(
      L.marker([inicio.latitud, inicio.longitud], {
        icon: marcador(L, '#22d97a', 'A'),
      }).bindPopup(`<b>Inicio</b><br/>${new Date(inicio.fecha_gps).toLocaleTimeString('es-AR', { hour12: false })}`)
    );

    // Marcador de FIN (rojo)
    const fin = puntos[puntos.length - 1];
    grupo.addLayer(
      L.marker([fin.latitud, fin.longitud], {
        icon: marcador(L, '#ff4d5e', 'B'),
      }).bindPopup(`<b>Fin</b><br/>${new Date(fin.fecha_gps).toLocaleTimeString('es-AR', { hour12: false })}`)
    );

    // Marcadores de PARADAS (amarillo)
    paradas.forEach((par) => {
      grupo.addLayer(
        L.marker([par.latitud, par.longitud], {
          icon: marcador(L, '#ffb020', 'P'),
        }).bindPopup(
          `<b>Parada · ${par.minutos} min</b><br/>` +
          `${new Date(par.desde).toLocaleTimeString('es-AR', { hour12: false })} → ${new Date(par.hasta).toLocaleTimeString('es-AR', { hour12: false })}`
        )
      );
    });

    // Ajustar el zoom para que se vea todo el recorrido
    mapa.fitBounds(linea.getBounds(), { padding: [40, 40] });
  }

  // Crea un iconito circular de color con una letra adentro
  function marcador(L: any, color: string, letra: string) {
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width:26px;height:26px;border-radius:50%;
          background:${color};border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:700;font-size:12px;font-family:system-ui;
        ">${letra}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }

  return <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />;
}
