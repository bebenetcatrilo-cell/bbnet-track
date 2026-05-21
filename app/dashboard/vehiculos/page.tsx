'use client';

// ============================================================================
// SECCIÓN VEHÍCULOS · ABM completo (Alta, Baja, Modificación)
// ----------------------------------------------------------------------------
// Lista los vehículos de la empresa y permite crear, editar y eliminar.
// En el formulario también se puede asignar/cambiar el dispositivo rastreador
// (celular o GPS) de cada vehículo.
//
// Todo respeta la seguridad multiempresa: cada empresa ve solo SUS vehículos.
// ============================================================================

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

// Formulario vacío para "nuevo vehículo"
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

  // Estado del modal (formulario)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState<typeof VEHICULO_VACIO>(VEHICULO_VACIO);
  const [dispositivoElegido, setDispositivoElegido] = useState<string>(''); // id del dispositivo asignado
  const [guardando, setGuardando] = useState(false);

  // Cargar datos al inicio
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

  // Abrir modal para crear uno nuevo
  function abrirNuevo() {
    setForm(VEHICULO_VACIO);
    setDispositivoElegido('');
    setModalAbierto(true);
  }

  // Abrir modal para editar uno existente
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
    // Buscamos si ya tiene un dispositivo asignado
    const disp = dispositivos.find((d) => d.vehicle_id === v.id);
    setDispositivoElegido(disp?.id ?? '');
    setModalAbierto(true);
  }

  // Guardar (crear o actualizar)
  async function guardar() {
    if (!form.nombre.trim()) {
      alert('Poné al menos un nombre para el vehículo.');
      return;
    }
    setGuardando(true);

    let vehicleId = form.id;

    if (form.id) {
      // ACTUALIZAR vehículo existente
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
      // CREAR vehículo nuevo. Necesitamos el company_id del usuario.
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

    // Manejar la asignación del dispositivo
    if (vehicleId) {
      // Primero, soltamos cualquier dispositivo que estuviera en este vehículo
      await supabase
        .from('tracker_devices')
        .update({ vehicle_id: null })
        .eq('vehicle_id', vehicleId);

      // Si se eligió uno, lo asignamos
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

  // Eliminar
  async function eliminar(v: Vehiculo) {
    if (!confirm(`¿Seguro que querés eliminar "${v.nombre}"?`)) return;
    await supabase.from('vehicles').delete().eq('id', v.id);
    cargarTodo();
  }

  // Filtrado por búsqueda
  const vehiculosFiltrados = vehiculos.filter((v) => {
    const t = busqueda.toLowerCase();
    return (
      v.nombre.toLowerCase().includes(t) ||
      (v.patente ?? '').toLowerCase().includes(t) ||
      (v.marca ?? '').toLowerCase().includes(t)
    );
  });

  // Dispositivos disponibles para asignar:
  // los que no tienen vehículo, MÁS el que ya está asignado a este vehículo
  const dispositivosDisponibles = dispositivos.filter(
    (d) => !d.vehicle_id || d.id === dispositivoElegido
  );

  // Nombre del dispositivo de un vehículo (para mostrar en la lista)
  function dispositivoDe(vehicleId: string): string {
    const d = dispositivos.find((x) => x.vehicle_id === vehicleId);
    return d ? d.nombre : '—';
  }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Vehículos</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Administrá tu flota y asigná los dispositivos de rastreo
          </p>
        </div>
        <button onClick={abrirNuevo} style={s.botonPrimario}>+ Nuevo vehículo</button>
      </div>

      {/* Buscador */}
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, patente o marca..."
        style={s.buscador}
      />

      {/* Lista */}
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

      {/* MODAL del formulario */}
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
                    <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
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

            {/* Asignación de dispositivo */}
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

            {/* Activo */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              Vehículo activo
            </label>

            {/* Botones */}
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
