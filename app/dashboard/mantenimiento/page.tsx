'use client';

// ============================================================================
// SECCIÓN MANTENIMIENTO · control de services por KM (función premium)
// ----------------------------------------------------------------------------
// Esta pantalla muestra cada vehículo del cliente con:
//   - KM actuales acumulados
//   - Lista de services activos (aceite, frenos, etc.) con estado:
//       verde   = lejos del vencimiento
//       amarillo = se acerca (faltan menos del 10% del intervalo)
//       rojo    = vencido (pasó del KM límite)
//   - Botón "Configurar" para agregar/sacar services de ese vehículo
//   - Botón "Service hecho" para registrar que se realizó (resetea el contador)
//
// REQUIERE PLAN PREMIUM: si el plan del cliente no tiene mantenimiento=true,
// se muestra un cartel "Función premium" en vez de la pantalla.
// ============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import VentanaFlotante from '@/components/VentanaFlotante';
import { getMiCompanyId } from '@/lib/mi-empresa';

type Vehiculo = {
  id: string;
  nombre: string;
  patente: string | null;
  odometro_actual: number;
};

type ServiceTipo = {
  id: string;
  nombre: string;
  intervalo_km_default: number;
};

type VehicleService = {
  id: string;
  vehicle_id: string;
  service_tipo_id: string | null;
  nombre_custom: string | null;
  intervalo_km: number;
  ultimo_service_km: number | null;
  ultimo_service_fecha: string | null;
  activo: boolean;
};

export default function PaginaMantenimiento() {
  const supabase = createClient();

  const [tieneAcceso, setTieneAcceso] = useState<boolean | null>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [tipos, setTipos] = useState<ServiceTipo[]>([]);
  const [services, setServices] = useState<VehicleService[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal configurar services de un vehículo
  const [modalConfigAbierto, setModalConfigAbierto] = useState(false);
  const [vehiculoConfig, setVehiculoConfig] = useState<Vehiculo | null>(null);

  // Modal registrar service hecho
  const [modalHechoAbierto, setModalHechoAbierto] = useState(false);
  const [serviceHecho, setServiceHecho] = useState<VehicleService | null>(null);
  const [vehiculoHecho, setVehiculoHecho] = useState<Vehiculo | null>(null);
  const [fechaHecho, setFechaHecho] = useState(new Date().toISOString().slice(0, 10));
  const [kmCorrige, setKmCorrige] = useState<number | ''>('');

  useEffect(() => {
    verificarYCargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verificarYCargar() {
    setCargando(true);
    // 1) Verificar que el plan del cliente tenga mantenimiento activado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTieneAcceso(false); setCargando(false); return; }

    const { data: perfil } = await supabase
      .from('users')
      .select('company_id, companies(plan)')
      .eq('id', user.id)
      .single();

    const planCodigo = (perfil?.companies as any)?.plan;
    if (!planCodigo) { setTieneAcceso(false); setCargando(false); return; }

    const { data: plan } = await supabase
      .from('planes')
      .select('mantenimiento')
      .eq('codigo', planCodigo)
      .maybeSingle();

    const tiene = plan?.mantenimiento === true;
    setTieneAcceso(tiene);

    if (!tiene) { setCargando(false); return; }

    // 2) Si tiene acceso, cargar todo
    await cargarTodo();
    setCargando(false);
  }

  async function cargarTodo() {
    const companyId = await getMiCompanyId();
    if (!companyId) return;

    const [{ data: vehs }, { data: tps }, { data: srvs }] = await Promise.all([
      supabase.from('vehicles').select('id, nombre, patente, odometro_actual')
        .eq('company_id', companyId).eq('activo', true).order('nombre'),
      supabase.from('service_tipos').select('id, nombre, intervalo_km_default')
        .eq('activo', true).order('orden'),
      supabase.from('vehicle_services').select('*').eq('activo', true),
    ]);

    setVehiculos(vehs ?? []);
    setTipos(tps ?? []);
    setServices(srvs ?? []);
  }

  // ¿Cuáles services tiene activos un vehículo?
  function servicesDe(vehiculoId: string): VehicleService[] {
    return services.filter((s) => s.vehicle_id === vehiculoId);
  }

  // Nombre legible de un service (sea sugerido o custom)
  function nombreServicio(s: VehicleService): string {
    if (s.nombre_custom) return s.nombre_custom;
    const tipo = tipos.find((t) => t.id === s.service_tipo_id);
    return tipo?.nombre ?? 'Service';
  }

  // Calcula el estado de un service: cuántos KM faltan, y de qué color va
  function estadoServicio(s: VehicleService, odometroActual: number): {
    proximoKm: number;
    kmFaltantes: number;
    color: string;
    etiqueta: string;
  } {
    // Si no hay ultimo_service_km, asumimos que arrancó hoy con el odómetro actual
    const base = s.ultimo_service_km ?? odometroActual;
    const proximoKm = base + s.intervalo_km;
    const kmFaltantes = proximoKm - odometroActual;
    const umbralAviso = s.intervalo_km * 0.1; // 10% del intervalo = aviso amarillo

    if (kmFaltantes <= 0) {
      return {
        proximoKm,
        kmFaltantes,
        color: 'var(--rojo-offline)',
        etiqueta: `Vencido por ${Math.abs(Math.round(kmFaltantes)).toLocaleString('es-AR')} km`,
      };
    }
    if (kmFaltantes <= umbralAviso) {
      return {
        proximoKm,
        kmFaltantes,
        color: 'var(--amarillo)',
        etiqueta: `Faltan ${Math.round(kmFaltantes).toLocaleString('es-AR')} km`,
      };
    }
    return {
      proximoKm,
      kmFaltantes,
      color: 'var(--verde-online)',
      etiqueta: `Faltan ${Math.round(kmFaltantes).toLocaleString('es-AR')} km`,
    };
  }

  function abrirConfigurar(v: Vehiculo) {
    setVehiculoConfig(v);
    setModalConfigAbierto(true);
  }

  function abrirRegistrarHecho(v: Vehiculo, s: VehicleService) {
    setServiceHecho(s);
    setVehiculoHecho(v);
    setFechaHecho(new Date().toISOString().slice(0, 10));
    setKmCorrige('');
    setModalHechoAbierto(true);
  }

  // Pantalla de "sin acceso" (plan free, no premium)
  if (tieneAcceso === false) {
    return (
      <div style={{ ...s.tarjeta, textAlign: 'center', padding: '50px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔧</div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Control de Mantenimiento</div>
        <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '8px', maxWidth: '440px', margin: '8px auto 0' }}>
          Esta función es premium. Con Mantenimiento controlás services
          (aceite, frenos, filtros) por kilómetros recorridos automáticamente,
          y el sistema te avisa cuando se acercan los vencimientos.
        </div>
        <div style={{ marginTop: '20px', padding: '8px 16px', background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '20px', fontSize: '13px', color: 'var(--amarillo)', fontWeight: 600, display: 'inline-block' }}>
          Hablá con tu proveedor para activarla
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>Mantenimiento</h1>
        <p style={{ color: 'var(--texto-suave)', fontSize: '14px', marginTop: '4px' }}>
          Control de services por kilómetros · el sistema suma KM solo con el GPS
        </p>
      </div>

      {cargando ? (
        <div style={{ color: 'var(--texto-suave)', padding: '40px', textAlign: 'center' }}>Cargando...</div>
      ) : vehiculos.length === 0 ? (
        <div style={{ ...s.tarjeta, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚗</div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>No tenés vehículos cargados</div>
          <div style={{ fontSize: '14px', color: 'var(--texto-suave)', marginTop: '6px' }}>
            Andá a "Vehículos" para cargar el primero (y poné sus KM actuales).
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {vehiculos.map((v) => {
            const srvs = servicesDe(v.id);
            return (
              <div key={v.id} style={s.tarjeta}>
                {/* Encabezado del vehículo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: 700 }}>🚗 {v.nombre}</div>
                    <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                      {v.patente ? `Patente: ${v.patente}` : 'sin patente'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--texto-tenue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Odómetro</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--azul-brillante)' }}>
                      {Math.round(v.odometro_actual).toLocaleString('es-AR')} km
                    </div>
                  </div>
                </div>

                {/* Lista de services activos */}
                {srvs.length === 0 ? (
                  <div style={{ marginTop: '14px', padding: '14px', background: 'var(--gris-oscuro)', borderRadius: '10px', textAlign: 'center', fontSize: '13px', color: 'var(--texto-suave)' }}>
                    Todavía no hay services configurados. Tocá "Configurar" para agregar.
                  </div>
                ) : (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {srvs.map((s) => {
                      const est = estadoServicio(s, v.odometro_actual);
                      return (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 12px', background: 'var(--negro)',
                          border: `1px solid ${est.color}33`,
                          borderLeft: `4px solid ${est.color}`,
                          borderRadius: '8px',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{nombreServicio(s)}</div>
                            <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '2px' }}>
                              Cada {s.intervalo_km.toLocaleString('es-AR')} km · próximo a los {Math.round(est.proximoKm).toLocaleString('es-AR')} km
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: est.color }}>{est.etiqueta}</div>
                            <button onClick={() => abrirRegistrarHecho(v, s)} style={s.botonChiquito}>Service hecho</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ marginTop: '14px' }}>
                  <button onClick={() => abrirConfigurar(v)} style={s.botonChico}>⚙️ Configurar services</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal CONFIGURAR services de un vehículo */}
      {modalConfigAbierto && vehiculoConfig && (
        <ModalConfigurar
          vehiculo={vehiculoConfig}
          tipos={tipos}
          servicesActuales={servicesDe(vehiculoConfig.id)}
          onCerrar={() => setModalConfigAbierto(false)}
          onGuardado={async () => { await cargarTodo(); setModalConfigAbierto(false); }}
          supabase={supabase}
        />
      )}

      {/* Modal REGISTRAR SERVICE HECHO */}
      {modalHechoAbierto && serviceHecho && vehiculoHecho && (
        <VentanaFlotante titulo="Registrar service realizado" onCerrar={() => setModalHechoAbierto(false)} ancho={480}>
          <div style={{ fontSize: '14px', marginBottom: '12px' }}>
            <b>{nombreServicio(serviceHecho)}</b> en <b>{vehiculoHecho.nombre}</b>
          </div>

          <label style={s.label}>Fecha del service</label>
          <input type="date" value={fechaHecho} onChange={(e) => setFechaHecho(e.target.value)} style={s.input} />

          <label style={s.label}>Kilómetros del vehículo HOY</label>
          <input type="number"
            value={kmCorrige === '' ? Math.round(vehiculoHecho.odometro_actual) : kmCorrige}
            onChange={(e) => setKmCorrige(e.target.value === '' ? '' : Number(e.target.value))}
            style={s.input} />
          <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginTop: '4px' }}>
            Si los KM del sistema no coinciden con el cuentakilómetros real, corregilos acá.
            El sistema se va a quedar con este valor.
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setModalHechoAbierto(false)} style={s.botonChico}>Cancelar</button>
            <button
              onClick={async () => {
                const kmFinal = kmCorrige === '' ? Math.round(vehiculoHecho.odometro_actual) : Number(kmCorrige);
                // Guardar el service como hecho (último km y fecha)
                await supabase
                  .from('vehicle_services')
                  .update({
                    ultimo_service_km: kmFinal,
                    ultimo_service_fecha: fechaHecho,
                  })
                  .eq('id', serviceHecho.id);
                // Si el cliente cambió los KM, corregir el odómetro del vehículo
                if (kmFinal !== Math.round(vehiculoHecho.odometro_actual)) {
                  await supabase
                    .from('vehicles')
                    .update({ odometro_actual: kmFinal, odometro_actualizado_en: new Date().toISOString() })
                    .eq('id', vehiculoHecho.id);
                }
                setModalHechoAbierto(false);
                cargarTodo();
              }}
              style={s.botonPrimario}
            >
              Confirmar
            </button>
          </div>
        </VentanaFlotante>
      )}
    </div>
  );
}


// ============================================================================
// MODAL CONFIGURAR — sub-componente para no inflar el principal
// ============================================================================
function ModalConfigurar({
  vehiculo, tipos, servicesActuales, onCerrar, onGuardado, supabase,
}: {
  vehiculo: Vehiculo;
  tipos: ServiceTipo[];
  servicesActuales: VehicleService[];
  onCerrar: () => void;
  onGuardado: () => Promise<void>;
  supabase: ReturnType<typeof createClient>;
}) {
  // Para cada tipo sugerido: ¿está activo en este vehículo? ¿con qué intervalo?
  const [estadoTipos, setEstadoTipos] = useState(() => {
    return tipos.map((t) => {
      const existente = servicesActuales.find((s) => s.service_tipo_id === t.id);
      return {
        tipo: t,
        activo: !!existente,
        intervalo: existente?.intervalo_km ?? t.intervalo_km_default,
        idExistente: existente?.id ?? null,
      };
    });
  });

  // Services custom (los que tiene este vehículo y no son de tipos sugeridos)
  const [customs, setCustoms] = useState(() => {
    return servicesActuales
      .filter((s) => s.service_tipo_id === null)
      .map((s) => ({ id: s.id, nombre: s.nombre_custom ?? '', intervalo: s.intervalo_km }));
  });

  const [nuevoCustomNombre, setNuevoCustomNombre] = useState('');
  const [nuevoCustomIntervalo, setNuevoCustomIntervalo] = useState(10000);
  const [guardando, setGuardando] = useState(false);

  function agregarCustom() {
    if (!nuevoCustomNombre.trim() || nuevoCustomIntervalo <= 0) return;
    setCustoms([...customs, { id: null as any, nombre: nuevoCustomNombre.trim(), intervalo: nuevoCustomIntervalo }]);
    setNuevoCustomNombre('');
    setNuevoCustomIntervalo(10000);
  }

  function quitarCustom(idx: number) {
    setCustoms(customs.filter((_, i) => i !== idx));
  }

  async function guardar() {
    setGuardando(true);

    // 1) Tipos sugeridos: activar / desactivar / actualizar intervalo
    for (const e of estadoTipos) {
      if (e.activo && !e.idExistente) {
        // Crear nuevo
        await supabase.from('vehicle_services').insert({
          vehicle_id: vehiculo.id,
          service_tipo_id: e.tipo.id,
          intervalo_km: e.intervalo,
          activo: true,
        });
      } else if (e.activo && e.idExistente) {
        // Actualizar intervalo
        await supabase.from('vehicle_services').update({
          intervalo_km: e.intervalo,
        }).eq('id', e.idExistente);
      } else if (!e.activo && e.idExistente) {
        // Desactivar (borrar del todo)
        await supabase.from('vehicle_services').delete().eq('id', e.idExistente);
      }
    }

    // 2) Customs: borrar los que no están más en la lista, crear los nuevos
    const customsActualesIds = servicesActuales
      .filter((s) => s.service_tipo_id === null)
      .map((s) => s.id);
    const customsLista = customs.filter((c) => c.id);
    const idsQueQuedan = customsLista.map((c) => c.id);
    const idsABorrar = customsActualesIds.filter((id) => !idsQueQuedan.includes(id));

    for (const id of idsABorrar) {
      await supabase.from('vehicle_services').delete().eq('id', id);
    }

    // Nuevos customs (los que no tienen id todavía)
    const nuevos = customs.filter((c) => !c.id);
    for (const c of nuevos) {
      await supabase.from('vehicle_services').insert({
        vehicle_id: vehiculo.id,
        nombre_custom: c.nombre,
        intervalo_km: c.intervalo,
        activo: true,
      });
    }

    setGuardando(false);
    await onGuardado();
  }

  return (
    <VentanaFlotante titulo={`Configurar services: ${vehiculo.nombre}`} onCerrar={onCerrar} ancho={560}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--azul-brillante)', marginBottom: '10px' }}>
        SERVICES SUGERIDOS
      </div>
      <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginBottom: '10px' }}>
        Activá los que querés controlar. Ajustá el intervalo si tu vehículo es distinto del estándar.
      </div>

      {estadoTipos.map((e, idx) => (
        <div key={e.tipo.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px', borderRadius: '8px',
          background: e.activo ? 'rgba(0,102,255,0.08)' : 'var(--gris-oscuro)',
          border: `1px solid ${e.activo ? 'var(--azul-electrico)' : 'var(--gris-borde)'}`,
          marginBottom: '6px',
        }}>
          <input type="checkbox" checked={e.activo}
            onChange={(ev) => {
              const nuevo = [...estadoTipos];
              nuevo[idx] = { ...nuevo[idx], activo: ev.target.checked };
              setEstadoTipos(nuevo);
            }}
          />
          <div style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{e.tipo.nombre}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--texto-tenue)' }}>cada</span>
            <input type="number" value={e.intervalo}
              disabled={!e.activo}
              onChange={(ev) => {
                const nuevo = [...estadoTipos];
                nuevo[idx] = { ...nuevo[idx], intervalo: Number(ev.target.value) };
                setEstadoTipos(nuevo);
              }}
              style={{ width: '90px', background: 'var(--negro)', border: '1px solid var(--gris-borde)', borderRadius: '6px', padding: '6px 8px', color: 'var(--texto)', fontSize: '13px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--texto-tenue)' }}>km</span>
          </div>
        </div>
      ))}

      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--amarillo)', marginTop: '24px', marginBottom: '10px' }}>
        SERVICES PERSONALIZADOS
      </div>
      <div style={{ fontSize: '12px', color: 'var(--texto-tenue)', marginBottom: '10px' }}>
        Otros que querés controlar (correa especial, kit de embrague, etc.)
      </div>

      {customs.map((c, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <input value={c.nombre}
            onChange={(ev) => {
              const nuevo = [...customs];
              nuevo[idx] = { ...nuevo[idx], nombre: ev.target.value };
              setCustoms(nuevo);
            }}
            style={{ flex: 1, background: 'var(--negro)', border: '1px solid var(--gris-borde)', borderRadius: '6px', padding: '7px 10px', color: 'var(--texto)', fontSize: '13px' }}
          />
          <input type="number" value={c.intervalo}
            onChange={(ev) => {
              const nuevo = [...customs];
              nuevo[idx] = { ...nuevo[idx], intervalo: Number(ev.target.value) };
              setCustoms(nuevo);
            }}
            style={{ width: '100px', background: 'var(--negro)', border: '1px solid var(--gris-borde)', borderRadius: '6px', padding: '7px 10px', color: 'var(--texto)', fontSize: '13px' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--texto-tenue)' }}>km</span>
          <button onClick={() => quitarCustom(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--rojo-offline)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', padding: '10px', background: 'var(--gris-oscuro)', borderRadius: '8px' }}>
        <input value={nuevoCustomNombre} onChange={(e) => setNuevoCustomNombre(e.target.value)}
          placeholder="Nombre del service" style={{ flex: 1, background: 'var(--negro)', border: '1px solid var(--gris-borde)', borderRadius: '6px', padding: '7px 10px', color: 'var(--texto)', fontSize: '13px' }} />
        <input type="number" value={nuevoCustomIntervalo} onChange={(e) => setNuevoCustomIntervalo(Number(e.target.value))}
          style={{ width: '100px', background: 'var(--negro)', border: '1px solid var(--gris-borde)', borderRadius: '6px', padding: '7px 10px', color: 'var(--texto)', fontSize: '13px' }} />
        <span style={{ fontSize: '12px', color: 'var(--texto-tenue)' }}>km</span>
        <button onClick={agregarCustom} style={{ background: 'var(--azul-electrico)', border: 'none', borderRadius: '6px', padding: '7px 12px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>+ Agregar</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
        <button onClick={onCerrar} style={s.botonChico}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={{ ...s.botonPrimario, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </VentanaFlotante>
  );
}


const s: { [k: string]: React.CSSProperties } = {
  botonPrimario: {
    background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
    border: 'none', borderRadius: '10px', padding: '11px 18px', color: '#fff',
    fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 18px var(--azul-glow)',
    cursor: 'pointer',
  },
  botonChico: {
    background: 'var(--gris-medio)', border: '1px solid var(--gris-borde)', borderRadius: '8px',
    padding: '8px 14px', color: 'var(--texto)', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer',
  },
  botonChiquito: {
    background: 'transparent', border: '1px solid var(--gris-borde)', borderRadius: '6px',
    padding: '5px 10px', color: 'var(--texto-suave)', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', marginTop: '6px',
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
