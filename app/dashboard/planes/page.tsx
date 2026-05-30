'use client';

// ============================================================================
// SECCIÓN PLANES · catálogo de suscripciones (solo super_admin)
// ----------------------------------------------------------------------------
// Muestra los planes y te deja EDITAR precio, límite de dispositivos, nombre,
// descripción y si está activo. Todo desde acá, sin tocar código.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';

type Plan = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_mensual: number;
  limite_dispositivos: number;
  dias_prueba: number;
  orden: number;
  activo: boolean;
  seguimiento_vivo: boolean;
  mantenimiento: boolean;
  reportes: boolean;
};

export default function PaginaPlanes() {
  const router = useRouter();
  const supabase = createClient();

  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<Plan | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single();
      const ok = perfil?.rol === 'super_admin';
      setEsSuperAdmin(ok);
      if (ok) cargarPlanes();
      else setCargando(false);
    }
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarPlanes() {
    setCargando(true);
    const { data } = await supabase.from('planes').select('*').order('orden');
    setPlanes(data ?? []);
    setCargando(false);
  }

  function abrirEditar(p: Plan) {
    setForm({ ...p });
    setModalAbierto(true);
  }

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    await supabase
      .from('planes')
      .update({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || null,
        precio_mensual: Number(form.precio_mensual) || 0,
        limite_dispositivos: Number(form.limite_dispositivos) || 0,
        dias_prueba: Number(form.dias_prueba) || 0,
        activo: form.activo,
        seguimiento_vivo: form.seguimiento_vivo,
        mantenimiento: form.mantenimiento,
        reportes: form.reportes,
      })
      .eq('id', form.id);
    setGuardando(false);
    setModalAbierto(false);
    cargarPlanes();
  }

  function formatearPrecio(n: number): string {
    if (n === 0) return 'Gratis';
    return '$' + n.toLocaleString('es-AR');
  }

  if (esSuperAdmin === false) {
    return (
      <div style={{ ...s.tarjeta, textAlign: 'center', padding: '50px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Acceso restringido</div>
        <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '8px' }}>
          Esta sección es solo para el super administrador.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Planes</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          El catálogo de suscripciones · tocá un plan para editar precio y límites
        </p>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {planes.map((p) => (
            <div key={p.id} style={{
              ...s.tarjeta,
              borderColor: p.activo ? 'var(--gris-borde)' : 'var(--gris-medio)',
              opacity: p.activo ? 1 : 0.6,
              position: 'relative',
            }}>
              {p.codigo === 'trial' && (
                <span style={{
                  position: 'absolute', top: '14px', right: '14px',
                  fontSize: '10px', padding: '3px 8px', borderRadius: '6px', fontWeight: 700,
                  background: 'rgba(34,217,122,0.15)', color: 'var(--verde-online)', textTransform: 'uppercase',
                }}>Prueba</span>
              )}

              <div style={{ fontSize: '18px', fontWeight: 700 }}>{p.nombre}</div>
              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px', minHeight: '18px' }}>
                {p.descripcion}
              </div>

              <div style={{ margin: '16px 0' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--azul-brillante)', letterSpacing: '-1px' }}>
                  {formatearPrecio(p.precio_mensual)}
                </span>
                {p.precio_mensual > 0 && <span style={{ fontSize: '13px', color: 'var(--texto-suave)' }}> /mes</span>}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', borderTop: '1px solid var(--gris-borde)', paddingTop: '12px' }}>
                <div>📱 Hasta <b style={{ color: 'var(--texto)' }}>{p.limite_dispositivos}</b> dispositivos</div>
                {p.dias_prueba > 0 && <div style={{ marginTop: '4px' }}>🎁 <b style={{ color: 'var(--texto)' }}>{p.dias_prueba}</b> días de prueba</div>}
              </div>

              <button onClick={() => abrirEditar(p)} style={{ ...s.botonChico, width: '100%', marginTop: '16px' }}>
                Editar plan
              </button>
            </div>
          ))}
        </div>
      )}

      {/* VENTANA FLOTANTE: editar plan */}
      {modalAbierto && form && (
        <VentanaFlotante titulo={`Editar: ${form.nombre}`} onCerrar={() => setModalAbierto(false)}>
          <label style={s.label}>Nombre del plan</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={s.input} autoFocus />

          <label style={s.label}>Descripción</label>
          <input value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Texto corto que ve el cliente" style={s.input} />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Precio mensual ($)</label>
              <input type="number" value={form.precio_mensual}
                onChange={(e) => setForm({ ...form, precio_mensual: Number(e.target.value) })} style={s.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Límite dispositivos</label>
              <input type="number" value={form.limite_dispositivos}
                onChange={(e) => setForm({ ...form, limite_dispositivos: Number(e.target.value) })} style={s.input} />
            </div>
          </div>

          {form.codigo === 'trial' && (
            <>
              <label style={s.label}>Días de prueba</label>
              <input type="number" value={form.dias_prueba}
                onChange={(e) => setForm({ ...form, dias_prueba: Number(e.target.value) })} style={s.input} />
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Plan activo (se ofrece a los clientes)
          </label>

          {/* Interruptor del seguimiento en vivo (efecto Google Maps) — función premium */}
          <div style={{
            marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
            background: form.seguimiento_vivo ? 'rgba(0,102,255,0.1)' : 'var(--gris-oscuro)',
            border: `1px solid ${form.seguimiento_vivo ? 'var(--azul-electrico)' : 'var(--gris-borde)'}`,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={form.seguimiento_vivo}
                onChange={(e) => setForm({ ...form, seguimiento_vivo: e.target.checked })} />
              🛰️ Seguimiento en vivo (efecto Google Maps)
            </label>
            <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '6px', marginLeft: '24px' }}>
              Los clientes de este plan ven el vehículo moverse suave en el mapa, casi en tiempo real. Función premium.
            </div>
          </div>

          {/* Interruptor de Mantenimiento (control de service por KM) — función premium */}
          <div style={{
            marginTop: '10px', padding: '12px 14px', borderRadius: '10px',
            background: form.mantenimiento ? 'rgba(255,176,32,0.1)' : 'var(--gris-oscuro)',
            border: `1px solid ${form.mantenimiento ? 'var(--amarillo)' : 'var(--gris-borde)'}`,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={form.mantenimiento}
                onChange={(e) => setForm({ ...form, mantenimiento: e.target.checked })} />
              🔧 Control de mantenimiento por KM
            </label>
            <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '6px', marginLeft: '24px' }}>
              Los clientes de este plan controlan services (aceite, frenos, etc.) por kilómetros recorridos. Función premium.
            </div>
          </div>

          {/* Interruptor de Reportes — función premium */}
          <div style={{
            marginTop: '10px', padding: '12px 14px', borderRadius: '10px',
            background: form.reportes ? 'rgba(34,217,122,0.1)' : 'var(--gris-oscuro)',
            border: `1px solid ${form.reportes ? 'var(--verde-online)' : 'var(--gris-borde)'}`,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={form.reportes}
                onChange={(e) => setForm({ ...form, reportes: e.target.checked })} />
              📊 Reportes
            </label>
            <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '6px', marginLeft: '24px' }}>
              Los clientes de este plan acceden a la sección Reportes (resúmenes, kilometraje, etc.). Función premium.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalAbierto(false)} style={s.botonChico}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </VentanaFlotante>
      )}
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  botonPrimario: {
    background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
    border: 'none', borderRadius: '10px', padding: '11px 18px', color: '#fff',
    fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 18px var(--azul-glow)',
  },
  botonChico: {
    background: 'var(--gris-medio)', border: '1px solid var(--gris-borde)', borderRadius: '8px',
    padding: '9px 14px', color: 'var(--texto)', fontSize: '13px', fontWeight: 500,
  },
  tarjeta: {
    background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
    borderRadius: '14px', padding: '20px',
  },
  label: {
    display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginTop: '12px',
    marginBottom: '5px', fontWeight: 500,
  },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none',
  },
};
