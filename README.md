# BBNet Track · Panel Web (Bloque 2)

Panel de administración del sistema de seguimiento GPS. Hecho en Next.js + Supabase.

---

## QUÉ INCLUYE ESTE BLOQUE

- Pantalla de login con diseño oscuro / azul eléctrico
- Seguridad: si no estás logueado, no entrás (el "portero" proxy.ts)
- Esqueleto del panel admin con menú lateral y header
- Dashboard con tarjetas de resumen que YA leen datos reales de tu base
- Conexión completa con tu Supabase del Bloque 1

---

## CÓMO SUBIRLO (paso a paso, como BBNet Systems)

### 1) Subir a GitHub

1. Entrá a GitHub y creá un repositorio nuevo (botón verde "New"), llamalo `bbnet-track`.
2. Subí TODOS estos archivos al repo (podés arrastrarlos en la web de GitHub
   con "Add file" > "Upload files", o como hagas siempre).

### 2) Conectar con Vercel

1. Entrá a Vercel > "Add New" > "Project".
2. Elegí el repo `bbnet-track` que acabás de crear.
3. ANTES de darle Deploy, andá a "Environment Variables" y cargá estas dos:

   | Nombre | Valor |
   |--------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | (tu URL de Supabase) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (tu llave anon de Supabase) |

   Esos dos valores los sacás de Supabase: Settings (engranaje) > API.
   Ahí están "Project URL" y "anon public".

4. Dale "Deploy" y esperá un par de minutos.

### 3) Probar

1. Cuando termine, Vercel te da un link (algo tipo bbnet-track.vercel.app).
2. Abrilo. Te tiene que aparecer el login.
3. Entrá con el mail y contraseña que creaste en Supabase (Authentication).
4. Si entrás y ves el Dashboard con las tarjetas, ¡funcionó! 🎉

---

## IMPORTANTE

- Las llaves (Environment Variables) van en VERCEL, nunca en GitHub.
- El archivo `.env.example` es solo de referencia, no tiene llaves reales.
- Si el login te rechaza, revisá que el mail/contraseña sean los de Supabase
  Authentication, y que el usuario esté conectado en la tabla `users`
  (eso lo hicimos en el Bloque 1 con el archivo de datos).

---

## PRÓXIMO BLOQUE (Bloque 3)

El mapa en vivo con OpenStreetMap y los vehículos en tiempo real.
