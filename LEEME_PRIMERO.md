# 🚀 BBNet Track — Repo completo listo para subir

## ✅ Qué tiene este ZIP

Es **TU REPO COMPLETO** con los 3 cambios necesarios YA APLICADOS:

1. ✅ `components/Sidebar.tsx` — agregado item "Corte combustible" (visible para Premium y super-admin)
2. ✅ `app/dashboard/layout.tsx` — ahora trae `plan` de la DB y se lo pasa al Sidebar
3. ✅ `app/dashboard/corte-combustible/page.tsx` — pantalla del corte (ya estaba en tu repo)
4. ✅ `app/layout.tsx` (RAÍZ) — INTACTO, sin cambios (este es el que cargaba globals.css)

---

## 🎯 Cómo subir TODO de una vez a GitHub

### Opción A — Reemplazar todo el repo (MÁS RÁPIDO Y SEGURO)

1. Descomprimí este ZIP en tu PC
2. Andá a GitHub → tu repo `bbnet-track`
3. **Cambiá a una rama nueva** (opcional pero recomendado):
   - Tocá donde dice "main" arriba a la izquierda del repo
   - Escribí un nombre tipo `cambios-corte-combustible`
   - Tocá "Create branch"
4. Subí los archivos:
   - Tocá **"Add file" → "Upload files"**
   - **Arrastrá TODA la carpeta** descomprimida (o las carpetas adentro)
   - GitHub respeta la estructura: `app/`, `components/`, `lib/`, `supabase/`, etc.
5. Commit con mensaje: "Sidebar con item Corte combustible para Premium"
6. Si creaste una rama nueva, después tocá **"Create pull request"** → "Merge"

### Opción B — Subir solo los archivos cambiados (más quirúrgico)

Si querés ir más despacio y solo subir lo modificado, son estos 2 archivos:

| Archivo en el ZIP | Subir a esta ubicación en GitHub |
|-------------------|----------------------------------|
| `components/Sidebar.tsx` | `components/Sidebar.tsx` |
| `app/dashboard/layout.tsx` | `app/dashboard/layout.tsx` |

**NO subas `app/layout.tsx`** (el raíz) — ese no cambió.

---

## 🧪 Después de subir

1. Esperá 1-2 minutos a que Vercel termine de desplegar
2. Andá a `track.bbnetsecurity.com.ar`
3. **Ctrl+Shift+R** para forzar recarga sin cache
4. Deberías ver:
   - Diseño oscuro normal (no blanco)
   - Sidebar UNA SOLA vez a la izquierda
   - Item **"Corte combustible"** en el menú (porque sos super-admin)
5. Tocás "Corte combustible" en el menú y entrás directo a la pantalla

---

## 📋 Para que un cliente Premium también lo vea

Si querés que Hormigonera Catriló (u otro cliente) vea el item, ese cliente tiene que tener `plan = 'premium'`. SQL:

```sql
UPDATE companies 
SET plan = 'premium' 
WHERE id = '89650a54-66c3-48db-85be-59a2d3131849';
```

---

## ⚠️ Si después de subir el diseño sigue roto

Es posible que Vercel cachee la versión vieja. Probá:
1. Esperar 5 minutos más
2. Ctrl+Shift+R varias veces
3. Probá en una pestaña de incógnito (Ctrl+Shift+N)
4. Si nada funciona, en Vercel forzá un "Redeploy" desde el dashboard

---

## 🆘 Si algo sale mal

Mandame captura de:
1. La pantalla del navegador
2. La estructura del repo en GitHub después de subir

Y lo arreglamos.
