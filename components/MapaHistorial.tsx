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

    // ---- La línea del recorrido, LIMPIA y coloreada por velocidad ----
    // Para que no quede "rayado" cuando el vehículo está quieto (el GPS baila aunque
    // esté parado), hacemos dos cosas:
    //   1) SUAVIZAR: descartamos los puntos que están a menos de 15 metros del último
    //      que dibujamos (esos son "temblor" del GPS, no movimiento real).
    //   2) NO DIBUJAR TRAMOS QUIETOS: si entre dos puntos el vehículo casi no se movió
    //      (menos de 20m) o iba muy lento, no dibujamos esa rayita.
    const METROS_MIN_DIBUJAR = 20; // tramo mínimo para dibujar una rayita
    const METROS_SUAVIZAR = 15;    // si un punto está más cerca que esto del anterior dibujado, lo salteamos

    // Primero armamos la lista de puntos "limpios" (sin el temblor)
    const limpios: typeof puntos = [];
    for (const p of puntos) {
      if (limpios.length === 0) {
        limpios.push(p);
        continue;
      }
      const ult = limpios[limpios.length - 1];
      const distM = distanciaKm(ult.latitud, ult.longitud, p.latitud, p.longitud) * 1000;
      if (distM >= METROS_SUAVIZAR) {
        limpios.push(p);
      }
    }

    // Ahora dibujamos los tramos entre puntos limpios, solo si hubo movimiento real
    for (let i = 1; i < limpios.length; i++) {
      const ant = limpios[i - 1];
      const act = limpios[i];
      const distM = distanciaKm(ant.latitud, ant.longitud, act.latitud, act.longitud) * 1000;
      if (distM < METROS_MIN_DIBUJAR) continue; // tramo demasiado corto: no dibujamos (estaba quieto)
      const color = colorPorVelocidad(act.velocidad ?? 0);
      grupo.addLayer(
        L.polyline(
          [
            [ant.latitud, ant.longitud],
            [act.latitud, act.longitud],
          ],
          { color, weight: 4, opacity: 0.9 }
        )
      );
    }

    // Una línea invisible que une todo, solo para calcular el zoom (fitBounds)
    const coords = puntos.map((p) => [p.latitud, p.longitud]);
    const lineaCompleta = L.polyline(coords, { opacity: 0 });
    grupo.addLayer(lineaCompleta);

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
    mapa.fitBounds(lineaCompleta.getBounds(), { padding: [40, 40] });
  }

  // Elige el color del tramo según la velocidad (km/h), escala estándar:
  //   0       → gris    (detenido)
  //   1–20    → azul    (muy lento)
  //   20–60   → verde   (normal urbano)
  //   60–90   → amarillo(ruta normal)
  //   90–120  → naranja (alta velocidad)
  //   +120    → rojo    (exceso de velocidad)
  // Distancia entre dos coordenadas en km (Haversine)
  function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function colorPorVelocidad(vel: number): string {
    if (vel <= 0) return '#8b97aa';   // gris
    if (vel < 20) return '#2d8bff';   // azul
    if (vel < 60) return '#22d97a';   // verde
    if (vel < 90) return '#ffd11a';   // amarillo
    if (vel < 120) return '#ff8c1a';  // naranja
    return '#ff4d5e';                 // rojo
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />
      {/* Leyenda de colores por velocidad */}
      {puntos.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '14px', left: '14px', zIndex: 1000,
          background: 'rgba(19,24,34,0.92)', border: '1px solid #2a3444',
          borderRadius: '10px', padding: '10px 12px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)', fontFamily: 'system-ui',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#e6edf7', marginBottom: '7px' }}>
            Velocidad
          </div>
          {[
            { c: '#8b97aa', t: 'Detenido' },
            { c: '#2d8bff', t: '1–20 km/h' },
            { c: '#22d97a', t: '20–60 km/h' },
            { c: '#ffd11a', t: '60–90 km/h' },
            { c: '#ff8c1a', t: '90–120 km/h' },
            { c: '#ff4d5e', t: '+120 km/h' },
          ].map((item) => (
            <div key={item.t} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
              <span style={{ width: '14px', height: '4px', borderRadius: '2px', background: item.c, display: 'inline-block' }} />
              <span style={{ fontSize: '11px', color: '#8b97aa' }}>{item.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
