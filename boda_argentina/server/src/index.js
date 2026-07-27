require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db');
const rsvpRouter = require('./routes/rsvp');
const adminRouter = require('./routes/admin');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/non-browser requests (no Origin header) and configured origins.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/rsvp', rsvpRouter);
app.use('/api/admin', adminRouter);

app.use((err, req, res, next) => {
  if (err.message?.startsWith('Origen no permitido')) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 3000;

initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor de RSVP escuchando en el puerto ${PORT}`));
  })
  .catch(err => {
    console.error('No se pudo inicializar el esquema de la base de datos:', err);
    process.exit(1);
  });
