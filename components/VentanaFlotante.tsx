'use client';

// ============================================================================
// VENTANA FLOTANTE · componente reutilizable para todo el sistema
// ----------------------------------------------------------------------------
// Se comporta distinto según el dispositivo:
//
//   EN COMPUTADORA:
//     - Flota en el centro
//     - Se puede ARRASTRAR agarrándola de la barra de título
//
//   EN CELULAR:
//     - Se encuadra sola, centrada y grande (casi toda la pantalla, con bordes)
//     - NO se arrastra (no tiene sentido en un celular)
//
// En ambos casos: NO se cierra al tocar afuera (solo con la X o Cancelar).
//
// La ventana detecta el tamaño de pantalla sola. El usuario no hace nada.
// ============================================================================

import { useEffect, useRef, useState } from 'react';

type Props = {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: number; // ancho en píxeles en compu (opcional, por defecto 480)
};

// A partir de qué ancho consideramos "celular"
const ANCHO_CELULAR = 768;

export default function VentanaFlotante({ titulo, onCerrar, children, ancho = 480 }: Props) {
  const [esCelular, setEsCelular] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [iniciada, setIniciada] = useState(false);
  const ventanaRef = useRef<HTMLDivElement>(null);

  const arrastreRef = useRef<{ arrastrando: boolean; offsetX: number; offsetY: number }>({
    arrastrando: false,
    offsetX: 0,
    offsetY: 0,
  });

  // Detectar si es celular (y actualizar si gira la pantalla)
  useEffect(() => {
    function chequear() {
      setEsCelular(window.innerWidth <= ANCHO_CELULAR);
    }
    chequear();
    window.addEventListener('resize', chequear);
    return () => window.removeEventListener('resize', chequear);
  }, []);

  // En compu: centrar la ventana al abrir
  useEffect(() => {
    if (esCelular) { setIniciada(true); return; }
    const w = ventanaRef.current?.offsetWidth ?? ancho;
    const h = ventanaRef.current?.offsetHeight ?? 400;
    setPos({
      x: Math.max(20, (window.innerWidth - w) / 2),
      y: Math.max(20, (window.innerHeight - h) / 2.5),
    });
    setIniciada(true);
  }, [ancho, esCelular]);

  function alAgarrar(e: React.MouseEvent) {
    if (esCelular) return; // en celular no se arrastra
    arrastreRef.current = {
      arrastrando: true,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
    };
  }

  useEffect(() => {
    function alMover(e: MouseEvent) {
      if (!arrastreRef.current.arrastrando) return;
      setPos({
        x: e.clientX - arrastreRef.current.offsetX,
        y: e.clientY - arrastreRef.current.offsetY,
      });
    }
    function alSoltar() {
      arrastreRef.current.arrastrando = false;
    }
    window.addEventListener('mousemove', alMover);
    window.addEventListener('mouseup', alSoltar);
    return () => {
      window.removeEventListener('mousemove', alMover);
      window.removeEventListener('mouseup', alSoltar);
    };
  }, []);

  // --- Estilos según dispositivo ---
  const estiloVentana: React.CSSProperties = esCelular
    ? {
        // CELULAR: encuadrada, centrada, grande con bordes
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'calc(100vw - 28px)',
        maxWidth: '440px',
        maxHeight: '88vh',
      }
    : {
        // COMPU: flotante, en la posición arrastrada
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: `${ancho}px`,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: '85vh',
      };

  return (
    <>
      {/* Fondo oscuro detrás (ayuda a enfocar la ventana, sobre todo en celular).
          Tocarlo NO cierra la ventana (a propósito). */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1999 }} />

      <div
        ref={ventanaRef}
        style={{
          ...estiloVentana,
          background: 'var(--gris-oscuro)',
          border: '1px solid var(--gris-borde)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          opacity: iniciada ? 1 : 0,
          transition: 'opacity 0.12s',
        }}
      >
        {/* Barra de título (en compu, de acá se arrastra) */}
        <div
          onMouseDown={alAgarrar}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--gris-borde)',
            cursor: esCelular ? 'default' : 'move',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* El iconito de agarre solo en compu (en celular no se arrastra) */}
            {!esCelular && (
              <span style={{ color: 'var(--texto-tenue)', fontSize: '16px', letterSpacing: '-2px' }}>⠿</span>
            )}
            <span style={{ fontSize: '17px', fontWeight: 700 }}>{titulo}</span>
          </div>
          <button
            onClick={onCerrar}
            style={{
              background: 'var(--gris-medio)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: 'var(--texto-suave)',
              fontSize: '18px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Contenido (con scroll si es largo) */}
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </>
  );
}
