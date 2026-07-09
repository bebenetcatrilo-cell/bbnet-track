'use client';

// ============================================================================
// PANTALLA DE BIENVENIDA (SPLASH) · BBNet Track
// ----------------------------------------------------------------------------
// Muestra el logo a pantalla completa cuando se abre la app, y se desvanece
// solo después de un momento. Funciona IGUAL en iPhone y Android, porque es
// parte de la propia app (no depende del sistema operativo).
//
// Por defecto solo aparece cuando la app está INSTALADA en la pantalla de
// inicio (modo "standalone"), que es justo lo que se pidió. En el navegador
// normal no molesta. Si querés que aparezca SIEMPRE (también en el navegador),
// cambiá MOSTRAR_SIEMPRE a true.
// ============================================================================

import { useEffect, useState } from 'react';

const MOSTRAR_SIEMPRE = false;      // true = también en navegador de escritorio
const DURACION_MS = 1600;           // cuánto se ve el logo antes de desvanecerse
const FADE_MS = 500;                // duración del desvanecido

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // ¿La app está abierta como app instalada (standalone)?
    const esStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS usa esta propiedad propia:
      (window.navigator as any).standalone === true;

    if (!MOSTRAR_SIEMPRE && !esStandalone) return; // en navegador normal no se muestra

    setVisible(true);
    const tFade = setTimeout(() => setFade(true), DURACION_MS);
    const tHide = setTimeout(() => setVisible(false), DURACION_MS + FADE_MS);
    return () => { clearTimeout(tFade); clearTimeout(tHide); };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#12151c',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: fade ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: fade ? 'none' : 'auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-splash.png"
        alt="BBNet Track"
        style={{
          width: 'min(62vw, 300px)', height: 'auto',
          animation: 'bbnetSplashPulse 1.6s ease-in-out infinite',
        }}
      />
      <div style={{
        marginTop: '26px', display: 'flex', gap: '7px',
      }}>
        <span className="bbnet-dot" style={{ animationDelay: '0s' }} />
        <span className="bbnet-dot" style={{ animationDelay: '0.15s' }} />
        <span className="bbnet-dot" style={{ animationDelay: '0.30s' }} />
      </div>

      <style>{`
        @keyframes bbnetSplashPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.04); opacity: 0.88; }
        }
        @keyframes bbnetDot {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50%      { opacity: 1;    transform: translateY(-4px); }
        }
        .bbnet-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #2b7bff; display: inline-block;
          animation: bbnetDot 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
