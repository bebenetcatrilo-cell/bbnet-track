'use client';

// ============================================================================
// SECCIÓN EVENTOS / ALERTAS · lo que el cliente ve de seguridad
// ----------------------------------------------------------------------------
// Muestra los eventos que mandó el GPS de cada vehículo del cliente:
// encendido/apagado, manipulación, vibración, corte de energía, etc.
// Vienen de la tabla 'alerts' (los carga la Edge Function recibir-traccar).
//
// El cliente ve solo los eventos de SU empresa (filtrado por company_id).
// Puede filtrar por tipo, ver el detalle, y marcar como leídos.
// ============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { getMiCompanyId } from '@/lib/mi-empresa';

type Evento = {
  id: string;
  vehicle_id: string | null;
  tipo: string;
  mensaje: string;
  latitud: number | null;
  longitud: number | null;
  leida: boolean;
  fecha: string;
};

type Vehiculo = { id: string; nombre: string };

// Cómo se ve cada tipo de evento: ícono (emoji), color y si es "grave"
const ESTILO_EVENTO: Record<string, { emoji: string; color: string; grave: boolean }> = {
  encendido:        { emoji: '🟢', color: 'var(--verde-online)', grave: false },
  apagado:          { emoji: '⚫', color: 'var(--texto-suave)', grave: false },
  conectado:        { emoji: '🔵', color: 'var(--azul-brillante)', grave: false },
  desconectado:     { emoji: '⚪', color: 'var(--texto-tenue)', grave: false },
  manipulacion:     { emoji: '⚠️', color: 'var(--rojo-offline)', grave: true },
  vibracion:        { emoji: '📳', color: 'var(--amarillo)', grave: true },
  corte_energia:    { emoji: '🔌', color: 'var(--rojo-offline)', grave: true },
  bateria_baja:     { emoji: '🔋', color: 'var(--amarillo)', grave: true },
  sos:              { emoji: '🆘', color: 'var(--rojo-offline)', grave: true },
  exceso_velocidad: { emoji: '🚀', color: 'var(--amarillo)', grave: true },
  salida_zona:      { emoji: '📍', color: 'var(--amarillo)', grave: true },
  entrada_zona:     { emoji: '📍', color: 'var(--azul-brillante)', grave: false },
  desconexion:      { emoji: '⚠️', color: 'var(--rojo-offline)', grave: true },
};

function estiloDe(tipo: string) {
  return ESTILO_EVENTO[tipo] ?? { emoji: '🔔', color: 'var(--texto-suave)', grave: false };
}

export default function PaginaEventos() {
  const supabase = createClient();

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'graves' | 'no_leidos'>('todos');

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    setCargando(true);
    const miEmpresa = await getMiCompanyId();
    if (!miEmpresa) { setCargando(false); return; }

    const [{ data: evs }, { data: vehs }] = await Promise.all([
      supabase.from('alerts').select('*').eq('company_id', miEmpresa).order('fecha', { ascending: false }).limit(200),
      supabase.from('vehicles').select('id, nombre').eq('company_id', miEmpresa),
    ]);
    setEventos((evs ?? []) as Evento[]);
    setVehiculos((vehs ?? []) as Vehiculo[]);
    setCargando(false);
  }

  function nombreVehiculo(id: string | null): string {
    if (!id) return 'Vehículo';
    return vehiculos.find((v) => v.id === id)?.nombre ?? 'Vehículo';
  }

  async function marcarLeida(ev: Evento) {
    await supabase.from('alerts').update({ leida: true }).eq('id', ev.id);
    setEventos((prev) => prev.map((e) => e.id === ev.id ? { ...e, leida: true } : e));
  }

  async function marcarTodasLeidas() {
    const miEmpresa = await getMiCompanyId();
    if (!miEmpresa) return;
    await supabase.from('alerts').update({ leida: true }).eq('company_id', miEmpresa).eq('leida', false);
    setEventos((prev) => prev.map((e) => ({ ...e, leida: true })));
  }

  // Filtrar según la pestaña elegida
  const filtrados = eventos.filter((e) => {
    if (filtro === 'graves') return estiloDe(e.tipo).grave;
    if (filtro === 'no_leidos') return !e.leida;
    return true;
  });

  const sinLeer = eventos.filter((e) => !e.leida).length;

  function fechaLinda(f: string): string {
    const d = new Date(f);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Eventos y Alertas</h1>
          <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
            Lo que detectan tus GPS: encendido, manipulación, y más
            {sinLeer > 0 && <span style={{ color: 'var(--amarillo)', fontWeight: 600 }}> · {sinLeer} sin leer</span>}
          </p>
        </div>
        {sinLeer > 0 && (
          <button onClick={marcarTodasLeidas} style={s.btnSecundario}>Marcar todas como leídas</button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[
          { v: 'todos', t: 'Todos' },
          { v: 'graves', t: '⚠️ Importantes' },
          { v: 'no_leidos', t: 'Sin leer' },
        ].map((op) => (
          <button
            key={op.v}
            onClick={() => setFiltro(op.v as typeof filtro)}
            style={{
              ...s.chip,
              background: filtro === op.v ? 'var(--azul-electrico)' : 'transparent',
              color: filtro === op.v ? '#fff' : 'var(--texto-suave)',
              borderColor: filtro === op.v ? 'var(--azul-electrico)' : 'var(--gris-borde)',
            }}
          >
            {op.t}
          </button>
        ))}
      </div>

      {/* Lista de eventos */}
      {cargando ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--texto-suave)' }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--texto-suave)', background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '14px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔔</div>
          No hay eventos para mostrar.
          <div style={{ fontSize: '13px', color: 'var(--texto-tenue)', marginTop: '6px' }}>
            Acá vas a ver cuando un vehículo se encienda, se apague, o si alguien manipula el GPS.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map((ev) => {
            const est = estiloDe(ev.tipo);
            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: 'var(--gris-oscuro)',
                  border: `1px solid ${ev.leida ? 'var(--gris-borde)' : est.color}`,
                  borderLeft: `4px solid ${est.color}`,
                  borderRadius: '12px', padding: '14px 16px',
                  opacity: ev.leida ? 0.65 : 1,
                }}
              >
                <div style={{ fontSize: '24px' }}>{est.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: est.color, fontSize: '15px' }}>{ev.mensaje}</div>
                  <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                    {nombreVehiculo(ev.vehicle_id)} · {fechaLinda(ev.fecha)}
                  </div>
                </div>
                {ev.latitud != null && ev.longitud != null && (
                  <a
                    href={`https://www.google.com/maps?q=${ev.latitud},${ev.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={s.btnMapa}
                  >
                    Ver en mapa
                  </a>
                )}
                {!ev.leida && (
                  <button onClick={() => marcarLeida(ev)} style={s.btnChico}>Marcar leída</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s: { [k: string]: React.CSSProperties } = {
  chip: {
    border: '1px solid var(--gris-borde)', borderRadius: '8px',
    padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnSecundario: {
    background: 'transparent', color: 'var(--texto-suave)', border: '1px solid var(--gris-borde)',
    borderRadius: '9px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnChico: {
    background: 'transparent', color: 'var(--texto-suave)', border: '1px solid var(--gris-borde)',
    borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnMapa: {
    background: 'transparent', color: 'var(--azul-brillante)', border: '1px solid var(--gris-borde)',
    borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    textDecoration: 'none', whiteSpace: 'nowrap',
  },
};
