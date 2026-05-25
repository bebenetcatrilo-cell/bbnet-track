'use client';

// Sección "Cobranza Familias" (Track Familia) — EN CONSTRUCCIÓN
// Esta sección es parte del nuevo negocio de rastreo familiar.
// Se va a construir próximamente. Por ahora muestra un cartel.

export default function Pagina() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '20px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Cobranza Familias</h1>
      <p style={{ color: 'var(--texto-suave)', fontSize: '15px', maxWidth: '440px', lineHeight: 1.5 }}>
        Acá vas a gestionar los cobros y abonos de los clientes familia.
      </p>
      <div style={{ marginTop: '20px', padding: '8px 16px', background: 'var(--gris-oscuro)', border: '1px solid var(--gris-borde)', borderRadius: '20px', fontSize: '13px', color: 'var(--amarillo)', fontWeight: 600 }}>
        Próximamente
      </div>
    </div>
  );
}
