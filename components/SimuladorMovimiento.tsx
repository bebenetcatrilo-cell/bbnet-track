'use client';

// ============================================================================
// SIMULADOR DE MOVIMIENTO (solo para pruebas del Bloque 3)
// ----------------------------------------------------------------------------
// Mientras no tengamos la app del celular (Bloque 4), este botón simula
// vehículos moviéndose: cada 3 segundos inventa una posición nueva para cada
// vehículo y la guarda en la base. Como Realtime está activo, el mapa los
// mueve solos. Es solo para que VEAS el sistema andar.
//
// Cuando llegue la app real, este simulador se apaga y entran posiciones de
// verdad desde los celulares.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

// Punto de partida de cada vehículo (zona de La Pampa)
const PUNTO_BASE = { lat: -36.41, lng: -64.29 };

export default function SimuladorMovimiento() {
  const supabase = createClient();
  const [activo, setActivo] = useState(false);
  const intervaloRef = useRef<any>(null);

  // Estado interno: posición y dirección de cada vehículo
  const estadoRef = useRef<{
    [vehicleId: string]: { lat: number; lng: number; rumbo: number; bateria: number };
  }>({});
  const dispositivosRef = useRef<{ vehicle_id: string; device_id: string; company_id: string }[]>([]);

  // Al montar, traemos los dispositivos+vehículos para saber a quién mover
  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from('tracker_devices')
        .select('id, vehicle_id, company_id')
        .not('vehicle_id', 'is', null);

      if (data) {
        dispositivosRef.current = data.map((d: any) => ({
          device_id: d.id,
          vehicle_id: d.vehicle_id,
          company_id: d.company_id,
        }));

        // Posición inicial: cada vehículo cerca del punto base, separados un poco
        data.forEach((d: any, i: number) => {
          estadoRef.current[d.vehicle_id] = {
            lat: PUNTO_BASE.lat + (i * 0.01),
            lng: PUNTO_BASE.lng + (i * 0.01),
            rumbo: Math.random() * 360,
            bateria: 100,
          };
        });
      }
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Genera una posición nueva (movimiento suave) e inserta en la base
  async function tick() {
    const filas = dispositivosRef.current.map((disp) => {
      const e = estadoRef.current[disp.vehicle_id];
      if (!e) return null;

      // Cambiamos un poco el rumbo y avanzamos
      e.rumbo += (Math.random() - 0.5) * 40; // gira un poco al azar
      const velocidad = 20 + Math.random() * 40; // entre 20 y 60 km/h
      const paso = 0.0008; // cuánto avanza por tick
      e.lat += Math.cos((e.rumbo * Math.PI) / 180) * paso;
      e.lng += Math.sin((e.rumbo * Math.PI) / 180) * paso;
      e.bateria = Math.max(20, e.bateria - 0.2); // batería baja de a poco

      return {
        company_id: disp.company_id,
        device_id: disp.device_id,
        vehicle_id: disp.vehicle_id,
        latitud: e.lat,
        longitud: e.lng,
        velocidad,
        rumbo: e.rumbo,
        bateria: Math.round(e.bateria),
        fecha_gps: new Date().toISOString(),
      };
    }).filter(Boolean);

    if (filas.length > 0) {
      await supabase.from('locations').insert(filas as any[]);
    }
  }

  function alternar() {
    if (activo) {
      // Apagar
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
      setActivo(false);
    } else {
      // Encender: un tick ya, y después cada 3 segundos
      tick();
      intervaloRef.current = setInterval(tick, 3000);
      setActivo(true);
    }
  }

  // Limpieza al salir
  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, []);

  return (
    <button
      onClick={alternar}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 16px', borderRadius: '10px', border: 'none',
        background: activo ? 'var(--rojo-offline)' : 'var(--verde-online)',
        color: '#fff', fontSize: '13px', fontWeight: 600,
      }}
    >
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: '#fff', display: 'inline-block',
        animation: activo ? 'pulso 1s infinite' : 'none',
      }} />
      {activo ? 'Detener simulación' : 'Simular movimiento (prueba)'}
    </button>
  );
}
