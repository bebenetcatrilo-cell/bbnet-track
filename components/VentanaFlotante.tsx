'use client';

// ============================================================================
// VENTANA FLOTANTE · componente reutilizable para todo el sistema
// ----------------------------------------------------------------------------
// Una ventana que:
//   - Se abre flotando en el centro
//   - Se puede ARRASTRAR agarrándola de la barra de título
//   - NO se cierra al tocar afuera (solo con la X o un botón Cancelar)
//
// Es el equivalente al "win-float" del Polirrubro. Cualquier sección del
// sistema puede usar esta ventana para sus formularios. Así no repetimos
// código y todas las ventanas se comportan igual.
//
// CÓMO SE USA (ejemplo):
//   <VentanaFlotante titulo="Nuevo vehículo" onCerrar={() => setAbierto(false)}>
//     ...contenido del formulario...
//   </VentanaFlotante>
// ============================================================================

import { useEffect, useRef, useState } from 'react';

type Props = {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: number; // ancho en píxeles (opcional, por defecto 480)
};

export default function VentanaFlotante({ titulo, onCerrar, children, ancho = 480 }: Props) {
  // Posición de la ventana (arranca centrada-ish, después el usuario la mueve)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [iniciada, setIniciada] = useState(false);
  const ventanaRef = useRef<HTMLDivElement>(null);

  // Datos del arrastre
  const arrastreRef = useRef<{ arrastrando: boolean; offsetX: number; offsetY: number }>({
    arrastrando: false,
    offsetX: 0,
    offsetY: 0,
  });

  // Al abrir, centramos la ventana en la pantalla
  useEffect(() => {
    const w = ventanaRef.current?.offsetWidth ?? ancho;
    const h = ventanaRef.current?.offsetHeight ?? 400;
    setPos({
      x: Math.max(20, (window.innerWidth - w) / 2),
      y: Math.max(20, (window.innerHeight - h) / 2.5),
    });
    setIniciada(true);
  }, [ancho]);

  // Empezar a arrastrar (cuando agarrás la barra de título)
  function alAgarrar(e: React.MouseEvent) {
    arrastreRef.current = {
      arrastrando: true,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
    };
  }

  // Mientras movés el mouse, movemos la ventana
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

  return (
    <div
      ref={ventanaRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: `${ancho}px`,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: '85vh',
        background: 'var(--gris-oscuro)',
        border: '1px solid var(--gris-borde)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        opacity: iniciada ? 1 : 0, // evita el "salto" al centrar
        transition: 'opacity 0.12s',
      }}
    >
      {/* Barra de título (de acá se arrastra) */}
      <div
        onMouseDown={alAgarrar}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--gris-borde)',
          cursor: 'move', // el cursor indica que se puede mover
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Iconito de "agarre" para que se note que se mueve */}
          <span style={{ color: 'var(--texto-tenue)', fontSize: '16px', letterSpacing: '-2px' }}>⠿</span>
          <span style={{ fontSize: '17px', fontWeight: 700 }}>{titulo}</span>
        </div>
        <button
          onClick={onCerrar}
          style={{
            background: 'var(--gris-medio)',
            border: 'none',
            borderRadius: '8px',
            width: '30px',
            height: '30px',
            color: 'var(--texto-suave)',
            fontSize: '18px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
  );
}
