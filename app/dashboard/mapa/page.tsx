'use client';

// ============================================================================
// PÁGINA "MAPA EN VIVO"
// ----------------------------------------------------------------------------
// Carga el componente del mapa SOLO en el navegador. Los mapas no se pueden
// dibujar en el servidor (necesitan la ventana del navegador), por eso usamos
// "dynamic" con ssr:false. Es la forma correcta de meter Leaflet en Next.js.
//
// Incluye el botón "Simular movimiento" (solo para pruebas del Bloque 3).
// ============================================================================

import dynamic from 'next/dynamic';

const MapaEnVivo = dynamic(() => import('@/components/MapaEnVivo'), {
  ssr: false,
  loading: () => (
    <div style={{ color: 'var(--texto-suave)', fontSize: '14px', padding: '40px' }}>
      Cargando mapa...
    </div>
  ),
});

const SimuladorMovimiento = dynamic(() => import('@/components/SimuladorMovimiento'), {
  ssr: false,
});

export default function PaginaMapa() {
  return (
    <div>
      <div style={{
        marginBottom: '20px', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Mapa en vivo</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Posición de tus vehículos en tiempo real
          </p>
        </div>
        <SimuladorMovimiento />
      </div>
      <MapaEnVivo />
    </div>
  );
}
