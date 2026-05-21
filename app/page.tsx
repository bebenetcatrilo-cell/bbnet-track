// ============================================================================
// PÁGINA DE INICIO (raíz "/")
// ----------------------------------------------------------------------------
// No muestra nada propio: el portero (proxy.ts) ya se encarga de mandarte
// al login o al dashboard según si estás logueado. Esto es solo un respaldo.
// ============================================================================

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
