'use client';

// ============================================================================
// SECCIÓN COBRANZA · control de abonos (solo super_admin)
// ----------------------------------------------------------------------------
// Muestra cada cliente con su estado del mes (pagó / debe), deja registrar
// pagos manualmente y ver quién está en deuda. Vencimiento: día fijo del mes.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';

type Empresa = {
  id: string;
  nombre: string;
  plan: string;
  activo: boolean;
};

type Cobro = {
  id: string;
  company_id: string;
  monto: number;
  medio: string;
  periodo: string;
  fecha_pago: string;
  nota: string | null;
};

type Plan = { codigo: string; precio_mensual: number };

const MEDIOS = ['transferencia', 'efectivo', 'cheque', 'mercadopago', 'otro'];

export default function PaginaCobranza() {
  const router = useRouter();
  const supabase = createClient();

  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [diaVencimiento, setDiaVencimiento] = useState(10);
  const [cargando, setCargando] = useState(true);

  // Período actual que estamos mirando (este mes)
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7)); // "2026-05"

  const [modalAbierto, setModalAbierto] = useState(false);
  const [empresaCobro, setEmpresaCobro] = useState<Empresa | null>(null);
  const [form, setForm] = useState({ monto: 0, medio: 'transferencia', fecha_pago: '', nota: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single();
      const ok = perfil?.rol === 'super_admin';
      setEsSuperAdmin(ok);
      if (ok) cargarTodo();
      else setCargando(false);
    }
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: emps }, { data: cobs }, { data: plns }, { data: conf }] = await Promise.all([
      supabase.from('companies').select('id, nombre, plan, activo').order('nombre'),
      supabase.from('cobros').select('*'),
      supabase.from('planes').select('codigo, precio_mensual'),
      supabase.from('config').select('valor').eq('clave', 'dia_vencimiento').single(),
    ]);
    setEmpresas(emps ?? []);
    setCobros(cobs ?? []);
    setPlanes(plns ?? []);
    if (conf?.valor) setDiaVencimiento(parseInt(conf.valor, 10));
    setCargando(false);
  }

  // Precio del plan de una empresa
  function precioDe(empresa: Empresa): number {
    return planes.find((p) => p.codigo === empresa.plan)?.precio_mensual ?? 0;
  }

  // ¿La empresa pagó el período que estamos mirando?
  function pagoEsteMes(companyId: string): Cobro | undefined {
    return cobros.find((c) => c.company_id === companyId && c.periodo === periodo);
  }

  function abrirCobro(empresa: Empresa) {
    setEmpresaCobro(empresa);
    setForm({
      monto: precioDe(empresa),
      medio: 'transferencia',
      fecha_pago: new Date().toISOString().slice(0, 10),
      nota: '',
    });
    setModalAbierto(true);
  }

  async function registrarPago() {
    if (!empresaCobro) return;
    setGuardando(true);
    await supabase.from('cobros').insert({
      company_id: empresaCobro.id,
      monto: Number(form.monto) || 0,
      medio: form.medio,
      periodo: periodo,
      fecha_pago: form.fecha_pago || new Date().toISOString().slice(0, 10),
      nota: form.nota.trim() || null,
    });
    setGuardando(false);
    setModalAbierto(false);
    cargarTodo();
  }

  async function eliminarPago(cobroId: string) {
    if (!confirm('¿Borrar este pago registrado?')) return;
    await supabase.from('cobros').delete().eq('id', cobroId);
    cargarTodo();
  }

  // Navegar entre meses
  function cambiarMes(delta: number) {
    const [a, m] = periodo.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    setPeriodo(d.toISOString().slice(0, 7));
  }

  function nombreMes(per: string): string {
    const [a, m] = per.split('-').map(Number);
    return new Date(a, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  // Totales
  const totalCobrado = empresas.reduce((acc, e) => {
    const pago = pagoEsteMes(e.id);
    return acc + (pago ? Number(pago.monto) : 0);
  }, 0);
  const totalEsperado = empresas.filter((e) => e.activo).reduce((acc, e) => acc + precioDe(e), 0);
  const deudores = empresas.filter((e) => e.activo && !pagoEsteMes(e.id) && precioDe(e) > 0).length;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Cobranza</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Control de abonos · vencimiento el día {diaVencimiento} de cada mes
          </p>
        </div>
        {/* Navegador de mes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--gris-oscuro)', borderRadius: '10px', padding: '4px', border: '1px solid var(--gris-borde)' }}>
          <button onClick={() => cambiarMes(-1)} style={s.botonChico}>‹</button>
          <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'capitalize', minWidth: '130px', textAlign: 'center' }}>
            {nombreMes(periodo)}
          </span>
          <button onClick={() => cambiarMes(1)} style={s.botonChico}>›</button>
        </div>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : (
        <>
          {/* Totales del mes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <Tarjeta label="Cobrado este mes" valor={`$${totalCobrado.toLocaleString('es-AR')}`} color="var(--verde-online)" />
            <Tarjeta label="Esperado (total)" valor={`$${totalEsperado.toLocaleString('es-AR')}`} color="var(--azul-electrico)" />
            <Tarjeta label="Clientes en deuda" valor={`${deudores}`} color="var(--rojo-offline)" />
          </div>

          {/* Lista de clientes con su estado */}
          <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ color: 'var(--texto-suave)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={s.th}>Cliente</th>
                    <th style={s.th}>Plan</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Abono</th>
                    <th style={{ ...s.th, textAlign: 'center' }}>Estado</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((e) => {
                    const pago = pagoEsteMes(e.id);
                    const precio = precioDe(e);
                    return (
                      <tr key={e.id} style={{ borderTop: '1px solid var(--gris-borde)' }}>
                        <td style={{ ...s.td, fontWeight: 600 }}>{e.nombre}</td>
                        <td style={{ ...s.td, textTransform: 'capitalize', color: 'var(--texto-suave)' }}>{e.plan}</td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {precio > 0 ? `$${precio.toLocaleString('es-AR')}` : '—'}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {precio === 0 ? (
                            <span style={{ fontSize: '12px', color: 'var(--texto-tenue)' }}>Gratis</span>
                          ) : pago ? (
                            <span style={{ ...s.chip, background: 'rgba(34,217,122,0.15)', color: 'var(--verde-online)' }}>
                              ✓ Pagó ({pago.medio})
                            </span>
                          ) : (
                            <span style={{ ...s.chip, background: 'rgba(255,77,94,0.15)', color: 'var(--rojo-offline)' }}>
                              Debe
                            </span>
                          )}
                        </td>
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {pago ? (
                            <button onClick={() => eliminarPago(pago.id)} style={{ ...s.botonChico, color: 'var(--rojo-offline)' }}>
                              Anular
                            </button>
                          ) : precio > 0 ? (
                            <button onClick={() => abrirCobro(e)} style={s.botonChico}>Registrar pago</button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {empresas.length === 0 && (
                    <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>No hay clientes cargados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VENTANA FLOTANTE: registrar pago */}
      {modalAbierto && empresaCobro && (
        <VentanaFlotante titulo={`Registrar pago · ${empresaCobro.nombre}`} onCerrar={() => setModalAbierto(false)}>
          <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginBottom: '6px' }}>
            Período: <b style={{ color: 'var(--texto)', textTransform: 'capitalize' }}>{nombreMes(periodo)}</b>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Monto ($)</label>
              <input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })} style={s.input} autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Medio de pago</label>
              <select value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })} style={s.input}>
                {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <label style={s.label}>Fecha del pago</label>
          <input type="date" value={form.fecha_pago} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} style={s.input} />

          <label style={s.label}>Nota (opcional)</label>
          <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })}
            placeholder="Ej: pagó por Mercado Pago, comprobante 1234" style={s.input} />

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalAbierto(false)} style={s.botonChico}>Cancelar</button>
            <button onClick={registrarPago} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </VentanaFlotante>
      )}
    </div>
  );
}

function Tarjeta({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', padding: '18px' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color, letterSpacing: '-0.5px' }}>{valor}</div>
      <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '3px' }}>{label}</div>
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
    padding: '8px 14px', color: 'var(--texto)', fontSize: '13px', fontWeight: 500,
  },
  tarjeta: {
    background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
    borderRadius: '14px', padding: '18px',
  },
  th: { textAlign: 'left', padding: '12px 18px', fontWeight: 600 },
  td: { padding: '13px 18px' },
  chip: { fontSize: '12px', padding: '4px 10px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap' },
  label: { display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginTop: '12px', marginBottom: '5px', fontWeight: 500 },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none',
  },
};
