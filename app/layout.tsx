// ============================================================================
// LAYOUT RAÍZ · envuelve TODA la aplicación
// ----------------------------------------------------------------------------
// Es el "marco" que rodea cada página del sistema. Acá se carga el CSS global,
// se define el título que aparece en la pestaña del navegador, y se enlazan
// los favicons (íconos de marca) en sus diferentes tamaños.
// ============================================================================

import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BBNet Track · Seguimiento Inteligente GPS',
  description: 'Sistema de seguimiento operativo de flotas y empleados',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* CSS de Leaflet (el mapa). Sin esto, el mapa se ve roto. */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
