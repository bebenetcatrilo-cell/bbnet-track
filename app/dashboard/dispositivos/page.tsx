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

type Dispositivo = {
  id: string;
  nombre: string;
  tipo: string;
  device_uid: string | null;
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
  vehicle_id: '',
  activo: true,
};

export default function PaginaDispositivos() {
  const supabase = createClient();

  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<typeof DISPOSITIVO_VACIO>(DISPOSITIVO_VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: disps }, { data: vehs }] = await Promise.all([
      supabase.from('tracker_devices').select('*').order('nombre'),
      supabase.from('vehicles').select('id, nombre').order('nombre'),
    ]);
    setDispositivos(disps ?? []);
    setVehiculos(vehs ?? []);
    setCargando(false);
  }

  function abrirNuevo() {
    setForm(DISPOSITIVO_VACIO);
    setModalAbierto(true);
  }

  function abrirEditar(d: Dispositivo) {
    setForm({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      device_uid: d.device_uid ?? '',
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
        <button onClick={abrirNuevo} style={s.botonPrimario}>+ Nuevo dispositivo</button>
      </div>

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
                  background: d.online ? 'rgba(34,217,122,0.15)' : 'var(--gris-medio)',
                  color: d.online ? 'var(--verde-online)' : 'var(--texto-tenue)',
                }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: d.online ? 'var(--verde-online)' : 'var(--texto-tenue)',
                  }} />
                  {d.online ? 'Online' : 'Offline'}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px' }}>
                <div>🚗 Vehículo: <b style={{ color: 'var(--texto)' }}>{vehiculoDe(d.vehicle_id)}</b></div>
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
