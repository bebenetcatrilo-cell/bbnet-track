'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

type Vehiculo = {
  id: string;
  nombre: string;
  patente: string | null;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  activo: boolean;
};

type Dispositivo = {
  id: string;
  nombre: string;
  tipo: string;
  vehicle_id: string | null;
};

const TIPOS_VEHICULO = ['auto', 'camioneta', 'camion', 'moto'];

const VEHICULO_VACIO = {
  id: '',
  nombre: '',
  patente: '',
  tipo: 'auto',
  marca: '',
  modelo: '',
  color: '',
  activo: true,
};

export default function PaginaVehiculos() {
  const supabase = createClient();

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<typeof VEHICULO_VACIO>(VEHICULO_VACIO);
  const [dispositivoElegido, setDispositivoElegido] = useState<string>('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: vehs }, { data: disps }] = await Promise.all([
      supabase.from('vehicles').select('*').order('nombre'),
      supabase.from('tracker_devices').select('id, nombre, tipo, vehicle_id'),
    ]);
    setVehiculos(vehs ?? []);
    setDispositivos(disps ?? []);
    setCargando(false);
  }

  function abrirNuevo() {
    setForm(VEHICULO_VACIO);
    setDispositivoElegido('');
    setModalAbierto(true);
  }

  function abrirEditar(v: Vehiculo) {
    setForm({
      id: v.id,
      nombre: v.nombre,
      patente: v.patente ?? '',
      tipo: v.tipo,
      marca: v.marca ?? '',
      modelo: v.modelo ?? '',
      color: v.color ?? '',
      activo: v.activo,
    });
    const disp = dispositivos.find((d) => d.vehicle_id === v.id);
    setDispositivoElegido(disp?.id ?? '');
    setModalAbierto(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      alert('Poné al menos un nombre para el vehículo.');
      return;
    }
    setGuardando(true);

    let vehicleId = form.id;

    if (form.id) {
      await supabase
        .from('vehicles')
        .update({
          nombre: form.nombre.trim(),
          patente: form.patente.trim() || null,
          tipo: form.tipo,
          marca: form.marca.trim() || null,
          modelo: form.modelo.trim() || null,
          color: form.color.trim() || null,
          activo: form.activo,
        })
        .eq('id', form.id);
    } else {
      const { data: perfil } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data: nuevo } = await supabase
        .from('vehicles')
        .insert({
          company_id: perfil?.company_id,
          nombre: form.nombre.trim(),
          patente: form.patente.trim() || null,
          tipo: form.tipo,
          marca: form.marca.trim() || null,
          modelo: form.modelo.trim() || null,
          color: form.color.trim() || null,
          activo: form.activo,
        })
        .select('id')
        .single();

      vehicleId = nuevo?.id ?? '';
    }

    if (vehicleId) {
      await supabase
        .from('tracker_devices')
        .update({ vehicle_id: null })
        .eq('vehicle_id', vehicleId);

      if (dispositivoElegido) {
        await supabase
          .from('tracker_devices')
          .update({ vehicle_id: vehicleId })
          .eq('id', dispositivoElegido);
      }
    }

    setGuardando(false);
    setModalAbierto(false);
    cargarTodo();
  }

  async function eliminar(v: Vehiculo) {
    if (!confirm(`¿Seguro que querés eliminar "${v.nombre}"?`)) return;
    await supabase.from('vehicles').delete().eq('id', v.id);
    cargarTodo();
  }

  const vehiculosFiltrados = vehiculos.filter((v) => {
    const t = busqueda.toLowerCase();
    return (
      v.nombre.toLowerCase().includes(t) ||
      (v.patente ?? '').toLowerCase().includes(t) ||
      (v.marca ?? '').toLowerCase().includes(t)
    );
  });

  const dispositivosDisponibles = dispositivos.filter(
    (d) => !d.vehicle_id || d.id === dispositivoElegido
  );

  function dispositivoDe(vehicleId: string): string {
    const d = dispositivos.find((x) => x.vehicle_id === vehicleId);
    return d ? d.nombre : '—';
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Vehículos</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Administrá tu flota y asigná los dispositivos de rastreo
          </p>
        </div>
        <button onClick={abrirNuevo} style={s.botonPrimario}>+ Nuevo vehículo</button>
      </div>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, patente o marca..."
        style={s.buscador}
      />

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : vehiculosFiltrados.length === 0 ? (
        <div style={{ ...s.tarjeta, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⊞</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {vehiculos.length === 0 ? 'Todavía no cargaste vehículos' : 'No se encontraron resultados'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '6px' }}>
            {vehiculos.length === 0 && 'Tocá "Nuevo vehículo" para empezar.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {vehiculosFiltrados.map((v) => (
            <div key={v.id} style={s.tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>{v.nombre}</div>
                  <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px', textTransform: 'capitalize' }}>
                    {v.tipo}{v.patente ? ` · ${v.patente}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600,
                  background: v.activo ? 'rgba(34,217,122,0.15)' : 'var(--gris-medio)',
                  color: v.activo ? 'var(--verde-online)' : 'var(--texto-tenue)',
                }}>
                  {v.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '14px' }}>
                {(v.marca || v.modelo) && <div>{v.marca} {v.modelo}</div>}
                <div style={{ marginTop: '4px' }}>📡 Dispositivo: <b style={{ color: 'var(--texto)' }}>{dispositivoDe(v.id)}</b></div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => abrirEditar(v)} style={s.botonChico}>Editar</button>
                <button onClick={() => eliminar(v)} style={{ ...s.botonChico, color: 'var(--rojo-offline)' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <div style={s.overlay} onClick={() => setModalAbierto(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
              {form.id ? 'Editar vehículo' : 'Nuevo vehículo'}
            </h2>

            <label style={s.label}>Nombre *</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Camioneta Técnicos 1" style={s.input} autoFocus />

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Patente</label>
                <input value={form.patente} onChange={(e) => setForm({ ...form, patente: e.target.value })}
                  placeholder="AB123CD" style={s.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={s.input}>
                  {TIPOS_VEHICULO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Marca</label>
                <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  placeholder="Toyota" style={s.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Modelo</label>
                <input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  placeholder="Hilux" style={s.input} />
              </div>
            </div>

            <label style={s.label}>Dispositivo de rastreo</label>
            <select value={dispositivoElegido} onChange={(e) => setDispositivoElegido(e.target.value)} style={s.input}>
              <option value="">— Sin dispositivo —</option>
              {dispositivosDisponibles.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
              Solo aparecen los dispositivos libres (sin vehículo asignado).
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              Vehículo activo
            </label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalAbierto(false)} style={s.botonChico}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
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
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px',
  },
  modal: {
    background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '16px',
    padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
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
