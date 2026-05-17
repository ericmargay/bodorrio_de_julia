# Julia & Benito — Invitación Digital de Boda
## Guía de Configuración y Despliegue

---

## Archivos del proyecto

```
wedding-invitation/
├── index.html     ← Invitación pública (comparte este link con los invitados)
├── admin.html     ← Panel de la novia (mantén este link privado)
├── schema.sql     ← SQL para crear las tablas en Supabase
└── README.md
```

---

## Paso 1 — Configurar Supabase

### 1.1 Crear cuenta y proyecto

1. Ve a https://supabase.com y crea una cuenta gratuita.
2. Haz clic en **New Project**.
3. Elige un nombre (ej: `boda-Julia-Benito`), una contraseña fuerte, y la región más cercana (us-east-1 para México).
4. Espera ~2 minutos mientras se aprovisiona el proyecto.

### 1.2 Crear las tablas con el SQL

1. En el dashboard de tu proyecto, ve a **SQL Editor** en el menú lateral.
2. Haz clic en **New Query**.
3. Pega todo el contenido del archivo `schema.sql`.
4. Haz clic en **Run** (o presiona F5).
5. Deberías ver: `Success. No rows returned.`

Esto crea:
- Tabla `rsvps` (confirmaciones de grupos)
- Tabla `guests` (invitados individuales)
- Vista `rsvp_summary` (para consultas rápidas)
- Todos los índices necesarios
- Las políticas RLS para el modo demo

### 1.3 Obtener tus credenciales

1. Ve a **Project Settings** → **API** (en el menú lateral).
2. Copia estos dos valores:
   - **Project URL**: algo como `https://abcdefghij.supabase.co`
   - **anon / public key**: una cadena larga que empieza con `eyJ...`

⚠️ **NUNCA uses la `service_role` key en el frontend.** Solo usa la `anon public key`.

---

## Paso 2 — Configurar los archivos HTML

Abre `index.html` y `admin.html` con un editor de texto (VS Code, Notepad++, etc.).

En **ambos archivos**, busca el bloque `CONFIG` y reemplaza los valores placeholder:

```javascript
const CONFIG = {
  SUPABASE_URL:      'YOUR_SUPABASE_URL',      // ← Reemplaza aquí
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY', // ← Reemplaza aquí
  // ...
};
```

Por ejemplo:

```javascript
const CONFIG = {
  SUPABASE_URL:      'https://abcdefghij.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  WEDDING_DATE:      '2026-06-14T18:00:00',
  BRIDE_NAME:        'Julia',
  GROOM_NAME:        'Benito',
};
```

También en `admin.html`, cambia la contraseña del panel:

```javascript
ADMIN_PASSWORD: 'boda2026',  // ← Cambia esto por algo más difícil
```

---

## Paso 3 — Actualizar los textos de la invitación

En `index.html`, busca y reemplaza los placeholders de contenido:

| Placeholder | Dónde está | Qué poner |
|---|---|---|
| `Julia` | Hero, footer | Nombre de la novia |
| `Benito`   | Hero, footer | Nombre del novio |
| `14 · Diciembre · 2026` | Hero, countdown, footer | Fecha real |
| `Parroquia del Sagrado Corazón` | Timeline, locations | Nombre de la iglesia |
| `Av. Hidalgo 450...` | Locations | Dirección real de la iglesia |
| `Rancho Los Nogales` | Timeline, locations | Nombre del salón |
| `Carretera Nacional Km. 25...` | Locations | Dirección real del salón |
| `1 de Diciembre de 2026` | RSVP section | Fecha límite de confirmación |
| `Liverpool — Núm. 000000` | Gifts | Número de mesa de regalos |
| `María Isabel Reyes` | Intro | Nombres de padres/padrinos |
| URL de Google Maps | Botones "Ver Ubicación" | Links reales de Google Maps |

### Cómo obtener el link de Google Maps

1. Abre Google Maps en tu navegador.
2. Busca el lugar (ej: la iglesia).
3. Haz clic derecho en el pin → **Compartir** → copia el link.
4. Pégalo en el atributo `href` del botón "Ver Ubicación".

### Agregar foto de los novios al hero

1. Guarda la foto como `assets/couple.jpg` en la misma carpeta que `index.html`.
2. En `index.html`, busca el comentario `PHOTO OVERLAY` y descoméntalo:

```css
/* Descomenta esto: */
.hero::before {
  content: '';
  position: absolute; inset: 0;
  background-image: url('assets/couple.jpg');
  background-size: cover;
  background-position: center 20%;
  opacity: 0.62;
}
```

---

## Paso 4 — Desplegar en GitHub Pages

### 4.1 Crear repositorio en GitHub

1. Ve a https://github.com y crea un nuevo repositorio.
2. Nómbralo algo como `bodorrio_de_julia` o `wedding-2026`.
3. Déjalo **público** (GitHub Pages gratuito requiere repositorio público).

### 4.2 Subir los archivos

**Opción A — Desde el navegador (más fácil):**
1. En tu nuevo repositorio, haz clic en **Add file** → **Upload files**.
2. Arrastra `index.html`, `admin.html`, y la carpeta `assets/` si tienes fotos.
3. Haz clic en **Commit changes**.

**Opción B — Con Git (recomendado):**
```bash
git init
git add index.html admin.html assets/
git commit -m "Initial wedding invitation"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 4.3 Activar GitHub Pages

1. En tu repositorio en GitHub, ve a **Settings** → **Pages** (menú lateral izquierdo).
2. Bajo **Source**, selecciona `Deploy from a branch`.
3. Branch: `main`, folder: `/ (root)`.
4. Haz clic en **Save**.
5. Espera 1–2 minutos. GitHub te mostrará la URL pública, algo como:
   `https://ericmargay.github.io/bodorrio_de_julia/`

### 4.4 Configurar CORS en Supabase (si hay errores)

Si ves errores de CORS en la consola del navegador:
1. Ve a **Supabase Dashboard** → **Project Settings** → **API** → **CORS**.
2. Agrega tu URL de GitHub Pages: `https://ericmargay.github.io`
3. Guarda.

---

## Paso 5 — Compartir los links

| Link | Para quién | Cómo compartir |
|---|---|---|
| `https://ericmargay.github.io/bodorrio_de_julia/` | Todos los invitados | WhatsApp, email, Instagram |
| `https://ericmargay.github.io/bodorrio_de_julia/admin.html` | Solo la novia | WhatsApp privado, guardarlo en notas |

**Tip de seguridad:** Cambia el nombre `admin.html` a algo más difícil de adivinar, como `panel-6k9x.html`. No es seguridad real, pero reduce la probabilidad de que alguien lo encuentre por accidente.

---

## Probar el RSVP

1. Abre `index.html` en tu navegador (directamente como archivo o desde GitHub Pages).
2. Haz clic en "Confirmar Asistencia" y llena el formulario.
3. Haz clic en "Enviar Confirmación".
4. Ve al dashboard de Supabase → **Table Editor** → tabla `rsvps`.
5. Deberías ver tu confirmación de prueba ahí.
6. Abre `admin.html`, ingresa la contraseña, y verifica que aparece.

---

## Migración a dominio propio (opcional, futuro)

Cuando tengan un dominio personalizado (ej: `Julia-y-Benito.com`):

1. **Frontend:** Sube los mismos archivos a tu hosting (Netlify, Vercel, cPanel, etc.).
2. **Supabase:** No cambia nada — la base de datos sigue siendo la misma.
3. **CORS:** Agrega el nuevo dominio en Supabase Dashboard → API → CORS.
4. **CONFIG:** No necesitas cambiar nada en el código si la URL de Supabase no cambió.

---

## Migrar a Supabase Auth (seguridad real para el admin)

Cuando quieran proteger el panel admin de verdad:

1. **En Supabase:** Dashboard → Authentication → Users → **Invite a user**.
   - Usa el email de la novia. Recibirá un link para crear su contraseña.

2. **En admin.html:** Reemplaza el bloque de login con Supabase Auth:

```javascript
// Login con Supabase Auth
const { error } = await supabase.auth.signInWithPassword({
  email: emailInput.value,
  password: passwordInput.value,
});
if (error) { /* mostrar error */ }
else        { /* mostrar dashboard */ }

// Logout
await supabase.auth.signOut();
```

3. **En schema.sql:** Elimina las políticas DEMO y activa las PRODUCTION
   (las instrucciones están comentadas al final de `schema.sql`).

---

## Preguntas frecuentes

**¿Alguien puede ver los datos de otros invitados desde la invitación pública?**
No. La invitación solo tiene permiso de INSERT. Para leer los datos se necesita acceso al panel admin o al dashboard de Supabase.

**¿Es seguro tener la anon key visible en el código fuente?**
Sí. La anon key es pública por diseño — es equivalente a una clave de API de solo lectura. Las políticas RLS en Supabase controlan lo que puede hacer con ella. La única clave que NUNCA debe estar en el frontend es la `service_role key`.

**¿Qué pasa si alguien envía muchos RSVP falsos?**
Para una boda privada donde el link solo se comparte con invitados conocidos, el riesgo es muy bajo. Si quieres más protección, puedes agregar un honeypot field o validación de email al formulario.

**¿Puedo usar esto para más de 500 confirmaciones?**
Sí. El plan gratuito de Supabase permite hasta 500MB de base de datos y 2GB de transferencia mensual, más que suficiente para cualquier boda.

---

## Soporte

Construido con:
- **Supabase** — Backend, PostgreSQL, RLS
- **Great Vibes + Playfair Display + Cormorant Garamond** — Google Fonts
- **HTML/CSS/JS Vanilla** — Sin build step, desplegable directamente en GitHub Pages

---

*Con amor · 2026*
