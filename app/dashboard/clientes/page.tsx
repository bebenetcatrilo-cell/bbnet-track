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
  tipo: 'empresa' | 'familia';
  created_at: string;
};

type Plan = {
  codigo: string;
  nombre: string;
  limite_dispositivos: number;
};

const FORM_VACIO = {
  empresa_nombre: '',
  empresa_telefono: '',
  empresa_email: '',
  empresa_direccion: '',
  tipo: 'empresa' as 'empresa' | 'familia',
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
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Modal de edición de empresa existente
  const [modalEditar, setModalEditar] = useState(false);
  const [empresaEditar, setEmpresaEditar] = useState<Empresa | null>(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  // Datos del usuario admin del cliente (para editar nombre/email/contraseña)
  const [adminCliente, setAdminCliente] = useState<{ id: string; nombre: string; email: string } | null>(null);
  const [passwordNueva, setPasswordNueva] = useState('');
  const [mensajeEdit, setMensajeEdit] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

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
    // OJO: filtramos por tipo='empresa'. Las familias se gestionan en
    // la sección "Familias" aparte (mismo SQL pero con tipo='familia').
    const [{ data: emps }, { data: plns }] = await Promise.all([
      supabase.from('companies').select('*').eq('tipo', 'empresa').order('created_at', { ascending: false }),
      supabase.from('planes').select('codigo, nombre, limite_dispositivos').eq('activo', true).order('orden'),
    ]);
    setEmpresas(emps ?? []);
    setPlanes(plns ?? []);
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
        tipo: form.tipo,
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

  // Abrir el modal de edición con los datos de la empresa
  async function abrirEditar(e: Empresa) {
    setEmpresaEditar({ ...e });
    setPasswordNueva('');
    setMensajeEdit(null);
    setAdminCliente(null);
    setModalEditar(true);
    // Buscamos el usuario admin de esta empresa (para poder editar su email/contraseña)
    const { data } = await supabase
      .from('users')
      .select('id, nombre, email')
      .eq('company_id', e.id)
      .eq('rol', 'admin')
      .limit(1)
      .maybeSingle();
    if (data) setAdminCliente({ id: data.id, nombre: data.nombre ?? '', email: data.email ?? '' });
  }

  // Guardar los cambios de la empresa (usa la Edge Function segura)
  async function guardarEdicion() {
    if (!empresaEditar) return;
    if (!empresaEditar.nombre.trim()) {
      setMensajeEdit({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' });
      return;
    }
    if (passwordNueva && passwordNueva.length < 6) {
      setMensajeEdit({ tipo: 'error', texto: 'La contraseña nueva debe tener al menos 6 caracteres.' });
      return;
    }
    setGuardandoEdit(true);
    setMensajeEdit(null);

    const planElegido = planes.find((p) => p.codigo === empresaEditar.plan);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/editar-cliente`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            empresa_id: empresaEditar.id,
            empresa_nombre: empresaEditar.nombre.trim(),
            empresa_telefono: empresaEditar.telefono?.trim() || null,
            empresa_email: empresaEditar.email?.trim() || null,
            empresa_direccion: (empresaEditar as any).direccion?.trim() || null,
            tipo: empresaEditar.tipo,
            plan: empresaEditar.plan,
            limite_dispositivos: planElegido?.limite_dispositivos ?? empresaEditar.limite_dispositivos,
            admin_id: adminCliente?.id ?? null,
            admin_nombre: adminCliente?.nombre ?? null,
            admin_email: adminCliente?.email ?? null,
            admin_password: passwordNueva || null,
          }),
        }
      );
      const resultado = await resp.json();
      if (!resp.ok) {
        setMensajeEdit({ tipo: 'error', texto: resultado.error ?? 'No se pudo guardar.' });
        setGuardandoEdit(false);
        return;
      }
      setGuardandoEdit(false);
      setModalEditar(false);
      cargarEmpresas();
    } catch (err) {
      setMensajeEdit({ tipo: 'error', texto: 'Error de conexión. Probá de nuevo.' });
      setGuardandoEdit(false);
    }
  }

  // Activar / desactivar un cliente (le corta o reactiva el servicio)
  async function alternarActivo(e: Empresa) {
    const nuevoEstado = !e.activo;
    const accion = nuevoEstado ? 'reactivar' : 'suspender';
    if (!confirm(`¿Seguro que querés ${accion} a "${e.nombre}"?` +
      (nuevoEstado ? '' : '\n\nEl cliente NO va a poder entrar al sistema hasta que lo reactives.'))) return;

    await supabase.from('companies').update({ activo: nuevoEstado }).eq('id', e.id);
    cargarEmpresas();
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                  <span style={{
                    fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600,
                    background: 'rgba(0,102,255,0.15)', color: 'var(--azul-brillante)', textTransform: 'uppercase',
                  }}>
                    {e.plan}
                  </span>
                  <span style={{
                    fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600,
                    background: e.tipo === 'familia' ? 'rgba(255,176,32,0.15)' : 'rgba(34,217,122,0.15)',
                    color: e.tipo === 'familia' ? 'var(--amarillo)' : 'var(--verde-online)',
                  }}>
                    {e.tipo === 'familia' ? '👨‍👩‍👧 Familia' : '🏢 Empresa'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px' }}>
                <div>📱 Límite dispositivos: <b style={{ color: 'var(--texto)' }}>{e.limite_dispositivos}</b></div>
                {e.telefono && <div style={{ marginTop: '4px' }}>📞 {e.telefono}</div>}
                <div style={{ marginTop: '4px' }}>
                  Estado: <b style={{ color: e.activo ? 'var(--verde-online)' : 'var(--rojo-offline)' }}>
                    {e.activo ? 'Activo' : 'Suspendido'}
                  </b>
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => abrirEditar(e)} style={s.botonChico}>Editar</button>
                <button
                  onClick={() => alternarActivo(e)}
                  style={{
                    ...s.botonChico,
                    color: e.activo ? 'var(--rojo-offline)' : 'var(--verde-online)',
                    flex: 1,
                  }}
                >
                  {e.activo ? 'Suspender' : 'Reactivar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VENTANA FLOTANTE: editar cliente existente */}
      {modalEditar && empresaEditar && (
        <VentanaFlotante titulo={`Editar: ${empresaEditar.nombre}`} onCerrar={() => setModalEditar(false)} ancho={520}>
          {/* --- DATOS DE LA EMPRESA --- */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--azul-brillante)', marginBottom: '8px' }}>
            DATOS DE LA EMPRESA
          </div>

          <label style={s.label}>Nombre de la empresa *</label>
          <input value={empresaEditar.nombre} onChange={(ev) => setEmpresaEditar({ ...empresaEditar, nombre: ev.target.value })}
            style={s.input} autoFocus />

          {/* Tipo: Empresa o Familia (define las reglas de privacidad) */}
          <label style={s.label}>Tipo de cliente</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setEmpresaEditar({ ...empresaEditar, tipo: 'empresa' })}
              style={{
                flex: 1, padding: '11px', borderRadius: '9px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                background: empresaEditar.tipo === 'empresa' ? 'rgba(34,217,122,0.15)' : 'var(--negro)',
                border: `1px solid ${empresaEditar.tipo === 'empresa' ? 'var(--verde-online)' : 'var(--gris-borde)'}`,
                color: empresaEditar.tipo === 'empresa' ? 'var(--verde-online)' : 'var(--texto-suave)',
              }}
            >
              🏢 Empresa
            </button>
            <button
              type="button"
              onClick={() => setEmpresaEditar({ ...empresaEditar, tipo: 'familia' })}
              style={{
                flex: 1, padding: '11px', borderRadius: '9px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                background: empresaEditar.tipo === 'familia' ? 'rgba(255,176,32,0.15)' : 'var(--negro)',
                border: `1px solid ${empresaEditar.tipo === 'familia' ? 'var(--amarillo)' : 'var(--gris-borde)'}`,
                color: empresaEditar.tipo === 'familia' ? 'var(--amarillo)' : 'var(--texto-suave)',
              }}
            >
              👨‍👩‍👧 Familia
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Empresa: Track normal (vos ves todo). Familia: rastreo con privacidad estricta (vos solo ves estado técnico).
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Teléfono</label>
              <input value={empresaEditar.telefono ?? ''} onChange={(ev) => setEmpresaEditar({ ...empresaEditar, telefono: ev.target.value })}
                style={s.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Email empresa</label>
              <input value={empresaEditar.email ?? ''} onChange={(ev) => setEmpresaEditar({ ...empresaEditar, email: ev.target.value })}
                style={s.input} />
            </div>
          </div>

          <label style={s.label}>Dirección</label>
          <input value={(empresaEditar as any).direccion ?? ''} onChange={(ev) => setEmpresaEditar({ ...empresaEditar, direccion: ev.target.value } as any)}
            placeholder="Opcional" style={s.input} />

          <label style={s.label}>Plan</label>
          <select value={empresaEditar.plan} onChange={(ev) => setEmpresaEditar({ ...empresaEditar, plan: ev.target.value })} style={s.input}>
            {planes.length === 0 && <option value={empresaEditar.plan}>{empresaEditar.plan}</option>}
            {planes.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </select>
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Al cambiar el plan, el límite de dispositivos se ajusta solo.
          </div>

          {/* --- USUARIO ADMINISTRADOR DEL CLIENTE --- */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--azul-brillante)', margin: '22px 0 8px' }}>
            USUARIO QUE INGRESA AL SISTEMA
          </div>

          {adminCliente ? (
            <>
              <label style={s.label}>Nombre del usuario</label>
              <input value={adminCliente.nombre} onChange={(ev) => setAdminCliente({ ...adminCliente, nombre: ev.target.value })}
                style={s.input} />

              <label style={s.label}>Email de ingreso (con este entra al sistema)</label>
              <input value={adminCliente.email} onChange={(ev) => setAdminCliente({ ...adminCliente, email: ev.target.value })}
                style={s.input} />

              <label style={s.label}>Resetear contraseña</label>
              <input value={passwordNueva} onChange={(ev) => setPasswordNueva(ev.target.value)}
                placeholder="Dejá vacío para no cambiarla" style={s.input} />
              <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
                Escribí una contraseña nueva solo si el cliente la olvidó. Mínimo 6 caracteres.
                Por seguridad, la contraseña actual no se puede ver.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--texto-tenue)', padding: '8px 0' }}>
              Cargando usuario...
            </div>
          )}

          {mensajeEdit && (
            <div style={{
              marginTop: '14px', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
              background: mensajeEdit.tipo === 'ok' ? 'rgba(34,217,122,0.15)' : 'rgba(255,77,94,0.15)',
              color: mensajeEdit.tipo === 'ok' ? 'var(--verde-online)' : 'var(--rojo-offline)',
            }}>{mensajeEdit.texto}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalEditar(false)} style={s.botonChico}>Cancelar</button>
            <button onClick={guardarEdicion} disabled={guardandoEdit} style={{ ...s.botonPrimario, opacity: guardandoEdit ? 0.6 : 1 }}>
              {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </VentanaFlotante>
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

          {/* Tipo: Empresa o Familia (define las reglas de privacidad) */}
          <label style={s.label}>Tipo de cliente</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, tipo: 'empresa' })}
              style={{
                flex: 1, padding: '11px', borderRadius: '9px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                background: form.tipo === 'empresa' ? 'rgba(34,217,122,0.15)' : 'var(--negro)',
                border: `1px solid ${form.tipo === 'empresa' ? 'var(--verde-online)' : 'var(--gris-borde)'}`,
                color: form.tipo === 'empresa' ? 'var(--verde-online)' : 'var(--texto-suave)',
              }}
            >
              🏢 Empresa
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, tipo: 'familia' })}
              style={{
                flex: 1, padding: '11px', borderRadius: '9px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                background: form.tipo === 'familia' ? 'rgba(255,176,32,0.15)' : 'var(--negro)',
                border: `1px solid ${form.tipo === 'familia' ? 'var(--amarillo)' : 'var(--gris-borde)'}`,
                color: form.tipo === 'familia' ? 'var(--amarillo)' : 'var(--texto-suave)',
              }}
            >
              👨‍👩‍👧 Familia
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Empresa: Track normal. Familia: rastreo con privacidad estricta (vos solo ves estado técnico, nunca ubicaciones).
          </div>

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
              <select value={form.plan} onChange={(e) => {
                const planElegido = planes.find((p) => p.codigo === e.target.value);
                setForm({
                  ...form,
                  plan: e.target.value,
                  limite_dispositivos: planElegido?.limite_dispositivos ?? form.limite_dispositivos,
                });
              }} style={s.input}>
                {planes.length === 0 && <option value="trial">trial</option>}
                {planes.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
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
