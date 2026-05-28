'use client';

// ============================================================================
// SECCIÓN DISPOSITIVOS · ABM de rastreadores (celulares y GPS)
// ----------------------------------------------------------------------------
// Acá se dan de alta los dispositivos que rastrean: celulares (con la app) y
// GPS cableados (a futuro). Cada uno se puede asignar a un vehículo.
// Usa la ventana flotante (arrastrable, no se cierra al tocar afuera).
// ============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';
import { estaOnline } from '@/lib/estado-online';
import { getMiCompanyId } from '@/lib/mi-empresa';

type Dispositivo = {
  id: string;
  nombre: string;
  tipo: string;
  device_uid: string | null;
  numero_sim: string | null;
  vehicle_id: string | null;
  online: boolean;
  bateria: number | null;
  ultima_conexion: string | null;
  activo: boolean;
};

type Vehiculo = {
  id: string;
  nombre: string;
};

const TIPOS_DISPOSITIVO = [
  { valor: 'celular', etiqueta: 'Celular (app)' },
  { valor: 'gps_cableado', etiqueta: 'GPS cableado' },
  { valor: 'tag', etiqueta: 'Tag / baliza' },
];

const DISPOSITIVO_VACIO = {
  id: '',
  nombre: '',
  tipo: 'celular',
  device_uid: '',
  numero_sim: '',
  vehicle_id: '',
  activo: true,
};

export default function PaginaDispositivos() {
  const supabase = createClient();

  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Control de límite según el plan de la empresa
  const [limiteDispositivos, setLimiteDispositivos] = useState<number>(999);
  const [esSuperAdmin, setEsSuperAdmin] = useState(false);
  const [planActual, setPlanActual] = useState<string>('');
  const [avisoLimite, setAvisoLimite] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<typeof DISPOSITIVO_VACIO>(DISPOSITIVO_VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarTodo() {
    setCargando(true);
    // Solo lo de NUESTRA empresa (los clientes se ven en Servicio)
    const miEmpresa = await getMiCompanyId();
    const [{ data: disps }, { data: vehs }] = await Promise.all([
      supabase.from('tracker_devices').select('*').eq('company_id', miEmpresa).order('nombre'),
      supabase.from('vehicles').select('id, nombre').eq('company_id', miEmpresa).order('nombre'),
    ]);
    setDispositivos(disps ?? []);
    setVehiculos(vehs ?? []);

    // Averiguamos el rol y el límite del plan de la empresa
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase
        .from('users')
        .select('rol, company_id')
        .eq('id', user.id)
        .single();

      const superAdmin = perfil?.rol === 'super_admin';
      setEsSuperAdmin(superAdmin);

      // El super_admin no tiene límite; los admins de empresa sí
      if (!superAdmin && perfil?.company_id) {
        const { data: empresa } = await supabase
          .from('companies')
          .select('plan, limite_dispositivos')
          .eq('id', perfil.company_id)
          .single();
        setPlanActual(empresa?.plan ?? '');
        setLimiteDispositivos(empresa?.limite_dispositivos ?? 5);
      }
    }

    setCargando(false);
  }

  function abrirNuevo() {
    // Control de límite del plan (el super_admin no tiene límite)
    if (!esSuperAdmin && dispositivos.length >= limiteDispositivos) {
      setAvisoLimite(
        `Llegaste al límite de tu plan${planActual ? ` (${planActual})` : ''}: ${limiteDispositivos} dispositivos. ` +
        `Para sumar más, mejorá tu plan.`
      );
      return;
    }
    setForm(DISPOSITIVO_VACIO);
    setModalAbierto(true);
  }

  function abrirEditar(d: Dispositivo) {
    setForm({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      device_uid: d.device_uid ?? '',
      numero_sim: d.numero_sim ?? '',
      vehicle_id: d.vehicle_id ?? '',
      activo: d.activo,
    });
    setModalAbierto(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      alert('Poné al menos un nombre para el dispositivo.');
      return;
    }
    setGuardando(true);

    const datos = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      device_uid: form.device_uid.trim() || null,
      // El número de chip solo tiene sentido para GPS cableados.
      // Si es celular u otra cosa, lo guardamos vacío (null).
      numero_sim: form.tipo === 'gps_cableado' ? (form.numero_sim.trim() || null) : null,
      vehicle_id: form.vehicle_id || null,
      activo: form.activo,
    };

    if (form.id) {
      await supabase.from('tracker_devices').update(datos).eq('id', form.id);
    } else {
      const { data: perfil } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      await supabase.from('tracker_devices').insert({
        ...datos,
        company_id: perfil?.company_id,
      });
    }

    setGuardando(false);
    setModalAbierto(false);
    cargarTodo();
  }

  async function eliminar(d: Dispositivo) {
    if (!confirm(`¿Seguro que querés eliminar "${d.nombre}"?`)) return;
    await supabase.from('tracker_devices').delete().eq('id', d.id);
    cargarTodo();
  }

  const dispositivosFiltrados = dispositivos.filter((d) => {
    const t = busqueda.toLowerCase();
    return (
      d.nombre.toLowerCase().includes(t) ||
      (d.device_uid ?? '').toLowerCase().includes(t)
    );
  });

  function vehiculoDe(vehicleId: string | null): string {
    if (!vehicleId) return 'Sin asignar';
    const v = vehiculos.find((x) => x.id === vehicleId);
    return v ? v.nombre : 'Sin asignar';
  }

  function etiquetaTipo(tipo: string): string {
    return TIPOS_DISPOSITIVO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Dispositivos</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Los rastreadores (celulares y GPS) que reportan posición
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button onClick={abrirNuevo} style={s.botonPrimario}>+ Nuevo dispositivo</button>
          {/* Indicador de uso del plan (solo para clientes, no super_admin) */}
          {!esSuperAdmin && !cargando && (
            <span style={{ fontSize: '12px', color: dispositivos.length >= limiteDispositivos ? 'var(--rojo-offline)' : 'var(--texto-suave)' }}>
              {dispositivos.length} de {limiteDispositivos} dispositivos
            </span>
          )}
        </div>
      </div>

      {/* Cartel de aviso cuando se llega al límite */}
      {avisoLimite && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)',
          borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '14px', color: 'var(--texto)' }}>
            ⚠️ {avisoLimite}
          </div>
          <button onClick={() => setAvisoLimite(null)} style={{ ...s.botonChico, whiteSpace: 'nowrap' }}>
            Entendido
          </button>
        </div>
      )}

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o identificador..."
        style={s.buscador}
      />

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : dispositivosFiltrados.length === 0 ? (
        <div style={{ ...s.tarjeta, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⊡</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {dispositivos.length === 0 ? 'Todavía no cargaste dispositivos' : 'No se encontraron resultados'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '6px' }}>
            {dispositivos.length === 0 && 'Tocá "Nuevo dispositivo" para empezar.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {dispositivosFiltrados.map((d) => (
            <div key={d.id} style={s.tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{d.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                    {etiquetaTipo(d.tipo)}
                  </div>
                </div>
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600,
                  background: estaOnline(d.ultima_conexion) ? 'rgba(34,217,122,0.15)' : 'var(--gris-medio)',
                  color: estaOnline(d.ultima_conexion) ? 'var(--verde-online)' : 'var(--texto-tenue)',
                }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: estaOnline(d.ultima_conexion) ? 'var(--verde-online)' : 'var(--texto-tenue)',
                  }} />
                  {estaOnline(d.ultima_conexion) ? 'Online' : 'Offline'}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px' }}>
                <div>🚗 Vehículo: <b style={{ color: 'var(--texto)' }}>{vehiculoDe(d.vehicle_id)}</b></div>
                {d.tipo === 'gps_cableado' && d.numero_sim && (
                  <div style={{ marginTop: '4px' }}>📱 Chip: <b style={{ color: 'var(--texto)' }}>{d.numero_sim}</b></div>
                )}
                {d.bateria != null && <div style={{ marginTop: '4px' }}>🔋 Batería: <b style={{ color: 'var(--texto)' }}>{d.bateria}%</b></div>}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => abrirEditar(d)} style={s.botonChico}>Editar</button>
                <button onClick={() => eliminar(d)} style={{ ...s.botonChico, color: 'var(--rojo-offline)' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VENTANA FLOTANTE */}
      {modalAbierto && (
        <VentanaFlotante
          titulo={form.id ? 'Editar dispositivo' : 'Nuevo dispositivo'}
          onCerrar={() => setModalAbierto(false)}
        >
          <label style={s.label}>Nombre *</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Celular Juan / GPS Camión 3" style={s.input} autoFocus />

          <label style={s.label}>Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>
            {TIPOS_DISPOSITIVO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
            ))}
          </select>

          <label style={s.label}>Identificador del aparato</label>
          <input value={form.device_uid} onChange={(e) => setForm({ ...form, device_uid: e.target.value })}
            placeholder="IMEI del GPS o ID del celular (opcional)" style={s.input} />
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Para celulares es opcional. Para GPS cableados suele ser el IMEI.
          </div>

          {/* Número de chip: SOLO para GPS cableados (sirve para mandar comandos por SMS) */}
          {form.tipo === 'gps_cableado' && (
            <>
              <label style={s.label}>Número de chip (SIM)</label>
              <input value={form.numero_sim} onChange={(e) => setForm({ ...form, numero_sim: e.target.value })}
                placeholder="Ej: 2954123456" style={s.input} />
              <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
                El número del chip que va adentro del GPS. Lo necesitás para mandarle comandos por SMS (TIMER, PARAM, etc.).
              </div>
            </>
          )}

          <label style={s.label}>Vehículo asignado</label>
          <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} style={s.input}>
            <option value="">— Sin asignar —</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Dispositivo activo
          </label>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalAbierto(false)} style={s.botonChico}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Guardar'}
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
  buscador: {
    width: '100%', background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
    borderRadius: '10px', padding: '12px 16px', color: 'var(--texto)', fontSize: '14px',
    outline: 'none', marginBottom: '20px',
  },
  tarjeta: {
    background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)',
    borderRadius: '14px', padding: '18px',
  },
  label: {
    display: 'block', fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px',
    marginBottom: '5px', fontWeight: 500,
  },
  input: {
    width: '100%', background: 'var(--negro)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '11px 14px', color: 'var(--texto)', fontSize: '14px', outline: 'none',
  },
};
