# Julia & Erick — Invitación Digital de Boda

## Guía de configuración y despliegue

---

## Arquitectura

```
bodorrio_de_julia/
├── index.html      ← Invitación pública (GitHub Pages)
├── admin.html       ← Panel de la novia: confirmaciones + mesas (GitHub Pages)
├── server/          ← API + base de datos (Railway)
│   ├── src/
│   │   ├── index.js      Servidor Express
│   │   ├── db.js         Conexión a Postgres + creación automática del esquema
│   │   ├── schema.sql     Tablas: rsvps, guests, tables
│   │   ├── seed.js        Datos de ejemplo: ~100 invitados en 15 mesas
│   │   ├── routes/
│   │   │   ├── rsvp.js     POST público para confirmar asistencia
│   │   │   └── admin.js    Login + CRUD de confirmaciones, invitados y mesas
│   │   └── middleware/
│   │       └── auth.js    Verifica el token de sesión del panel admin
│   └── package.json
└── README.md
```

**index.html y admin.html siguen viviendo en GitHub Pages** (como ya estaban desplegados).
**server/ es un servicio Node.js + PostgreSQL nuevo, que se despliega en Railway** y expone
una API HTTP que ambas páginas consumen por `fetch`.

---

## Paso 1 — Desplegar el servidor en Railway

1. Ve a https://railway.app y crea un cuenta / inicia sesión.
2. **New Project → Deploy from GitHub repo** y elige este repositorio.
3. En la configuración del servicio, define el **Root Directory** como `server`
   (Railway solo debe construir/ejecutar lo que está dentro de esa carpeta).
4. En el mismo proyecto de Railway, haz clic en **+ New → Database → Add PostgreSQL**.
   Railway conecta automáticamente la variable `DATABASE_URL` al servicio (si no lo hace
   solo, ve a la pestaña **Variables** del servicio y agrégala referenciando el plugin de Postgres).
5. En **Variables** del servicio agrega:

   | Variable | Valor |
   |---|---|
   | `ADMIN_PASSWORD` | La contraseña del panel de la novia (cámbiala del default) |
   | `JWT_SECRET` | Una cadena larga y aleatoria (ej. genera una con `openssl rand -hex 32`) |
   | `ALLOWED_ORIGINS` | `https://ericmargay.github.io` (agrega más orígenes separados por coma si haces pruebas locales) |
   | `PGSSLMODE` | `require` si Railway te pide SSL para conectarte a Postgres (ver logs si el arranque falla por SSL) |

6. Railway detecta `server/package.json` y corre `npm install` + `npm start` automáticamente
   (usa Nixpacks). El servidor crea las tablas solo la primera vez que arranca — no necesitas
   correr ningún script SQL a mano.
7. Cuando termine el deploy, copia la URL pública del servicio
   (algo como `https://boda-julia-erick-production.up.railway.app`).

### Sembrar datos de ejemplo (opcional)

Para probar el panel de mesas con datos realistas (~100 invitados confirmados en grupos
familiares, repartidos en 15 mesas, dejando algunos sin asignar a propósito):

```bash
# Desde tu máquina, usando el CLI de Railway conectado al proyecto:
railway run npm run seed --service <nombre-del-servicio>
```

O ejecútalo localmente apuntando a la base de datos de Railway (copia el `DATABASE_URL`
público desde la pestaña Variables):

```bash
cd server
npm install
DATABASE_URL="postgres://..." npm run seed
```

⚠️ El seed **borra** todas las filas de `rsvps`, `guests` y `tables` antes de insertar los
datos de ejemplo. No lo corras una vez que tengan confirmaciones reales.

---

## Paso 2 — Conectar index.html y admin.html al servidor

Abre **ambos archivos** (`index.html` y `admin.html`) y busca el bloque `CONFIG`:

```javascript
const CONFIG = {
  API_URL: 'https://YOUR-APP.up.railway.app', // ← Reemplaza con tu URL de Railway
  ...
};
```

Reemplaza `API_URL` con la URL real que copiaste en el paso anterior. Debe ser **exactamente
la misma** en los dos archivos.

En `admin.html`, la contraseña **ya no vive en el HTML** — se valida en el servidor contra
la variable `ADMIN_PASSWORD` que configuraste en Railway.

---

## Paso 3 — Subir los cambios a GitHub Pages

```bash
git add index.html admin.html server/ README.md
git commit -m "Conectar RSVP y panel de mesas al servidor de Railway"
git push
```

GitHub Pages se actualiza solo (unos minutos) porque `index.html`/`admin.html` están en la
raíz del repo, tal como ya estaba configurado.

### CORS

Si ves errores de CORS en la consola del navegador al enviar el formulario o iniciar sesión
en el panel, revisa que `ALLOWED_ORIGINS` en Railway incluya exactamente el dominio desde el
que sirves las páginas (por ejemplo `https://ericmargay.github.io`, sin `/` final).

---

## Cómo funciona el RSVP

1. Un invitado llena el formulario en la sección "Queremos verte" de `index.html`.
2. El formulario hace `POST` a `{API_URL}/api/rsvp` con su nombre, teléfono, acompañantes, etc.
3. El servidor crea una fila en `rsvps` y una fila por cada invitado en `guests`
   (estado inicial `accepted`).
4. La novia entra a `admin.html`, inicia sesión con la contraseña, y ve la confirmación
   en la pestaña **Confirmaciones**: puede marcarla como revisada, cambiar el estado de
   cada invitado, o eliminarla.
5. En la pestaña **Mesas**, todos los invitados con estado `accepted` aparecen en la columna
   "Sin mesa" hasta que se arrastran (o se seleccionan con un toque) hacia una de las mesas.
   El tablero muestra cupo ocupado/total por mesa y bloquea asignaciones si la mesa ya está llena.

El botón de WhatsApp se mantiene como alternativa para quien prefiera confirmar por ahí —
esas confirmaciones no aparecen en el panel automáticamente, hay que agregarlas a mano si
alguien confirma solo por ese medio.

---

## Panel de mesas — gestión de invitados

- **Renombrar / cambiar capacidad de una mesa:** haz clic en el nombre de la mesa.
- **Agregar una mesa:** botón "+ Agregar mesa" al final de la cuadrícula.
- **Eliminar una mesa:** sus invitados regresan automáticamente a "Sin mesa".
- **Mover invitados:** arrastra la tarjeta de un invitado hacia otra mesa o hacia "Sin mesa"
  (funciona en escritorio). En celular/tablet, toca al invitado para seleccionarlo (se resalta)
  y luego toca la mesa destino.
- Los indicadores circulares de cada mesa muestran cuántos lugares están ocupados de un vistazo.

---

## Desarrollo local

```bash
cd server
cp .env.example .env     # edita DATABASE_URL para que apunte a tu Postgres local
npm install
npm run seed              # opcional: llena la base con datos de ejemplo
npm start
```

El servidor corre en `http://localhost:3000` por defecto. Para probar `index.html`/`admin.html`
localmente, sirve la raíz del repo con cualquier servidor estático (por ejemplo
`npx serve .`) y pon `API_URL: 'http://localhost:3000'` temporalmente en el `CONFIG` de ambos
archivos — recuerda regresarlo a la URL de Railway antes de subir cambios.

---

## Preguntas frecuentes

**¿Necesito correr el `schema.sql` a mano en Railway?**
No. El servidor lo ejecuta automáticamente (`CREATE TABLE IF NOT EXISTS ...`) cada vez que arranca.

**¿Es seguro tener `API_URL` visible en el código fuente?**
Sí, es solo la dirección pública de tu API. Lo que protege los datos es que las rutas de
`/api/admin/*` requieren el token que se obtiene al iniciar sesión con `ADMIN_PASSWORD`
(que nunca se expone en el HTML).

**¿Qué pasa si alguien manda RSVPs falsos?**
El endpoint público solo permite crear confirmaciones, no leer ni modificar datos existentes.
Para una boda privada donde el link se comparte solo con invitados conocidos, el riesgo es bajo.

---

## Soporte técnico

Construido con:
- **Node.js + Express + PostgreSQL** — API y base de datos, en Railway
- **Great Vibes + Playfair Display + Cormorant Garamond** — Google Fonts
- **HTML/CSS/JS Vanilla** — Sin build step en el frontend, desplegable en GitHub Pages

---

*Con amor · 2026*
