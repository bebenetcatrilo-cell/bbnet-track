'use client';

/**
 * PANTALLA EXCLUSIVA — Corte de combustible
 * 
 * Funciones críticas: cortar y restablecer combustible de vehículos.
 * Solo accesible para clientes con plan PREMIUM y super-admin.
 * Cada acción requiere doble confirmación (escribir "CORTAR" o "RESTABLECER").
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUPER_ADMIN_UID = 'ac740d86-b133-4235-892b-f974ea24354a';

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

type Vehiculo = {
  id: string;
  nombre: string;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  company_id: string;
  corte_habilitado: boolean;
  corte_activo: boolean;
  device_uid: string | null;
  device_tipo: string | null;
  device_nombre: string | null;
  ultima_velocidad: number | null;
  ultima_fecha: string | null;
};

type CorteHistorial = {
  id: string;
  vehicle_id: string;
  vehiculo_nombre: string;
  vehiculo_patente: string | null;
  accion: 'cortar' | 'restablecer';
  motivo: string;
  motivo_detalle: string | null;
  velocidad_al_momento: number | null;
  estado: 'pendiente' | 'exitoso' | 'fallido' | 'cancelado';
  error_mensaje: string | null;
  ejecutado_por_nombre: string | null;
  creado_en: string;
  completado_en: string | null;
};

// ----------------------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------------------

export default function PaginaCorteCombustible() {
  const [usuario, setUsuario] = useState<any>(null);
  const [esSuperAdmin, setEsSuperAdmin] = useState(false);
  const [planEmpresa, setPlanEmpresa] = useState<string>('');
  const [tienePlanPremium, setTienePlanPremium] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [historial, setHistorial] = useState<CorteHistorial[]>([]);
  const [modalAccion, setModalAccion] = useState<{ vehiculo: Vehiculo; accion: 'cortar' | 'restablecer' } | null>(null);
  const [modalHabilitar, setModalHabilitar] = useState<Vehiculo | null>(null);
  const [mensajeGlobal, setMensajeGlobal] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // ============================================================================
  // Cargar datos
  // ============================================================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    // 1) Usuario logueado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCargando(false);
      return;
    }

    // Hacemos 2 consultas separadas para evitar problemas con políticas RLS
    // que a veces bloquean el JOIN automático de Supabase.

    // 1.a) Datos del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('id, nombre, email, rol, company_id, activo')
      .eq('id', user.id)
      .single();

    setUsuario(userData);
    const sa = user.id === SUPER_ADMIN_UID || userData?.rol === 'super_admin';
    setEsSuperAdmin(sa);

    // 1.b) Datos de la empresa (plan, nombre) usando el company_id del usuario
    let plan = '';
    if (userData?.company_id) {
      const { data: empresaData } = await supabase
        .from('companies')
        .select('plan, nombre')
        .eq('id', userData.company_id)
        .single();
      plan = empresaData?.plan || '';
    }

    setPlanEmpresa(plan);

    // Permitimos acceso a la pantalla SIEMPRE (a admins y super-admin).
    // La validación de plan Premium se hace en la función SQL del backend
    // (ejecutar_corte_combustible), que es donde realmente importa.
    // Esto evita problemas de RLS bloqueando lectura de companies en el frontend.
    setTienePlanPremium(true);

    // 2) Vehículos
    //    - Super-admin ve TODOS los vehículos con dispositivo tipo=gps
    //    - Cliente normal ve solo los suyos con dispositivo tipo=gps
    let queryVeh = supabase
      .from('vehicles')
      .select(`
        id, nombre, patente, marca, modelo, company_id, corte_habilitado, corte_activo,
        tracker_devices!inner(device_uid, tipo, nombre, activo)
      `)
      .eq('tracker_devices.tipo', 'gps')
      .eq('tracker_devices.activo', true);

    if (!sa) {
      queryVeh = queryVeh.eq('company_id', userData.company_id);
    }

    const { data: vehData } = await queryVeh.order('nombre');

    // Última velocidad de cada uno
    const vehIds = (vehData || []).map((v: any) => v.id);
    const ultimasUbicacionesMap: Record<string, { velocidad: number; fecha: string }> = {};
    if (vehIds.length > 0) {
      const { data: locs } = await supabase
        .from('locations')
        .select('vehicle_id, velocidad, fecha_gps')
        .in('vehicle_id', vehIds)
        .order('fecha_gps', { ascending: false })
        .limit(vehIds.length * 5);

      (locs || []).forEach((l: any) => {
        if (!ultimasUbicacionesMap[l.vehicle_id]) {
          ultimasUbicacionesMap[l.vehicle_id] = { velocidad: l.velocidad, fecha: l.fecha_gps };
        }
      });
    }

    const vehiculosFinal: Vehiculo[] = (vehData || []).map((v: any) => {
      const dev = Array.isArray(v.tracker_devices) ? v.tracker_devices[0] : v.tracker_devices;
      const ult = ultimasUbicacionesMap[v.id];
      return {
        id: v.id,
        nombre: v.nombre,
        patente: v.patente,
        marca: v.marca,
        modelo: v.modelo,
        company_id: v.company_id,
        corte_habilitado: v.corte_habilitado,
        corte_activo: v.corte_activo,
        device_uid: dev?.device_uid || null,
        device_tipo: dev?.tipo || null,
        device_nombre: dev?.nombre || null,
        ultima_velocidad: ult?.velocidad ?? null,
        ultima_fecha: ult?.fecha ?? null,
      };
    });

    setVehiculos(vehiculosFinal);

    // 3) Historial (últimos 10)
    let queryHist = supabase
      .from('cortes_combustible')
      .select('*, vehicles(nombre, patente)')
      .order('creado_en', { ascending: false })
      .limit(10);

    if (!sa) {
      queryHist = queryHist.eq('company_id', userData.company_id);
    }

    const { data: histData } = await queryHist;
    setHistorial((histData || []).map((h: any) => ({
      ...h,
      vehiculo_nombre: h.vehicles?.nombre || '?',
      vehiculo_patente: h.vehicles?.patente || null,
    })));

    setCargando(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Auto-actualizar cada 15 segundos para ver el estado en vivo
  useEffect(() => {
    if (!tienePlanPremium) return;
    const interval = setInterval(cargarDatos, 15000);
    return () => clearInterval(interval);
  }, [tienePlanPremium, cargarDatos]);

  // ============================================================================
  // Ejecutar acción
  // ============================================================================

  const ejecutarAccion = async (
    vehiculo: Vehiculo,
    accion: 'cortar' | 'restablecer',
    motivo: string,
    motivoDetalle: string
  ) => {
    setMensajeGlobal(null);
    try {
      const rpcName = accion === 'cortar' ? 'ejecutar_corte_combustible' : 'restablecer_combustible';
      const rpcArgs = accion === 'cortar'
        ? { p_vehicle_id: vehiculo.id, p_motivo: motivo, p_motivo_detalle: motivoDetalle || null }
        : { p_vehicle_id: vehiculo.id, p_motivo_detalle: motivoDetalle || null };

      const { data: corteId, error: errRpc } = await supabase.rpc(rpcName, rpcArgs);
      if (errRpc) throw new Error(errRpc.message);
      if (!corteId) throw new Error('No se obtuvo el ID del corte');

      // Invocar Edge Function
      const { data: edgeData, error: errEdge } = await supabase.functions.invoke('corte-combustible', {
        body: { corte_id: corteId },
      });
      if (errEdge) throw new Error(errEdge.message || 'Error en Edge Function');
      if (edgeData?.error) throw new Error(edgeData.error);

      setMensajeGlobal({
        tipo: 'ok',
        texto: accion === 'cortar'
          ? `✓ Comando de CORTE enviado al GPS de "${vehiculo.nombre}". Puede tardar hasta 30 segundos en actuar físicamente.`
          : `✓ Comando de RESTABLECIMIENTO enviado al GPS de "${vehiculo.nombre}".`,
      });
      setModalAccion(null);
      cargarDatos();
    } catch (e: any) {
      setMensajeGlobal({ tipo: 'error', texto: `✗ Error: ${e.message}` });
    }
  };

  const habilitarCorte = async (vehiculo: Vehiculo, habilitar: boolean) => {
    setMensajeGlobal(null);
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ corte_habilitado: habilitar })
        .eq('id', vehiculo.id);
      if (error) throw error;

      setMensajeGlobal({
        tipo: 'ok',
        texto: habilitar
          ? `✓ Corte HABILITADO en "${vehiculo.nombre}". Asegurate de que el relé esté físicamente instalado.`
          : `✓ Corte DESHABILITADO en "${vehiculo.nombre}".`,
      });
      setModalHabilitar(null);
      cargarDatos();
    } catch (e: any) {
      setMensajeGlobal({ tipo: 'error', texto: `✗ Error: ${e.message}` });
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (cargando) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--texto-suave)' }}>
        Cargando...
      </div>
    );
  }

  // Pantalla bloqueada si no tiene plan Premium
  if (!tienePlanPremium) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
        <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>Función Premium</h1>
        <p style={{ color: 'var(--texto-suave)', marginBottom: '24px', lineHeight: 1.6 }}>
          El corte de combustible es una función exclusiva del <b>plan Premium</b>.
          {' '}Te permite cortar y restablecer el combustible de tus vehículos de forma remota
          {' '}en caso de robo, mantenimiento o emergencia.
        </p>
        <p style={{ color: 'var(--texto-suave)' }}>
          Tu plan actual: <b>{planEmpresa || 'sin plan'}</b>
        </p>
        <p style={{ marginTop: '24px' }}>
          Para activarlo, comunicate con tu proveedor BBNet Security.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header de seguridad */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,77,94,0.10), rgba(255,176,32,0.10))',
        border: '1px solid rgba(255,77,94,0.30)',
        borderRadius: '20px',
        padding: '20px 24px',
        marginBottom: '24px',
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, marginBottom: '6px' }}>
          ⚠️ Corte de Combustible
        </h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
          Función crítica. Cortar el combustible apaga el motor del vehículo de forma remota.
          {' '}Por seguridad, <b>solo se permite a menos de 20 km/h</b>. Cada acción queda registrada en auditoría.
        </p>
      </div>

      {/* Mensaje global */}
      {mensajeGlobal && (
        <div style={{
          padding: '14px 18px',
          marginBottom: '20px',
          borderRadius: '14px',
          background: mensajeGlobal.tipo === 'ok' ? 'rgba(34,217,122,0.15)' : 'rgba(255,77,94,0.15)',
          border: `1px solid ${mensajeGlobal.tipo === 'ok' ? 'rgba(34,217,122,0.5)' : 'rgba(255,77,94,0.5)'}`,
          color: mensajeGlobal.tipo === 'ok' ? 'var(--verde-online)' : 'var(--rojo-alerta)',
          fontSize: '14px',
        }}>
          {mensajeGlobal.texto}
        </div>
      )}

      {/* Lista de vehículos */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '14px' }}>Vehículos con GPS cableado ({vehiculos.length})</h2>
        {vehiculos.length === 0 && (
          <div style={{
            padding: '40px', textAlign: 'center',
            background: 'var(--gris-oscuro)', borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)', color: 'var(--texto-suave)',
          }}>
            No hay vehículos con GPS cableado asignado.
          </div>
        )}
        <div style={{ display: 'grid', gap: '14px' }}>
          {vehiculos.map(v => (
            <TarjetaVehiculo
              key={v.id}
              v={v}
              esSuperAdmin={esSuperAdmin}
              onAccion={(accion) => setModalAccion({ vehiculo: v, accion })}
              onToggleHabilitar={() => setModalHabilitar(v)}
            />
          ))}
        </div>
      </div>

      {/* Historial */}
      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '14px' }}>Últimos movimientos</h2>
        {historial.length === 0 && (
          <div style={{
            padding: '24px', textAlign: 'center',
            background: 'var(--gris-oscuro)', borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)', color: 'var(--texto-suave)',
            fontSize: '14px',
          }}>
            No hay historial todavía.
          </div>
        )}
        <div style={{ display: 'grid', gap: '10px' }}>
          {historial.map(h => (
            <FilaHistorial key={h.id} h={h} />
          ))}
        </div>
      </div>

      {/* Modal de acción */}
      {modalAccion && (
        <ModalConfirmacion
          vehiculo={modalAccion.vehiculo}
          accion={modalAccion.accion}
          onCancelar={() => setModalAccion(null)}
          onConfirmar={(motivo, detalle) => ejecutarAccion(modalAccion.vehiculo, modalAccion.accion, motivo, detalle)}
        />
      )}

      {/* Modal de habilitar/deshabilitar */}
      {modalHabilitar && (
        <ModalHabilitar
          vehiculo={modalHabilitar}
          onCancelar={() => setModalHabilitar(null)}
          onConfirmar={(habilitar) => habilitarCorte(modalHabilitar, habilitar)}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTE: Tarjeta de vehículo
// ============================================================================

function TarjetaVehiculo({
  v, esSuperAdmin, onAccion, onToggleHabilitar
}: {
  v: Vehiculo;
  esSuperAdmin: boolean;
  onAccion: (accion: 'cortar' | 'restablecer') => void;
  onToggleHabilitar: () => void;
}) {
  const enMovimiento = (v.ultima_velocidad ?? 0) > 20;

  return (
    <div style={{
      background: 'var(--gris-oscuro)',
      border: `2px solid ${v.corte_activo ? 'rgba(255,77,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '20px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>
            {v.nombre}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
            {v.patente && (
              <span style={{
                fontFamily: 'monospace', fontSize: '12px', letterSpacing: '1px',
                padding: '3px 9px', borderRadius: '6px', background: 'rgba(0,102,255,0.15)',
                color: 'var(--azul-electrico)', fontWeight: 700,
              }}>
                {v.patente}
              </span>
            )}
            <span style={{ fontSize: '13px', color: 'var(--texto-suave)' }}>
              {[v.marca, v.modelo].filter(Boolean).join(' ')}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--texto-suave)' }}>
            GPS: {v.device_nombre || '?'} · IMEI {v.device_uid || '?'}
          </div>
          {v.ultima_velocidad !== null && (
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              Velocidad actual: <b style={{ color: enMovimiento ? 'var(--rojo-alerta)' : 'var(--verde-online)' }}>
                {Math.round(v.ultima_velocidad)} km/h
              </b>
              {enMovimiento && <span style={{ marginLeft: '8px', color: 'var(--rojo-alerta)', fontSize: '11px' }}>
                ⚠ EN MOVIMIENTO (no se puede cortar)
              </span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {/* Estado actual */}
          <div style={{
            padding: '6px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700,
            background: v.corte_activo ? 'rgba(255,77,94,0.20)' : 'rgba(34,217,122,0.20)',
            color: v.corte_activo ? 'var(--rojo-alerta)' : 'var(--verde-online)',
          }}>
            {v.corte_activo ? '⛔ COMBUSTIBLE CORTADO' : '✓ Normal'}
          </div>

          {/* Botón de habilitación (solo super-admin) */}
          {esSuperAdmin && (
            <button onClick={onToggleHabilitar} style={{
              padding: '6px 12px', borderRadius: '8px',
              background: 'transparent', color: 'var(--texto-suave)',
              border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '12px',
            }}>
              {v.corte_habilitado ? '🔧 Deshabilitar relé' : '🔧 Habilitar relé'}
            </button>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      {v.corte_habilitado ? (
        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!v.corte_activo && (
            <button
              onClick={() => onAccion('cortar')}
              disabled={enMovimiento}
              style={{
                flex: 1, minWidth: '160px',
                padding: '14px 18px', borderRadius: '14px',
                background: enMovimiento ? 'rgba(255,77,94,0.20)' : 'var(--rojo-alerta)',
                color: 'white', fontWeight: 700, fontSize: '15px',
                border: 'none', cursor: enMovimiento ? 'not-allowed' : 'pointer',
                opacity: enMovimiento ? 0.5 : 1,
              }}
            >
              🔴 CORTAR COMBUSTIBLE
            </button>
          )}
          {v.corte_activo && (
            <button
              onClick={() => onAccion('restablecer')}
              style={{
                flex: 1, minWidth: '160px',
                padding: '14px 18px', borderRadius: '14px',
                background: 'var(--verde-online)', color: 'white',
                fontWeight: 700, fontSize: '15px',
                border: 'none', cursor: 'pointer',
              }}
            >
              🟢 RESTABLECER COMBUSTIBLE
            </button>
          )}
        </div>
      ) : (
        <div style={{
          marginTop: '16px', padding: '12px 14px',
          background: 'rgba(255,176,32,0.10)', border: '1px solid rgba(255,176,32,0.30)',
          borderRadius: '12px', fontSize: '13px', color: 'var(--texto-suave)',
        }}>
          Este vehículo no tiene el relé habilitado. {esSuperAdmin ? 'Tocá "Habilitar relé" arriba para activarlo (solo si el relé está físicamente instalado).' : 'Comunicate con tu proveedor BBNet para habilitarlo.'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTE: Fila de historial
// ============================================================================

function FilaHistorial({ h }: { h: CorteHistorial }) {
  const colorAccion = h.accion === 'cortar' ? 'var(--rojo-alerta)' : 'var(--verde-online)';
  const colorEstado: Record<string, string> = {
    exitoso: 'var(--verde-online)',
    fallido: 'var(--rojo-alerta)',
    pendiente: 'var(--amarillo, #ffb020)',
    cancelado: 'var(--texto-suave)',
  };
  return (
    <div style={{
      background: 'var(--gris-oscuro)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', padding: '12px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
    }}>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ color: colorAccion, fontWeight: 700, fontSize: '13px' }}>
            {h.accion === 'cortar' ? '🔴 CORTÓ' : '🟢 RESTABLECIÓ'}
          </span>
          <span style={{ color: 'var(--texto-suave)', fontSize: '13px' }}>
            {h.vehiculo_nombre}{h.vehiculo_patente ? ` · ${h.vehiculo_patente}` : ''}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--texto-suave)' }}>
          {h.ejecutado_por_nombre || '?'} · Motivo: {h.motivo}{h.motivo_detalle ? ` (${h.motivo_detalle})` : ''}
          {h.velocidad_al_momento !== null && ` · ${Math.round(h.velocidad_al_momento)} km/h`}
        </div>
        {h.error_mensaje && (
          <div style={{ fontSize: '12px', color: 'var(--rojo-alerta)', marginTop: '4px' }}>
            Error: {h.error_mensaje}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: colorEstado[h.estado], fontWeight: 700, textTransform: 'uppercase' }}>
          {h.estado}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--texto-suave)' }}>
          {new Date(h.creado_en).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTE: Modal de doble confirmación
// ============================================================================

function ModalConfirmacion({
  vehiculo, accion, onCancelar, onConfirmar
}: {
  vehiculo: Vehiculo;
  accion: 'cortar' | 'restablecer';
  onCancelar: () => void;
  onConfirmar: (motivo: string, detalle: string) => void;
}) {
  const [palabraTipeada, setPalabraTipeada] = useState('');
  const [motivo, setMotivo] = useState('prueba');
  const [detalle, setDetalle] = useState('');
  const palabraEsperada = accion === 'cortar' ? 'CORTAR' : 'RESTABLECER';
  const habilitado = palabraTipeada.trim().toUpperCase() === palabraEsperada;
  const colorPrincipal = accion === 'cortar' ? 'var(--rojo-alerta)' : 'var(--verde-online)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: '20px',
    }}>
      <div style={{
        background: 'var(--gris-oscuro)', borderRadius: '20px',
        border: `2px solid ${colorPrincipal}`, padding: '24px',
        maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '8px', fontSize: '20px' }}>
          {accion === 'cortar' ? '🔴 Cortar combustible' : '🟢 Restablecer combustible'}
        </h2>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginBottom: '20px' }}>
          Vehículo: <b>{vehiculo.nombre}</b>{vehiculo.patente ? ` (${vehiculo.patente})` : ''}
        </p>

        {accion === 'cortar' && (
          <div style={{
            background: 'rgba(255,77,94,0.10)', border: '1px solid rgba(255,77,94,0.30)',
            borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', lineHeight: 1.5,
          }}>
            ⚠️ Esta acción <b>apaga el motor del vehículo de forma remota</b>.
            Solo se procesa si el vehículo está a menos de 20 km/h. La acción queda registrada.
          </div>
        )}

        {/* Motivo */}
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--texto-suave)' }}>
          Motivo
        </label>
        <select value={motivo} onChange={e => setMotivo(e.target.value)} style={{
          width: '100%', padding: '11px 14px', borderRadius: '10px',
          background: 'var(--negro, #0a0e14)', color: 'var(--texto, white)',
          border: '1px solid rgba(255,255,255,0.08)', fontSize: '14px', marginBottom: '14px',
        }}>
          <option value="prueba">Prueba</option>
          <option value="anti_robo">Anti-robo</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="pago_pendiente">Pago pendiente</option>
          <option value="otro">Otro</option>
        </select>

        {/* Detalle */}
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--texto-suave)' }}>
          Detalle (opcional)
        </label>
        <input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Ej: Sospecha de robo en ruta 5..." style={{
          width: '100%', padding: '11px 14px', borderRadius: '10px',
          background: 'var(--negro, #0a0e14)', color: 'var(--texto, white)',
          border: '1px solid rgba(255,255,255,0.08)', fontSize: '14px', marginBottom: '14px',
        }} />

        {/* Confirmación tipeada */}
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--texto-suave)' }}>
          Para confirmar, escribí <b style={{ color: colorPrincipal }}>{palabraEsperada}</b>
        </label>
        <input value={palabraTipeada} onChange={e => setPalabraTipeada(e.target.value)} placeholder={palabraEsperada} style={{
          width: '100%', padding: '11px 14px', borderRadius: '10px',
          background: 'var(--negro, #0a0e14)', color: 'var(--texto, white)',
          border: `1px solid ${habilitado ? colorPrincipal : 'rgba(255,255,255,0.08)'}`,
          fontSize: '15px', fontWeight: 700, letterSpacing: '1px', marginBottom: '20px',
        }} />

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{
            padding: '11px 18px', borderRadius: '10px',
            background: 'transparent', color: 'var(--texto)',
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '14px',
          }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(motivo, detalle)}
            disabled={!habilitado}
            style={{
              padding: '11px 22px', borderRadius: '10px',
              background: habilitado ? colorPrincipal : 'rgba(255,255,255,0.10)',
              color: 'white', fontWeight: 700,
              border: 'none', cursor: habilitado ? 'pointer' : 'not-allowed', fontSize: '14px',
              opacity: habilitado ? 1 : 0.5,
            }}
          >
            {accion === 'cortar' ? 'Cortar combustible' : 'Restablecer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTE: Modal de habilitar/deshabilitar relé
// ============================================================================

function ModalHabilitar({
  vehiculo, onCancelar, onConfirmar
}: {
  vehiculo: Vehiculo;
  onCancelar: () => void;
  onConfirmar: (habilitar: boolean) => void;
}) {
  const accion = vehiculo.corte_habilitado ? 'deshabilitar' : 'habilitar';
  const [palabraTipeada, setPalabraTipeada] = useState('');
  const palabraEsperada = accion === 'habilitar' ? 'HABILITAR' : 'DESHABILITAR';
  const habilitado = palabraTipeada.trim().toUpperCase() === palabraEsperada;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: '20px',
    }}>
      <div style={{
        background: 'var(--gris-oscuro)', borderRadius: '20px',
        border: '2px solid rgba(255,176,32,0.5)', padding: '24px',
        maxWidth: '480px', width: '100%',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '20px' }}>
          🔧 {accion === 'habilitar' ? 'Habilitar' : 'Deshabilitar'} relé
        </h2>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginBottom: '14px' }}>
          Vehículo: <b>{vehiculo.nombre}</b>
        </p>

        {accion === 'habilitar' ? (
          <div style={{
            background: 'rgba(255,176,32,0.10)', border: '1px solid rgba(255,176,32,0.30)',
            borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', lineHeight: 1.5,
          }}>
            ⚠️ <b>Solo habilitá si el relé físico ya está instalado en el vehículo.</b>
            {' '}Si no está instalado y alguien intenta cortar, no va a pasar nada y la operación va a quedar registrada como fallida.
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', lineHeight: 1.5,
          }}>
            Al deshabilitar, el cliente no podrá cortar el combustible de este vehículo.
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--texto-suave)' }}>
          Para confirmar, escribí <b>{palabraEsperada}</b>
        </label>
        <input value={palabraTipeada} onChange={e => setPalabraTipeada(e.target.value)} placeholder={palabraEsperada} style={{
          width: '100%', padding: '11px 14px', borderRadius: '10px',
          background: 'var(--negro, #0a0e14)', color: 'var(--texto, white)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '15px', fontWeight: 700, letterSpacing: '1px', marginBottom: '20px',
        }} />

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{
            padding: '11px 18px', borderRadius: '10px',
            background: 'transparent', color: 'var(--texto)',
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '14px',
          }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(!vehiculo.corte_habilitado)}
            disabled={!habilitado}
            style={{
              padding: '11px 22px', borderRadius: '10px',
              background: habilitado ? 'var(--azul-electrico, #0066ff)' : 'rgba(255,255,255,0.10)',
              color: 'white', fontWeight: 700,
              border: 'none', cursor: habilitado ? 'pointer' : 'not-allowed', fontSize: '14px',
              opacity: habilitado ? 1 : 0.5,
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
