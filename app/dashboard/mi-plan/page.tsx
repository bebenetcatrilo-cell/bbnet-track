'use client';

// ============================================================================
// MI PLAN · pantalla para el CLIENTE (solo ver, no editar)
// ----------------------------------------------------------------------------
// El cliente ve los planes disponibles, cuál tiene contratado, y si quiere
// cambiar toca un botón que abre WhatsApp con un mensaje ya escrito hacia BBNet.
// NO puede editar precios (eso es solo del super-admin, en otra pantalla).
// ============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { getMiCompanyId } from '@/lib/mi-empresa';

const supabase = createClient();

// ⬇️⬇️⬇️  PONÉ ACÁ TU NÚMERO DE WHATSAPP  ⬇️⬇️⬇️
// Solo números, con código de país y el 9. Sin espacios, sin +, sin guiones.
// Ejemplo para Argentina (2954 123456):  '5492954123456'
const NUMERO_WHATSAPP = '5492954365020';
// ⬆️⬆️⬆️  CAMBIÁ ESE NÚMERO POR EL TUYO  ⬆️⬆️⬆️

type Plan = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number;
  limite_dispositivos: number;
  seguimiento_vivo: boolean;
  mantenimiento: boolean;
  reportes: boolean;
  corte_combustible: boolean;
  orden: number;
};

function formatearPrecio(n: number): string {
  if (!n || n <= 0) return 'Gratis';
  return '$' + n.toLocaleString('es-AR');
}

export default function MiPlanPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planActual, setPlanActual] = useState<string>('');
  const [nombreEmpresa, setNombreEmpresa] = useState<string>('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const miEmpresa = await getMiCompanyId();
    const [planesRes, empRes] = await Promise.all([
      supabase.from('planes').select('*').eq('activo', true).order('orden'),
      miEmpresa
        ? supabase.from('companies').select('plan, nombre').eq('id', miEmpresa).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    setPlanes((planesRes.data as Plan[]) ?? []);
    setPlanActual(empRes.data?.plan ?? '');
    setNombreEmpresa(empRes.data?.nombre ?? '');
    setCargando(false);
  }

  function pedirCambio(plan: Plan) {
    const msg = `Hola BBNet Track, soy ${nombreEmpresa || 'un cliente'} y quiero cambiar al plan "${plan.nombre}".`;
    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  function caracteristicas(p: Plan): string[] {
    const lista: string[] = ['Mapa en vivo e historial'];
    if (p.seguimiento_vivo) lista.push('Seguimiento en tiempo real');
    if (p.reportes) lista.push('Reportes detallados');
    if (p.mantenimiento) lista.push('Control de mantenimiento por KM');
    if (p.corte_combustible) lista.push('Corte de combustible anti-robo');
    return lista;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Mi Plan</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Estos son los planes disponibles. Si querés cambiar, tocá el botón y nos escribís por WhatsApp.
        </p>
        <p style={{ color: 'var(--texto-suave)', fontSize: '12px', marginTop: '8px', fontStyle: 'italic' }}>
          * Los precios no incluyen IVA. Se agrega el 21% al valor de cada plan.
        </p>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {planes.map((p) => {
            const esActual = p.codigo && p.codigo === planActual;
            return (
              <div key={p.id} style={{
                background: 'var(--gris-oscuro)',
                border: `1px solid ${esActual ? 'var(--azul-electrico)' : 'var(--gris-borde)'}`,
                borderRadius: '14px', padding: '20px', position: 'relative',
                display: 'flex', flexDirection: 'column', height: '100%',
                boxShadow: esActual ? '0 0 0 1px var(--azul-electrico)' : 'none',
              }}>
                {esActual && (
                  <span style={{
                    position: 'absolute', top: '14px', right: '14px',
                    fontSize: '10px', padding: '3px 8px', borderRadius: '6px', fontWeight: 700,
                    background: 'rgba(43,123,255,0.15)', color: 'var(--azul-electrico)', textTransform: 'uppercase',
                  }}>Tu plan</span>
                )}

                <div style={{ fontSize: '18px', fontWeight: 700 }}>{p.nombre}</div>
                <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px', minHeight: '34px' }}>
                  {p.descripcion}
                </div>

                <div style={{ margin: '14px 0' }}>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--azul-brillante)', letterSpacing: '-1px' }}>
                    {formatearPrecio(p.precio_mensual)}
                  </span>
                  {p.precio_mensual > 0 && <span style={{ fontSize: '13px', color: 'var(--texto-suave)' }}> /mes</span>}
                </div>

                <div style={{ fontSize: '13px', color: 'var(--texto-suave)', borderTop: '1px solid var(--gris-borde)', paddingTop: '12px' }}>
                  {caracteristicas(p).map((c) => (
                    <div key={c} style={{ marginBottom: '6px', display: 'flex', gap: '7px' }}>
                      <span style={{ color: 'var(--verde-online)' }}>✓</span>
                      <span style={{ color: 'var(--texto)' }}>{c}</span>
                    </div>
                  ))}
                </div>

                {esActual ? (
                  <div style={{
                    marginTop: 'auto', paddingTop: '16px', textAlign: 'center',
                    fontSize: '13px', color: 'var(--azul-electrico)', fontWeight: 600,
                  }}>
                    Plan contratado actualmente
                  </div>
                ) : (
                  <button
                    onClick={() => pedirCambio(p)}
                    style={{
                      marginTop: 'auto',
                      background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
                      border: 'none', borderRadius: '10px', padding: '11px 14px', color: '#fff',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer', width: '100%',
                    }}
                  >
                    Cambiar a este plan
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
