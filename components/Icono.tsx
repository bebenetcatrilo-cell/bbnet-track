// ============================================================================
// ÍCONOS · Tabler Icons (https://tabler.io/icons)
// ----------------------------------------------------------------------------
// Todos los íconos con el MISMO grosor (1.75), tamaño y color (heredan del CSS).
// Son SVG directos (sin librería pesada) para no arriesgar el build en Vercel.
// Uso: <Icono nombre="mapa" />  o  <Icono nombre="mapa" size={20} />
// ============================================================================

type IconoProps = {
  nombre: string;
  size?: number;
  color?: string;
};

// Cada ícono es el "path" interior de Tabler (línea, grosor 1.75, esquinas redondeadas)
const PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <path d="M4 4h6v8h-6z" /><path d="M4 16h6v4h-6z" />
      <path d="M14 12h6v8h-6z" /><path d="M14 4h6v4h-6z" />
    </>
  ),
  mapa: (
    <>
      <path d="M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18z" />
      <path d="M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0 -10z" />
      <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </>
  ),
  vehiculos: (
    <>
      <path d="M5 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M15 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15" />
    </>
  ),
  historial: (
    <>
      <path d="M12 8l0 4l2 2" />
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
    </>
  ),
  dispositivos: (
    <>
      <path d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z" />
      <path d="M11 17h2" />
    </>
  ),
  reportes: (
    <>
      <path d="M3 3v18h18" />
      <path d="M9 9l3 3l3 -3l3 3" /><path d="M9 17l3 -3l3 3l3 -3" />
    </>
  ),
  alertas: (
    <>
      <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </>
  ),
  clientes: (
    <>
      <path d="M3 21h18" /><path d="M5 21v-14l8 -4v18" />
      <path d="M19 21v-10l-6 -4" /><path d="M9 9v0" /><path d="M9 12v0" /><path d="M9 15v0" />
    </>
  ),
  planes: (
    <>
      <path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
      <path d="M3 10h18" />
    </>
  ),
  cobranza: (
    <>
      <path d="M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3" />
      <path d="M16 7a4 4 0 0 0 -4 -4" /><path d="M9 7h6" /><path d="M9 11h6" />
      <path d="M9 15a4 4 0 0 0 4 4" />
    </>
  ),
  servicio: (
    <>
      <path d="M7 10h-4l3.5 -6.5l3.5 6.5" />
      <path d="M10.5 13.5l-3.5 6.5l-3.5 -6.5z" />
      <path d="M14 4l6 6" /><path d="M17 7l-9 9" />
    </>
  ),
  bateria: (
    <>
      <path d="M6 7h11a2 2 0 0 1 2 2v.5a0.5 .5 0 0 0 .5 .5a0.5 .5 0 0 1 .5 .5v3a0.5 .5 0 0 1 -.5 .5a0.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2z" />
    </>
  ),
};

export default function Icono({ nombre, size = 20, color = 'currentColor' }: IconoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[nombre] ?? null}
    </svg>
  );
}
