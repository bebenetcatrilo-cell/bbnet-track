// ============================================================================
// ESTADO ONLINE INTELIGENTE
// ----------------------------------------------------------------------------
// En vez de confiar en la columna "online" (que se queda colgada si la app se
// cierra de golpe), calculamos el estado real según la última vez que el
// dispositivo reportó:
//   - Reportó hace menos de X minutos  -> Online
//   - Reportó hace más (o nunca)        -> Offline
// ============================================================================

// Minutos sin reportar para considerar un dispositivo Offline
export const MINUTOS_OFFLINE = 2;

// Devuelve true si el dispositivo está realmente online (reportó hace poco)
export function estaOnline(ultimaConexion: string | null): boolean {
  if (!ultimaConexion) return false;
  const ahora = Date.now();
  const ultima = new Date(ultimaConexion).getTime();
  const minutos = (ahora - ultima) / 60000;
  return minutos < MINUTOS_OFFLINE;
}
