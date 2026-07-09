'use client';

// ============================================================================
// MENÚ LATERAL (Sidebar) · RESPONSIVE
// ----------------------------------------------------------------------------
//   EN COMPUTADORA: menú fijo a la izquierda (como siempre)
//   EN CELULAR: el menú se esconde. Aparece un botón ☰ (hamburguesa) arriba
//     a la izquierda. Al tocarlo, el menú se desliza desde la izquierda.
//     Tocando una opción o el fondo oscuro, se cierra.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Icono from './Icono';

const items = [
  { href: '/dashboard', label: 'Dashboard', icono: 'dashboard', proximo: false },
  { href: '/dashboard/mapa', label: 'Mapa en vivo', icono: 'mapa', proximo: false },
  { href: '/dashboard/vehiculos', label: 'Vehículos', icono: 'vehiculos', proximo: false },
  { href: '/dashboard/historial', label: 'Historial', icono: 'historial', proximo: false },
  { href: '/dashboard/eventos', label: 'Eventos', icono: 'alertas', proximo: false },
  { href: '/dashboard/dispositivos', label: 'Dispositivos', icono: 'dispositivos', proximo: false },
  { href: '/dashboard/mantenimiento', label: 'Mantenimiento', icono: 'servicio', proximo: false },
  { href: '/dashboard/reportes', label: 'Reportes', icono: 'reportes', proximo: false },
];

// Item NUEVO: Corte combustible (solo Premium y super-admin)
const itemCorteCombustible = {
  href: '/dashboard/corte-combustible',
  label: 'Corte combustible',
  icono: 'alertas',
  proximo: false,
};

// Secciones del negocio EMPRESA (lo que ya estaba)
const itemsEmpresa = [
  { href: '/dashboard/mapa-general', label: 'Mapa General', icono: 'mapa', proximo: false },
  { href: '/dashboard/clientes', label: 'Clientes', icono: 'clientes', proximo: false },
  { href: '/dashboard/stock', label: 'Stock GPS', icono: 'dispositivos', proximo: false },
  { href: '/dashboard/servicio', label: 'Servicio', icono: 'servicio', proximo: false },
  { href: '/dashboard/planes', label: 'Planes', icono: 'planes', proximo: false },
  { href: '/dashboard/cobranza', label: 'Cobranza', icono: 'cobranza', proximo: false },
];

// Secciones del negocio FAMILIA (se construyen de a poco; por ahora "en construcción")
const itemsFamilia = [
  { href: '/dashboard/familias', label: 'Familias', icono: 'clientes', proximo: false },
  { href: '/dashboard/mapa-familias', label: 'Mapa Familias', icono: 'mapa', proximo: false },
  { href: '/dashboard/cobranza-familias', label: 'Cobranza Familias', icono: 'cobranza', proximo: false },
];

const ANCHO_CELULAR = 768;

export default function Sidebar({ empresa, rol, plan }: { empresa: string; rol?: string; plan?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [esCelular, setEsCelular] = useState(false);
  const [abierto, setAbierto] = useState(false); // solo aplica en celular
  const [sector, setSector] = useState<'empresa' | 'familia'>('empresa'); // pestaña de negocio

  const esSuperAdmin = rol === 'super_admin';
  // Mostramos "Corte combustible" si: es super-admin O el cliente tiene plan='premium'
  const verCorteCombustible = esSuperAdmin || String(plan || '').toLowerCase() === 'premium';

  // Detectar tamaño de pantalla
  useEffect(() => {
    function chequear() {
      const celu = window.innerWidth <= ANCHO_CELULAR;
      setEsCelular(celu);
      if (!celu) setAbierto(false); // si pasamos a compu, cerramos el panel móvil
    }
    chequear();
    window.addEventListener('resize', chequear);
    return () => window.removeEventListener('resize', chequear);
  }, []);

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function irA(item: { href: string; proximo: boolean }) {
    if (item.proximo) return;
    router.push(item.href);
    setAbierto(false); // en celular, cerrar el menú al elegir
  }

  // Dibuja un botón del menú (se usa para las secciones normales y las de admin)
  function renderBoton(item: { href: string; label: string; icono: string; proximo: boolean }) {
    const activo = pathname === item.href;
    return (
      <button
        key={item.href}
        onClick={() => irA(item)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '11px 12px', borderRadius: '10px', border: 'none',
          background: activo ? 'var(--azul-electrico)' : 'transparent',
          color: activo ? '#fff' : item.proximo ? 'var(--texto-tenue)' : 'var(--texto-suave)',
          fontSize: '14px', fontWeight: activo ? 600 : 500,
          textAlign: 'left', width: '100%',
          cursor: item.proximo ? 'default' : 'pointer', transition: 'background 0.15s',
        }}
      >
        <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icono nombre={item.icono} size={20} /></span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.proximo && (
          <span style={{
            fontSize: '9px', background: 'var(--gris-medio)', color: 'var(--texto-tenue)',
            padding: '2px 6px', borderRadius: '6px', fontWeight: 600,
          }}>PRONTO</span>
        )}
      </button>
    );
  }

  // El menú en sí (se reutiliza en compu y celular)
  const contenidoMenu = (
    <aside
      style={{
        width: '244px',
        background: 'var(--gris-oscuro)',
        borderRight: '1px solid var(--gris-borde)',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 16px',
        height: esCelular ? 'auto' : 'auto',
        minHeight: esCelular ? '100%' : 'auto', // en celular ocupa toda la altura, y si el contenido es más alto, crece y se puede scrollear
        flexShrink: 0,
      }}
    >
      {/* Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '0 8px', marginBottom: '28px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px var(--azul-glow)', flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="9" r="2.5" fill="#fff" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1 }}>
            BBNet <span style={{ color: 'var(--azul-electrico)' }}>Track</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--texto-tenue)', marginTop: '3px' }}>{empresa}</div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {/* Secciones normales (las ven todos) */}
        {items.map((item) => renderBoton(item))}

        {/* Item NUEVO: Corte combustible (solo Premium o super-admin) */}
        {verCorteCombustible && renderBoton(itemCorteCombustible)}

        {/* Zona ADMINISTRACIÓN con selector de negocio (solo super_admin) */}
        {esSuperAdmin && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              margin: '16px 4px 8px',
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                color: 'var(--texto-tenue)', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>Administración</span>
              <span style={{ flex: 1, height: '1px', background: 'var(--gris-borde)' }} />
            </div>

            {/* Selector de pestañas: Empresa / Familia */}
            <div style={{
              display: 'flex', gap: '4px', background: 'var(--negro)',
              border: '1px solid var(--gris-borde)', borderRadius: '10px',
              padding: '4px', margin: '0 4px 10px',
            }}>
              <button
                onClick={() => setSector('empresa')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  background: sector === 'empresa' ? 'var(--azul-electrico)' : 'transparent',
                  color: sector === 'empresa' ? '#fff' : 'var(--texto-suave)',
                }}
              >
                🏢 Empresa
              </button>
              <button
                onClick={() => setSector('familia')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  background: sector === 'familia' ? 'var(--azul-electrico)' : 'transparent',
                  color: sector === 'familia' ? '#fff' : 'var(--texto-suave)',
                }}
              >
                👨‍👩‍👧 Familia
              </button>
            </div>

            {/* Las secciones según la pestaña elegida */}
            {(sector === 'empresa' ? itemsEmpresa : itemsFamilia).map((item) => renderBoton(item))}
          </>
        )}
      </nav>


      {/* Salir */}
      <button
        onClick={salir}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '11px 12px', borderRadius: '10px', border: '1px solid var(--gris-borde)',
          background: 'transparent', color: 'var(--texto-suave)',
          fontSize: '14px', fontWeight: 500, width: '100%',
        }}
      >
        <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>⏻</span>
        Salir
      </button>
    </aside>
  );

  // -------------------------------------------------------------------------
  // EN COMPUTADORA: el menú fijo de siempre
  // -------------------------------------------------------------------------
  if (!esCelular) {
    return contenidoMenu;
  }

  // -------------------------------------------------------------------------
  // EN CELULAR: botón hamburguesa + menú deslizable
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Botón hamburguesa (arriba a la izquierda, fijo) */}
      <button
        onClick={() => setAbierto(true)}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          zIndex: 1500,
          width: '44px', height: '44px', borderRadius: '11px',
          background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
          color: 'var(--texto)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
        title="Menú"
      >
        <span style={{ width: '18px', height: '2px', background: 'currentColor', borderRadius: '2px' }} />
        <span style={{ width: '18px', height: '2px', background: 'currentColor', borderRadius: '2px' }} />
        <span style={{ width: '18px', height: '2px', background: 'currentColor', borderRadius: '2px' }} />
      </button>

      {/* Fondo oscuro + menú deslizable (solo cuando está abierto) */}
      {abierto && (
        <>
          <div
            onClick={() => setAbierto(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1600 }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1700,
            overflowY: 'auto',            // ← permite scrollear el menú si no entra en la pantalla
            WebkitOverflowScrolling: 'touch', // scroll suave en iPhone
            paddingTop: 'env(safe-area-inset-top, 0px)', // no meter el menú bajo la barra de estado
          }}>
            {contenidoMenu}
          </div>
        </>
      )}
    </>
  );
}
