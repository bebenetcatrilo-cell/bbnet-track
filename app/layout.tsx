// ============================================================================
// LAYOUT RAÍZ · envuelve TODA la aplicación
// ----------------------------------------------------------------------------
// Es el "marco" que rodea cada página del sistema. Acá se carga el CSS global,
// se define el título que aparece en la pestaña del navegador, se enlazan los
// favicons, y se muestra la pantalla de bienvenida (splash) al abrir la app.
// ============================================================================

import './globals.css';
import type { Metadata, Viewport } from 'next';
import SplashScreen from '@/components/SplashScreen';

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
  // Hace que en iPhone, al abrir desde la pantalla de inicio, se vea como app
  // (sin la barra del navegador) y con el nombre correcto.
  appleWebApp: {
    capable: true,
    title: 'BBNet Track',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#12151c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
      <body>
        {/* Pantalla de bienvenida con el logo (solo al abrir la app instalada) */}
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
