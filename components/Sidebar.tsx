'use client';

// ============================================================================
// MENÚ LATERAL (Sidebar)
// ----------------------------------------------------------------------------
// El menú de navegación de la izquierda. Por ahora los links de Mapa,
// Historial, etc. están listos pero esas páginas se construyen en los
// próximos bloques. El botón "Salir" cierra la sesión.
// ============================================================================

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

// Los ítems del menú. "proximo: true" = todavía no construido (Bloques 3+)
const items = [
  { href: '/dashboard', label: 'Dashboard', icono: '▦', proximo: false },
  { href: '/dashboard/mapa', label: 'Mapa en vivo', icono: '◎', proximo: false },
  { href: '/dashboard/vehiculos', label: 'Vehículos', icono: '⊞', proximo: false },
  { href: '/dashboard/historial', label: 'Historial', icono: '↻', proximo: true },
  { href: '/dashboard/dispositivos', label: 'Dispositivos', icono: '⊡', proximo: true },
  { href: '/dashboard/reportes', label: 'Reportes', icono: '◈', proximo: true },
];

export default function Sidebar({ empresa }: { empresa: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      style={{
        width: '244px',
        background: 'var(--gris-oscuro)',
        borderRight: '1px solid var(--gris-borde)',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 16px',
      }}
    >
      {/* Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '0 8px', marginBottom: '28px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px var(--azul-glow)',
          }}
        >
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
        {items.map((item) => {
          const activo = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => !item.proximo && router.push(item.href)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activo ? 'var(--azul-electrico)' : 'transparent',
                color: activo ? '#fff' : item.proximo ? 'var(--texto-tenue)' : 'var(--texto-suave)',
                fontSize: '14px',
                fontWeight: activo ? 600 : 500,
                textAlign: 'left',
                width: '100%',
                cursor: item.proximo ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: '17px', width: '20px', textAlign: 'center' }}>{item.icono}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.proximo && (
                <span style={{
                  fontSize: '9px',
                  background: 'var(--gris-medio)',
                  color: 'var(--texto-tenue)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}>
                  PRONTO
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Salir */}
      <button
        onClick={salir}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '11px 12px',
          borderRadius: '10px',
          border: '1px solid var(--gris-borde)',
          background: 'transparent',
          color: 'var(--texto-suave)',
          fontSize: '14px',
          fontWeight: 500,
          width: '100%',
        }}
      >
        <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>⏻</span>
        Salir
      </button>
    </aside>
  );
}
