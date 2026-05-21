'use client';

// ============================================================================
// SECCIÓN CLIENTES · panel del SUPER-ADMIN (solo visible para vos)
// ----------------------------------------------------------------------------
// Acá das de alta clientes nuevos COMPLETOS en un solo paso:
//   empresa + usuario admin (mail y contraseña) + plan + límites.
// Llama a la Edge Function "crear-cliente" que hace el trabajo de forma segura.
//
// Solo el super_admin ve y usa esta pantalla.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';

type Empresa = {
  id: string;
  nombre: string;
  slug: string;
  telefono: string | null;
  email: string | null;
  plan: string;
  limite_dispositivos: number;
  activo: boolean;
  created_at: string;
};

const PLANES = ['trial', 'basico', 'pro'];

const FORM_VACIO = {
  empresa_nombre: '',
  empresa_telefono: '',
  empresa_email: '',
  empresa_direccion: '',
  plan: 'trial',
  limite_dispositivos: 5,
  admin_nombre: '',
  admin_email: '',
  admin_password: '',
};

export default function PaginaClientes() {
  const router = useRouter();
  const supabase = createClient();

  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Verificar que sea super_admin
  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: perfil } = await supabase
        .from('users')
        .select('rol')
        .eq('id', user.id)
        .single();
      const ok = perfil?.rol === 'super_admin';
      setEsSuperAdmin(ok);
      if (ok) cargarEmpresas();
      else setCargando(false);
    }
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarEmpresas() {
    setCargando(true);
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    setEmpresas(data ?? []);
    setCargando(false);
  }

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setMensaje(null);
    setModalAbierto(true);
  }

  async function crearCliente() {
    // Validaciones básicas
    if (!form.empresa_nombre.trim() || !form.admin_email.trim() || !form.admin_password.trim()) {
      setMensaje({ tipo: 'error', texto: 'Completá al menos: nombre de empresa, mail y contraseña del admin.' });
      return;
    }
    if (form.admin_password.length < 6) {
      setMensaje({ tipo: 'error', texto: 'La contraseña tiene que tener al menos 6 caracteres.' });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    // Llamamos a la Edge Function "crear-cliente"
    const { data, error } = await supabase.functions.invoke('crear-cliente', {
      body: {
        empresa_nombre: form.empresa_nombre.trim(),
        empresa_telefono: form.empresa_telefono.trim(),
        empresa_email: form.empresa_email.trim(),
        empresa_direccion: form.empresa_direccion.trim(),
        plan: form.plan,
        limite_dispositivos: Number(form.limite_dispositivos) || 5,
        admin_nombre: form.admin_nombre.trim(),
        admin_email: form.admin_email.trim(),
        admin_password: form.admin_password,
      },
    });

    setGuardando(false);

    // La función puede devolver un error adentro de "data" o en "error"
    const errorDevuelto = (data as any)?.error;
    if (error || errorDevuelto) {
      setMensaje({ tipo: 'error', texto: errorDevuelto || error?.message || 'No se pudo crear el cliente.' });
      return;
    }

    // Éxito
    setMensaje({ tipo: 'ok', texto: '¡Cliente creado correctamente!' });
    setForm(FORM_VACIO);
    cargarEmpresas();
    // Cerramos la ventana después de un momentito para que se vea el mensaje
    setTimeout(() => setModalAbierto(false), 1200);
  }

  // --- Pantallas según el estado ---

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Clientes</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Empresas que usan BBNet Track · alta de nuevos clientes
          </p>
        </div>
        <button onClick={abrirNuevo} style={s.botonPrimario}>+ Nuevo cliente</button>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : empresas.length === 0 ? (
        <div style={{ ...s.tarjeta, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Todavía no hay clientes</div>
          <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '6px' }}>
            Tocá "Nuevo cliente" para dar de alta el primero.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {empresas.map((e) => (
            <div key={e.id} style={s.tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{e.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                    {e.email || 'sin email'}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600,
                  background: 'rgba(0,102,255,0.15)', color: 'var(--azul-brillante)', textTransform: 'uppercase',
                }}>
                  {e.plan}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px' }}>
                <div>📱 Límite dispositivos: <b style={{ color: 'var(--texto)' }}>{e.limite_dispositivos}</b></div>
                {e.telefono && <div style={{ marginTop: '4px' }}>📞 {e.telefono}</div>}
                <div style={{ marginTop: '4px' }}>
                  Estado: <b style={{ color: e.activo ? 'var(--verde-online)' : 'var(--rojo-offline)' }}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </b>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VENTANA FLOTANTE: formulario de nuevo cliente */}
      {modalAbierto && (
        <VentanaFlotante titulo="Nuevo cliente" onCerrar={() => setModalAbierto(false)} ancho={520}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--azul-brillante)', marginBottom: '4px' }}>
            DATOS DE LA EMPRESA
          </div>

          <label style={s.label}>Nombre de la empresa *</label>
          <input value={form.empresa_nombre} onChange={(e) => setForm({ ...form, empresa_nombre: e.target.value })}
            placeholder="Ej: Transportes González" style={s.input} autoFocus />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Teléfono</label>
              <input value={form.empresa_telefono} onChange={(e) => setForm({ ...form, empresa_telefono: e.target.value })}
                placeholder="2954..." style={s.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Email empresa</label>
              <input value={form.empresa_email} onChange={(e) => setForm({ ...form, empresa_email: e.target.value })}
                placeholder="info@empresa.com" style={s.input} />
            </div>
          </div>

          <label style={s.label}>Dirección</label>
          <input value={form.empresa_direccion} onChange={(e) => setForm({ ...form, empresa_direccion: e.target.value })}
            placeholder="Opcional" style={s.input} />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} style={s.input}>
                {PLANES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Límite dispositivos</label>
              <input type="number" value={form.limite_dispositivos}
                onChange={(e) => setForm({ ...form, limite_dispositivos: Number(e.target.value) })}
                style={s.input} />
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--azul-brillante)', marginTop: '20px', marginBottom: '4px' }}>
            USUARIO ADMINISTRADOR (el que va a entrar)
          </div>

          <label style={s.label}>Nombre del admin</label>
          <input value={form.admin_nombre} onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
            placeholder="Ej: Juan González" style={s.input} />

          <label style={s.label}>Email de acceso *</label>
          <input value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
            placeholder="admin@empresa.com" style={s.input} />

          <label style={s.label}>Contraseña *</label>
          <input value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
            placeholder="Mínimo 6 caracteres" style={s.input} />
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Anotá esta contraseña: es la que le vas a pasar al cliente para que entre.
          </div>

          {mensaje && (
            <div style={{
              marginTop: '16px', padding: '11px 14px', borderRadius: '10px', fontSize: '13px',
              background: mensaje.tipo === 'ok' ? 'rgba(34,217,122,0.12)' : 'rgba(255,77,94,0.12)',
              border: `1px solid ${mensaje.tipo === 'ok' ? 'rgba(34,217,122,0.3)' : 'rgba(255,77,94,0.3)'}`,
              color: mensaje.tipo === 'ok' ? 'var(--verde-online)' : 'var(--rojo-offline)',
            }}>
              {mensaje.texto}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalAbierto(false)} style={s.botonChico}>Cancelar</button>
            <button onClick={crearCliente} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Creando...' : 'Crear cliente'}
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
    padding: '8px 14px', color: 'var(--texto)', fontSize: '13px', fontWeight: 500,
  },
  tarjeta: {
    background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
    borderRadius: '14px', padding: '18px',
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
