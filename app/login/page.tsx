'use client';

// ============================================================================
// PANTALLA DE LOGIN
// ----------------------------------------------------------------------------
// La primera pantalla del sistema. El admin pone mail y contraseña y entra.
// Por dentro usa Supabase Auth (el mismo sistema donde creaste tu usuario).
// ============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setError('');
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError('Mail o contraseña incorrectos. Probá de nuevo.');
      setCargando(false);
      return;
    }

    // Entró bien -> al dashboard
    router.push('/dashboard');
    router.refresh();
  }

  // Permitir entrar con la tecla Enter
  function alPresionarTecla(e: React.KeyboardEvent) {
    if (e.key === 'Enter') entrar();
  }

  return (
    <div style={s.pantalla}>
      <div style={s.tarjeta}>
        {/* Logo / marca */}
        <div style={s.marca}>
          <div style={s.logoIcono}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="9" r="2.5" fill="#fff" />
            </svg>
          </div>
          <div>
            <h1 style={s.titulo}>
              BBNet <span style={{ color: 'var(--azul-electrico)' }}>Track</span>
            </h1>
            <p style={s.subtitulo}>Seguimiento operativo GPS</p>
          </div>
        </div>

        {/* Formulario */}
        <div style={s.formulario}>
          <label style={s.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={alPresionarTecla}
            placeholder="tu@email.com"
            style={s.input}
            autoFocus
          />

          <label style={s.label}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={alPresionarTecla}
            placeholder="••••••••"
            style={s.input}
          />

          {error && <div style={s.error}>{error}</div>}

          <button
            onClick={entrar}
            disabled={cargando}
            style={{ ...s.boton, opacity: cargando ? 0.6 : 1 }}
          >
            {cargando ? 'Entrando...' : 'Ingresar'}
          </button>
        </div>

        <p style={s.pie}>BBNet Security · Panel de administración</p>
      </div>
    </div>
  );
}

// Estilos en línea para que sea un solo archivo autocontenido
const s: { [k: string]: React.CSSProperties } = {
  pantalla: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    position: 'relative',
    zIndex: 1,
  },
  tarjeta: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--gris-oscuro)',
    border: '1px solid var(--gris-borde)',
    borderRadius: '16px',
    padding: '40px 32px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  marca: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '32px',
  },
  logoIcono: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px var(--azul-glow)',
  },
  titulo: { fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' },
  subtitulo: { fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' },
  formulario: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '13px',
    color: 'var(--texto-suave)',
    marginTop: '12px',
    marginBottom: '4px',
    fontWeight: 500,
  },
  input: {
    background: 'var(--negro)',
    border: '1px solid var(--gris-borde)',
    borderRadius: '10px',
    padding: '13px 16px',
    color: 'var(--texto)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border 0.2s',
  },
  error: {
    background: 'rgba(255,77,94,0.12)',
    border: '1px solid rgba(255,77,94,0.3)',
    color: 'var(--rojo-offline)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '13px',
    marginTop: '14px',
  },
  boton: {
    marginTop: '24px',
    background: 'linear-gradient(135deg, var(--azul-electrico), var(--azul-brillante))',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    boxShadow: '0 8px 24px var(--azul-glow)',
  },
  pie: {
    textAlign: 'center',
    fontSize: '12px',
    color: 'var(--texto-tenue)',
    marginTop: '28px',
  },
};
