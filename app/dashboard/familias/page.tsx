'use client';

// ============================================================================
// SECCIÓN FAMILIAS · panel del SUPER-ADMIN (solo visible para vos)
// ----------------------------------------------------------------------------
// Acá das de alta y gestionás familias que contratan Track Familia.
// Funciona igual que la sección Clientes, pero solo muestra companies con
// tipo='familia', y al crear una nueva siempre se marca como tipo='familia'.
//
// IMPORTANTE - PRIVACIDAD:
// Acá NO se muestran ubicaciones ni mapas. Solo lo administrativo: nombre,
// contacto, plan, cantidad de integrantes contratados, estado.
// Las ubicaciones de los integrantes solo las ve cada familia desde su propio
// login. Vos (proveedor) nunca las ves.
//
// Reutiliza las mismas Edge Functions que clientes (crear-cliente y
// editar-cliente), porque hacen exactamente el mismo trabajo en la base.
// La única diferencia es que acá siempre se manda tipo='familia'.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';

type Familia = {
  id: string;
  nombre: string;
  slug: string;
  telefono: string | null;
  email: string | null;
  plan: string;
  limite_dispositivos: number;  // = cantidad de integrantes contratados
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
  familia_nombre: '',
  familia_telefono: '',
  familia_email: '',
  familia_direccion: '',
  plan: 'trial',
  limite_dispositivos: 5,
  admin_nombre: '',
  admin_email: '',
  admin_password: '',
};

export default function PaginaFamilias() {
  const router = useRouter();
  const supabase = createClient();

  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal de nueva familia
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Modal de edición
  const [modalEditar, setModalEditar] = useState(false);
  const [familiaEditar, setFamiliaEditar] = useState<Familia | null>(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [adminFamilia, setAdminFamilia] = useState<{ id: string; nombre: string; email: string } | null>(null);
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
      if (ok) cargarFamilias();
      else setCargando(false);
    }
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarFamilias() {
    setCargando(true);
    // OJO: filtramos por tipo='familia'. Solo traemos familias acá.
    const [{ data: fams }, { data: plns }] = await Promise.all([
      supabase.from('companies').select('*').eq('tipo', 'familia').order('created_at', { ascending: false }),
      supabase.from('planes').select('codigo, nombre, limite_dispositivos').eq('activo', true).order('orden'),
    ]);
    setFamilias(fams ?? []);
    setPlanes(plns ?? []);
    setCargando(false);
  }

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setMensaje(null);
    setModalAbierto(true);
  }

  async function crearFamilia() {
    // Validaciones básicas
    if (!form.familia_nombre.trim() || !form.admin_email.trim() || !form.admin_password.trim()) {
      setMensaje({ tipo: 'error', texto: 'Completá al menos: nombre de la familia, mail y contraseña.' });
      return;
    }
    if (form.admin_password.length < 6) {
      setMensaje({ tipo: 'error', texto: 'La contraseña tiene que tener al menos 6 caracteres.' });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    // Llamamos a la Edge Function "crear-cliente" pero forzando tipo='familia'.
    // Es la misma función que usa Clientes; solo cambia el tipo.
    const { data, error } = await supabase.functions.invoke('crear-cliente', {
      body: {
        empresa_nombre: form.familia_nombre.trim(),
        empresa_telefono: form.familia_telefono.trim(),
        empresa_email: form.familia_email.trim(),
        empresa_direccion: form.familia_direccion.trim(),
        tipo: 'familia',  // <-- esto la marca como Track Familia
        plan: form.plan,
        limite_dispositivos: Number(form.limite_dispositivos) || 5,
        admin_nombre: form.admin_nombre.trim(),
        admin_email: form.admin_email.trim(),
        admin_password: form.admin_password,
      },
    });

    setGuardando(false);

    const errorDevuelto = (data as any)?.error;
    if (error || errorDevuelto) {
      setMensaje({ tipo: 'error', texto: errorDevuelto || error?.message || 'No se pudo crear la familia.' });
      return;
    }

    setMensaje({ tipo: 'ok', texto: '¡Familia creada correctamente!' });
    setForm(FORM_VACIO);
    cargarFamilias();
    setTimeout(() => setModalAbierto(false), 1200);
  }

  async function abrirEditar(f: Familia) {
    setFamiliaEditar({ ...f });
    setPasswordNueva('');
    setMensajeEdit(null);
    setAdminFamilia(null);
    setModalEditar(true);
    // Buscar el usuario admin de esta familia
    const { data } = await supabase
      .from('users')
      .select('id, nombre, email')
      .eq('company_id', f.id)
      .eq('rol', 'admin')
      .limit(1)
      .maybeSingle();
    if (data) setAdminFamilia({ id: data.id, nombre: data.nombre ?? '', email: data.email ?? '' });
  }

  async function guardarEdicion() {
    if (!familiaEditar) return;
    if (!familiaEditar.nombre.trim()) {
      setMensajeEdit({ tipo: 'error', texto: 'El nombre no puede quedar vacío.' });
      return;
    }
    if (passwordNueva && passwordNueva.length < 6) {
      setMensajeEdit({ tipo: 'error', texto: 'La contraseña nueva debe tener al menos 6 caracteres.' });
      return;
    }
    setGuardandoEdit(true);
    setMensajeEdit(null);

    const planElegido = planes.find((p) => p.codigo === familiaEditar.plan);

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
            empresa_id: familiaEditar.id,
            empresa_nombre: familiaEditar.nombre.trim(),
            empresa_telefono: familiaEditar.telefono?.trim() || null,
            empresa_email: familiaEditar.email?.trim() || null,
            empresa_direccion: (familiaEditar as any).direccion?.trim() || null,
            // OJO: NO mandamos tipo acá. Si una familia ya está en tipo='familia',
            // no la queremos pasar a 'empresa' por error. Si en el futuro hace falta
            // mover entre categorías, se hace desde Clientes con el selector.
            plan: familiaEditar.plan,
            limite_dispositivos: planElegido?.limite_dispositivos ?? familiaEditar.limite_dispositivos,
            admin_id: adminFamilia?.id ?? null,
            admin_nombre: adminFamilia?.nombre ?? null,
            admin_email: adminFamilia?.email ?? null,
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
      cargarFamilias();
    } catch (err) {
      setMensajeEdit({ tipo: 'error', texto: 'Error de conexión. Probá de nuevo.' });
      setGuardandoEdit(false);
    }
  }

  async function alternarActivo(f: Familia) {
    const nuevoEstado = !f.activo;
    const accion = nuevoEstado ? 'reactivar' : 'suspender';
    if (!confirm(`¿Seguro que querés ${accion} a "${f.nombre}"?` +
      (nuevoEstado ? '' : '\n\nLa familia NO va a poder entrar al sistema hasta que la reactives.'))) return;

    await supabase.from('companies').update({ activo: nuevoEstado }).eq('id', f.id);
    cargarFamilias();
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
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Familias</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Familias que contratan BBNet Track Familia · alta y gestión
          </p>
        </div>
        <button onClick={abrirNuevo} style={s.botonPrimario}>+ Nueva familia</button>
      </div>

      {/* Cartel chico recordando la privacidad */}
      <div style={{
        background: 'rgba(255,176,32,0.08)',
        border: '1px solid rgba(255,176,32,0.25)',
        borderRadius: '10px',
        padding: '12px 14px',
        marginBottom: '20px',
        fontSize: '13px',
        color: 'var(--texto-suave)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}>
        <span style={{ fontSize: '18px' }}>🔒</span>
        <span>
          <b style={{ color: 'var(--amarillo)' }}>Privacidad de Track Familia:</b> desde acá vos solo
          gestionás lo administrativo (alta, plan, cobranza, estado técnico). Las ubicaciones de los
          integrantes son privadas y solo las ve cada familia desde su propio login.
        </span>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : familias.length === 0 ? (
        <div style={{ ...s.tarjeta, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👨‍👩‍👧</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Todavía no hay familias cargadas</div>
          <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '6px' }}>
            Tocá "Nueva familia" para dar de alta la primera.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {familias.map((f) => (
            <div key={f.id} style={s.tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>👨‍👩‍👧 {f.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                    {f.email || 'sin email'}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600,
                  background: 'rgba(255,176,32,0.15)', color: 'var(--amarillo)', textTransform: 'uppercase',
                }}>
                  {f.plan}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px' }}>
                <div>👥 Integrantes contratados: <b style={{ color: 'var(--texto)' }}>{f.limite_dispositivos}</b></div>
                {f.telefono && <div style={{ marginTop: '4px' }}>📞 {f.telefono}</div>}
                <div style={{ marginTop: '4px' }}>
                  Estado: <b style={{ color: f.activo ? 'var(--verde-online)' : 'var(--rojo-offline)' }}>
                    {f.activo ? 'Activa' : 'Suspendida'}
                  </b>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => abrirEditar(f)} style={s.botonChico}>Editar</button>
                <button
                  onClick={() => alternarActivo(f)}
                  style={{
                    ...s.botonChico,
                    color: f.activo ? 'var(--rojo-offline)' : 'var(--verde-online)',
                    flex: 1,
                  }}
                >
                  {f.activo ? 'Suspender' : 'Reactivar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VENTANA FLOTANTE: editar familia existente */}
      {modalEditar && familiaEditar && (
        <VentanaFlotante titulo={`Editar familia: ${familiaEditar.nombre}`} onCerrar={() => setModalEditar(false)} ancho={520}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amarillo)', marginBottom: '8px' }}>
            DATOS DE LA FAMILIA
          </div>

          <label style={s.label}>Nombre de la familia *</label>
          <input value={familiaEditar.nombre} onChange={(ev) => setFamiliaEditar({ ...familiaEditar, nombre: ev.target.value })}
            placeholder="Ej: Familia González" style={s.input} autoFocus />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Teléfono</label>
              <input value={familiaEditar.telefono ?? ''} onChange={(ev) => setFamiliaEditar({ ...familiaEditar, telefono: ev.target.value })}
                style={s.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Email de contacto</label>
              <input value={familiaEditar.email ?? ''} onChange={(ev) => setFamiliaEditar({ ...familiaEditar, email: ev.target.value })}
                style={s.input} />
            </div>
          </div>

          <label style={s.label}>Dirección</label>
          <input value={(familiaEditar as any).direccion ?? ''} onChange={(ev) => setFamiliaEditar({ ...familiaEditar, direccion: ev.target.value } as any)}
            placeholder="Opcional" style={s.input} />

          <label style={s.label}>Plan</label>
          <select value={familiaEditar.plan} onChange={(ev) => setFamiliaEditar({ ...familiaEditar, plan: ev.target.value })} style={s.input}>
            {planes.length === 0 && <option value={familiaEditar.plan}>{familiaEditar.plan}</option>}
            {planes.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </select>
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Al cambiar el plan, la cantidad de integrantes contratados se ajusta sola.
          </div>

          {/* USUARIO de la familia */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amarillo)', margin: '22px 0 8px' }}>
            CONTACTO PRINCIPAL (el que entra al sistema)
          </div>

          {adminFamilia ? (
            <>
              <label style={s.label}>Nombre del contacto</label>
              <input value={adminFamilia.nombre} onChange={(ev) => setAdminFamilia({ ...adminFamilia, nombre: ev.target.value })}
                style={s.input} />

              <label style={s.label}>Email de ingreso (con este entra al sistema)</label>
              <input value={adminFamilia.email} onChange={(ev) => setAdminFamilia({ ...adminFamilia, email: ev.target.value })}
                style={s.input} />

              <label style={s.label}>Resetear contraseña</label>
              <input value={passwordNueva} onChange={(ev) => setPasswordNueva(ev.target.value)}
                placeholder="Dejá vacío para no cambiarla" style={s.input} />
              <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
                Escribí una contraseña nueva solo si el contacto la olvidó. Mínimo 6 caracteres.
                Por seguridad, la contraseña actual no se puede ver.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--texto-tenue)', fontStyle: 'italic' }}>
              No se encontró un usuario contacto para esta familia.
            </div>
          )}

          {mensajeEdit && (
            <div style={{
              marginTop: '16px', padding: '11px 14px', borderRadius: '10px', fontSize: '13px',
              background: mensajeEdit.tipo === 'ok' ? 'rgba(34,217,122,0.12)' : 'rgba(255,77,94,0.12)',
              border: `1px solid ${mensajeEdit.tipo === 'ok' ? 'rgba(34,217,122,0.3)' : 'rgba(255,77,94,0.3)'}`,
              color: mensajeEdit.tipo === 'ok' ? 'var(--verde-online)' : 'var(--rojo-offline)',
            }}>
              {mensajeEdit.texto}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalEditar(false)} style={s.botonChico}>Cancelar</button>
            <button onClick={guardarEdicion} disabled={guardandoEdit} style={{ ...s.botonPrimario, opacity: guardandoEdit ? 0.6 : 1 }}>
              {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </VentanaFlotante>
      )}

      {/* VENTANA FLOTANTE: nueva familia */}
      {modalAbierto && (
        <VentanaFlotante titulo="Nueva familia" onCerrar={() => setModalAbierto(false)} ancho={520}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amarillo)', marginBottom: '4px' }}>
            DATOS DE LA FAMILIA
          </div>

          <label style={s.label}>Nombre de la familia *</label>
          <input value={form.familia_nombre} onChange={(e) => setForm({ ...form, familia_nombre: e.target.value })}
            placeholder="Ej: Familia González" style={s.input} autoFocus />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Teléfono</label>
              <input value={form.familia_telefono} onChange={(e) => setForm({ ...form, familia_telefono: e.target.value })}
                placeholder="2954..." style={s.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Email de contacto</label>
              <input value={form.familia_email} onChange={(e) => setForm({ ...form, familia_email: e.target.value })}
                placeholder="familia@email.com" style={s.input} />
            </div>
          </div>

          <label style={s.label}>Dirección</label>
          <input value={form.familia_direccion} onChange={(e) => setForm({ ...form, familia_direccion: e.target.value })}
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
              <label style={s.label}>Integrantes contratados</label>
              <input type="number" value={form.limite_dispositivos}
                onChange={(e) => setForm({ ...form, limite_dispositivos: Number(e.target.value) })}
                style={s.input} />
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amarillo)', marginTop: '20px', marginBottom: '4px' }}>
            CONTACTO PRINCIPAL (el que va a entrar)
          </div>

          <label style={s.label}>Nombre del contacto</label>
          <input value={form.admin_nombre} onChange={(e) => setForm({ ...form, admin_nombre: e.target.value })}
            placeholder="Ej: Juan González" style={s.input} />

          <label style={s.label}>Email de acceso *</label>
          <input value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
            placeholder="contacto@familia.com" style={s.input} />

          <label style={s.label}>Contraseña *</label>
          <input value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
            placeholder="Mínimo 6 caracteres" style={s.input} />
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Anotá esta contraseña: es la que le vas a pasar al contacto de la familia para que entre.
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
            <button onClick={crearFamilia} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Creando...' : 'Crear familia'}
            </button>
          </div>
        </VentanaFlotante>
      )}
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  // Para Familias usamos un botón con tono amarillo/dorado (diferente del azul de Empresa)
  // para reforzar visualmente que es otro producto/sector.
  botonPrimario: {
    background: 'linear-gradient(135deg, #ffb020, #ff8c00)',
    border: 'none', borderRadius: '10px', padding: '11px 18px', color: '#fff',
    fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 18px rgba(255,176,32,0.25)',
    cursor: 'pointer',
  },
  botonChico: {
    background: 'var(--gris-medio)', border: '1px solid var(--gris-borde)', borderRadius: '8px',
    padding: '8px 14px', color: 'var(--texto)', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer',
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
