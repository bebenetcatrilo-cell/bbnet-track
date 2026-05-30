'use client';

// ============================================================================
// MÓDULO STOCK GPS · inventario maestro de dispositivos (solo super_admin)
// ----------------------------------------------------------------------------
// Acá BBNet ve y maneja TODOS los dispositivos GPS de todos lados:
//   - Los que están en stock (en el cajón, sin asignar) → company_id = BBNet
//   - Los instalados (asignados a un cliente y vehículo)
//   - En reparación o dados de baja
//
// Permite: crear un dispositivo nuevo (y darlo de alta solo en Traccar),
// ver el inventario completo con filtros por estado, y asignar/reasignar un
// dispositivo a un cliente + vehículo.
// ============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';

// El company_id de BBNet Security (dueño del stock sin asignar)
const BBNET_COMPANY_ID = '11111111-1111-1111-1111-111111111111';

type Dispositivo = {
  id: string;
  nombre: string;
  tipo: string;
  modelo: string | null;
  estado: string;
  device_uid: string | null;
  company_id: string;
  vehicle_id: string | null;
  online: boolean | null;
  created_at: string;
};

type Empresa = { id: string; nombre: string };
type Vehiculo = { id: string; nombre: string; company_id: string };

const ESTADOS = [
  { valor: 'stock', etiqueta: 'En stock', color: 'var(--azul-brillante)' },
  { valor: 'instalado', etiqueta: 'Instalado', color: 'var(--verde-online)' },
  { valor: 'reparacion', etiqueta: 'En reparación', color: 'var(--amarillo)' },
  { valor: 'baja', etiqueta: 'De baja', color: 'var(--texto-tenue)' },
];

const TIPOS = [
  { valor: 'gps_cableado', etiqueta: 'GPS cableado' },
  { valor: 'celular', etiqueta: 'Celular (app)' },
  { valor: 'tag', etiqueta: 'Tag / baliza' },
];

const FORM_VACIO = {
  id: '',
  nombre: '',
  tipo: 'gps_cableado',
  modelo: '',
  estado: 'stock',
  device_uid: '',
  company_id: BBNET_COMPANY_ID,
  vehicle_id: '',
};

export default function PaginaStock() {
  const supabase = createClient();
  const router = useRouter();

  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);

  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [mensajeTraccar, setMensajeTraccar] = useState('');

  // ---- Verificar que sea super_admin ----
  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: perfil } = await supabase.from('users').select('rol').eq('id', user.id).single();
      if (perfil?.rol !== 'super_admin') {
        setAutorizado(false);
        return;
      }
      setAutorizado(true);
      cargarTodo();
    }
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: disp }, { data: emp }, { data: veh }] = await Promise.all([
      supabase.from('tracker_devices').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('id, nombre').order('nombre'),
      supabase.from('vehicles').select('id, nombre, company_id').order('nombre'),
    ]);
    setDispositivos((disp ?? []) as Dispositivo[]);
    setEmpresas((emp ?? []) as Empresa[]);
    setVehiculos((veh ?? []) as Vehiculo[]);
    setCargando(false);
  }

  // ---- Abrir el modal para crear o editar ----
  function abrirNuevo() {
    setForm({ ...FORM_VACIO });
    setMensajeTraccar('');
    setModalAbierto(true);
  }

  function abrirEditar(d: Dispositivo) {
    setForm({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      modelo: d.modelo ?? '',
      estado: d.estado,
      device_uid: d.device_uid ?? '',
      company_id: d.company_id,
      vehicle_id: d.vehicle_id ?? '',
    });
    setMensajeTraccar('');
    setModalAbierto(true);
  }

  // ---- Guardar (crear o editar) ----
  async function guardar() {
    if (!form.nombre.trim()) {
      alert('Poné un nombre para el dispositivo.');
      return;
    }
    if (form.tipo === 'gps_cableado' && !form.device_uid.trim()) {
      alert('Para un GPS cableado, el IMEI es obligatorio.');
      return;
    }
    setGuardando(true);
    setMensajeTraccar('');

    const esNuevo = !form.id;

    const datos = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      modelo: form.modelo.trim() || null,
      estado: form.estado,
      device_uid: form.device_uid.trim() || null,
      company_id: form.company_id || BBNET_COMPANY_ID,
      vehicle_id: form.vehicle_id || null,
    };

    if (esNuevo) {
      await supabase.from('tracker_devices').insert(datos);
    } else {
      await supabase.from('tracker_devices').update(datos).eq('id', form.id);
    }

    // Si es un GPS cableado con IMEI, lo damos de alta en Traccar automáticamente
    // (solo al crear; Traccar ignora si ya existe gracias a la lógica de la función)
    if (esNuevo && form.tipo === 'gps_cableado' && form.device_uid.trim()) {
      try {
        const { data, error } = await supabase.functions.invoke('crear-dispositivo-traccar', {
          body: { imei: form.device_uid.trim(), nombre: form.nombre.trim() },
        });
        if (error) {
          setMensajeTraccar('⚠️ Se guardó, pero no se pudo crear en Traccar. Revisalo a mano.');
        } else if (data?.ok) {
          setMensajeTraccar(data.yaExistia
            ? '✓ Guardado (ya existía en Traccar).'
            : '✓ Guardado y creado en Traccar.');
        } else {
          setMensajeTraccar('⚠️ Se guardó, pero Traccar devolvió un error. Revisalo a mano.');
        }
      } catch {
        setMensajeTraccar('⚠️ Se guardó, pero no se pudo conectar con Traccar.');
      }
    }

    setGuardando(false);
    // Si hubo mensaje de Traccar, dejamos el modal abierto un momento para que lo lea
    if (!mensajeTraccar) {
      setModalAbierto(false);
    }
    cargarTodo();
  }

  async function eliminar(d: Dispositivo) {
    if (!confirm(`¿Seguro que querés eliminar "${d.nombre}"?\n\n(Esto NO lo borra de Traccar, solo de tu panel.)`)) return;
    await supabase.from('tracker_devices').delete().eq('id', d.id);
    cargarTodo();
  }

  // ---- Helpers de visualización ----
  function nombreEmpresa(id: string): string {
    return empresas.find((e) => e.id === id)?.nombre ?? '—';
  }
  function nombreVehiculo(id: string | null): string {
    if (!id) return '—';
    return vehiculos.find((v) => v.id === id)?.nombre ?? '—';
  }
  function infoEstado(estado: string) {
    return ESTADOS.find((e) => e.valor === estado) ?? { etiqueta: estado, color: 'var(--texto-suave)' };
  }

  // Vehículos filtrados por la empresa elegida en el form (para el selector)
  const vehiculosDeEmpresa = vehiculos.filter((v) => v.company_id === form.company_id);

  // Lista filtrada por búsqueda y estado
  const filtrados = dispositivos.filter((d) => {
    const t = busqueda.toLowerCase();
    const coincideBusqueda =
      d.nombre.toLowerCase().includes(t) ||
      (d.device_uid ?? '').toLowerCase().includes(t) ||
      (d.modelo ?? '').toLowerCase().includes(t);
    const coincideEstado = filtroEstado === 'todos' || d.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  // Contadores por estado (para las tarjetas de arriba)
  const conteo = (estado: string) => dispositivos.filter((d) => d.estado === estado).length;

  // ---- Render ----
  if (autorizado === false) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--texto-suave)' }}>
        Esta sección es solo para administradores.
      </div>
    );
  }
  if (autorizado === null) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--texto-suave)' }}>Cargando...</div>;
  }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Stock GPS</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Inventario de todos tus dispositivos
          </p>
        </div>
        <button onClick={abrirNuevo} style={s.btnPrimario}>+ Nuevo dispositivo</button>
      </div>

      {/* Tarjetas de conteo por estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        {ESTADOS.map((e) => (
          <div key={e.valor} style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: e.color }}>{conteo(e.valor)}</div>
            <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '2px' }}>{e.etiqueta}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <input
          placeholder="Buscar por nombre, IMEI o modelo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ ...s.input, flex: '1 1 240px', maxWidth: '360px' }}
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ ...s.input, maxWidth: '200px' }}>
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ color: 'var(--texto-suave)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={s.th}>Dispositivo</th>
                <th style={s.th}>Modelo</th>
                <th style={s.th}>IMEI</th>
                <th style={s.th}>Estado</th>
                <th style={s.th}>Cliente</th>
                <th style={s.th}>Vehículo</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--texto-suave)' }}>No hay dispositivos para mostrar.</td></tr>
              ) : (
                filtrados.map((d) => {
                  const est = infoEstado(d.estado);
                  return (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--gris-borde)' }}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{d.nombre}</td>
                      <td style={{ ...s.td, color: 'var(--texto-suave)' }}>{d.modelo ?? '—'}</td>
                      <td style={{ ...s.td, fontFamily: 'monospace', color: 'var(--texto-suave)' }}>{d.device_uid ?? '—'}</td>
                      <td style={s.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: est.color, display: 'inline-block' }} />
                          {est.etiqueta}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: d.company_id === BBNET_COMPANY_ID ? 'var(--texto-tenue)' : 'var(--texto)' }}>
                        {d.company_id === BBNET_COMPANY_ID && d.estado === 'stock' ? '— (en stock)' : nombreEmpresa(d.company_id)}
                      </td>
                      <td style={{ ...s.td, color: 'var(--texto-suave)' }}>{nombreVehiculo(d.vehicle_id)}</td>
                      <td style={{ ...s.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => abrirEditar(d)} style={s.btnChico}>Editar</button>
                        <button onClick={() => eliminar(d)} style={{ ...s.btnChico, color: 'var(--rojo-offline)' }}>Eliminar</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de crear/editar */}
      {modalAbierto && (
        <VentanaFlotante titulo={form.id ? 'Editar dispositivo' : 'Nuevo dispositivo'} onCerrar={() => setModalAbierto(false)} ancho={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={s.label}>Nombre *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={s.input} placeholder="Ej: GPS Camión 1" />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>
                  {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Modelo</label>
                <input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} style={s.input} placeholder="Ej: Concox GT06E" />
              </div>
            </div>

            {form.tipo === 'gps_cableado' && (
              <div>
                <label style={s.label}>IMEI * <span style={{ color: 'var(--texto-tenue)', fontWeight: 400 }}>(la llave que conecta todo)</span></label>
                <input value={form.device_uid} onChange={(e) => setForm({ ...form, device_uid: e.target.value })} style={{ ...s.input, fontFamily: 'monospace' }} placeholder="Ej: 868120303456789" disabled={!!form.id} />
                {form.id && <div style={{ fontSize: '11px', color: 'var(--texto-tenue)', marginTop: '4px' }}>El IMEI no se puede cambiar una vez creado.</div>}
              </div>
            )}

            <div>
              <label style={s.label}>Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} style={s.input}>
                {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
              </select>
            </div>

            {/* Asignación a cliente y vehículo */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Cliente</label>
                <select
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value, vehicle_id: '' })}
                  style={s.input}
                >
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.id === BBNET_COMPANY_ID ? `${emp.nombre} (stock propio)` : emp.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Vehículo</label>
                <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} style={s.input}>
                  <option value="">Sin asignar</option>
                  {vehiculosDeEmpresa.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </div>
            </div>

            {mensajeTraccar && (
              <div style={{
                fontSize: '13px', padding: '10px 12px', borderRadius: '8px',
                background: mensajeTraccar.startsWith('✓') ? 'rgba(34,217,122,0.12)' : 'rgba(255,176,32,0.12)',
                color: mensajeTraccar.startsWith('✓') ? 'var(--verde-online)' : 'var(--amarillo)',
              }}>{mensajeTraccar}</div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button onClick={() => setModalAbierto(false)} style={s.btnSecundario}>Cerrar</button>
              <button onClick={guardar} disabled={guardando} style={s.btnPrimario}>
                {guardando ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear dispositivo')}
              </button>
            </div>
          </div>
        </VentanaFlotante>
      )}
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  th: { textAlign: 'left', padding: '12px 18px', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '13px 18px' },
  label: { display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginBottom: '5px', fontWeight: 500 },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  },
  btnPrimario: {
    background: 'var(--azul-electrico)', color: '#fff', border: 'none', borderRadius: '9px',
    padding: '11px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  btnSecundario: {
    background: 'transparent', color: 'var(--texto-suave)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '11px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  btnChico: {
    background: 'transparent', color: 'var(--texto-suave)', border: '1px solid var(--gris-borde)',
    borderRadius: '7px', padding: '6px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginLeft: '6px',
  },
};
