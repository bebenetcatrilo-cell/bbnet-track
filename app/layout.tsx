// ============================================================================
// LAYOUT RAÍZ · envuelve TODA la aplicación
// ----------------------------------------------------------------------------
// Es el "marco" que rodea cada página del sistema. Acá se carga el CSS global
// y se define el título que aparece en la pestaña del navegador.
// ============================================================================

import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BBNet Track · Seguimiento GPS',
  description: 'Sistema de seguimiento operativo de flotas y empleados',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
