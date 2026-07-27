const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const STATUSES = new Set(['accepted', 'declined', 'pending']);
const GENERAL_STATUSES = new Set(['pending', 'confirmed', 'cancelled']);

/* ---------------------------------------------------------------
   LOGIN — no auth required, this is the entry point
--------------------------------------------------------------- */
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// Everything below requires a valid admin token.
router.use(requireAdmin);

/* ---------------------------------------------------------------
   RSVPS
--------------------------------------------------------------- */
router.get('/rsvps', async (req, res) => {
  const { rows: rsvps } = await pool.query('SELECT * FROM rsvps ORDER BY created_at DESC');
  const { rows: guests } = await pool.query(
    `SELECT g.*, t.name AS table_name
     FROM guests g LEFT JOIN tables t ON t.id = g.table_id
     ORDER BY g.name`
  );

  const guestsByRsvp = new Map();
  for (const g of guests) {
    if (!guestsByRsvp.has(g.rsvp_id)) guestsByRsvp.set(g.rsvp_id, []);
    guestsByRsvp.get(g.rsvp_id).push(g);
  }

  res.json(rsvps.map(r => ({ ...r, guests: guestsByRsvp.get(r.id) || [] })));
});

router.patch('/rsvps/:id', async (req, res) => {
  const fields = [];
  const values = [];
  let i = 1;

  if (typeof req.body.reviewed === 'boolean') {
    fields.push(`reviewed = $${i++}`);
    values.push(req.body.reviewed);
  }
  if (typeof req.body.general_status === 'string') {
    if (!GENERAL_STATUSES.has(req.body.general_status)) {
      return res.status(400).json({ error: 'Estado general inválido.' });
    }
    fields.push(`general_status = $${i++}`);
    values.push(req.body.general_status);
  }
  if (typeof req.body.confirmed_by === 'string') {
    if (!req.body.confirmed_by.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
    fields.push(`confirmed_by = $${i++}`);
    values.push(req.body.confirmed_by.trim());
  }
  for (const key of ['phone', 'email', 'food_restrictions', 'comments']) {
    if (key in req.body) {
      fields.push(`${key} = $${i++}`);
      values.push(req.body[key] || null);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar.' });

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE rsvps SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'RSVP no encontrado.' });
  res.json(rows[0]);
});

router.delete('/rsvps/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM rsvps WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'RSVP no encontrado.' });
  res.json({ ok: true });
});

/* ---------------------------------------------------------------
   MANUAL RSVP CREATION — for confirmations that came in outside
   the web form (phone call, WhatsApp, in person, etc.)
--------------------------------------------------------------- */
router.post('/rsvps', async (req, res) => {
  const { confirmed_by, phone, email, food_restrictions, comments, guests } = req.body || {};

  if (typeof confirmed_by !== 'string' || !confirmed_by.trim()) {
    return res.status(400).json({ error: 'Falta el nombre de quien confirma.' });
  }
  if (!Array.isArray(guests) || guests.length < 1 || guests.length > 10) {
    return res.status(400).json({ error: 'Debe incluir entre 1 y 10 invitados.' });
  }
  for (const g of guests) {
    if (typeof g?.name !== 'string' || !g.name.trim()) {
      return res.status(400).json({ error: 'Cada invitado necesita un nombre.' });
    }
    if (g.status && !STATUSES.has(g.status)) {
      return res.status(400).json({ error: `Estado de invitado inválido: ${g.status}` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rsvpId = crypto.randomUUID();
    await client.query(
      `INSERT INTO rsvps (id, confirmed_by, total_guests, phone, email, food_restrictions, comments, reviewed, general_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'confirmed')`,
      [rsvpId, confirmed_by.trim(), guests.length, phone || null, email || null, food_restrictions || null, comments || null]
    );

    for (const g of guests) {
      await client.query(
        `INSERT INTO guests (id, rsvp_id, name, status) VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), rsvpId, g.name.trim(), g.status || 'accepted']
      );
    }

    await client.query('COMMIT');
    const { rows } = await pool.query('SELECT * FROM rsvps WHERE id = $1', [rsvpId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear RSVP manual:', err);
    res.status(500).json({ error: 'No se pudo crear la confirmación.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------------
   ADD A GUEST to an existing RSVP (e.g. correcting a family group)
--------------------------------------------------------------- */
router.post('/rsvps/:id/guests', async (req, res) => {
  const { name, status } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Falta el nombre del invitado.' });
  }
  if (status && !STATUSES.has(status)) return res.status(400).json({ error: 'Estado inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rsvpRows } = await client.query(
      'SELECT total_guests FROM rsvps WHERE id = $1 FOR UPDATE', [req.params.id]
    );
    if (!rsvpRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'RSVP no encontrado.' });
    }
    if (rsvpRows[0].total_guests >= 10) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este grupo ya tiene el máximo de 10 invitados.' });
    }

    const guestId = crypto.randomUUID();
    const { rows } = await client.query(
      `INSERT INTO guests (id, rsvp_id, name, status) VALUES ($1, $2, $3, $4) RETURNING *`,
      [guestId, req.params.id, name.trim(), status || 'accepted']
    );
    await client.query('UPDATE rsvps SET total_guests = total_guests + 1 WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al agregar invitado:', err);
    res.status(500).json({ error: 'No se pudo agregar el invitado.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------------
   GUESTS — status + table assignment
--------------------------------------------------------------- */
router.patch('/guests/:id', async (req, res) => {
  const fields = [];
  const values = [];
  let i = 1;

  if (typeof req.body.name === 'string') {
    if (!req.body.name.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
    fields.push(`name = $${i++}`);
    values.push(req.body.name.trim());
  }
  if (typeof req.body.status === 'string') {
    if (!STATUSES.has(req.body.status)) return res.status(400).json({ error: 'Estado inválido.' });
    fields.push(`status = $${i++}`);
    values.push(req.body.status);
  }
  if ('table_id' in req.body) {
    fields.push(`table_id = $${i++}`);
    values.push(req.body.table_id || null);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar.' });

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE guests SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'Invitado no encontrado.' });
  res.json(rows[0]);
});

router.delete('/guests/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: guestRows } = await client.query('SELECT rsvp_id FROM guests WHERE id = $1', [req.params.id]);
    if (!guestRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invitado no encontrado.' });
    }

    const { rows: rsvpRows } = await client.query(
      'SELECT total_guests FROM rsvps WHERE id = $1 FOR UPDATE', [guestRows[0].rsvp_id]
    );
    if (rsvpRows[0].total_guests <= 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Es el único invitado de esta confirmación. Elimina la confirmación completa en su lugar.' });
    }

    await client.query('DELETE FROM guests WHERE id = $1', [req.params.id]);
    await client.query('UPDATE rsvps SET total_guests = total_guests - 1 WHERE id = $1', [guestRows[0].rsvp_id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar invitado:', err);
    res.status(500).json({ error: 'No se pudo eliminar el invitado.' });
  } finally {
    client.release();
  }
});

/* ---------------------------------------------------------------
   TABLES (mesas)
--------------------------------------------------------------- */
router.get('/tables', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tables ORDER BY sort_order, name');
  res.json(rows);
});

router.post('/tables', async (req, res) => {
  const { name, capacity, notes } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Falta el nombre de la mesa.' });
  }
  const cap = Number.isInteger(capacity) ? capacity : 8;
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS n FROM tables');
  const id = crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO tables (id, name, capacity, sort_order, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, name.trim(), cap, countRows[0].n, notes || null]
  );
  res.status(201).json(rows[0]);
});

router.patch('/tables/:id', async (req, res) => {
  const fields = [];
  const values = [];
  let i = 1;

  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    fields.push(`name = $${i++}`);
    values.push(req.body.name.trim());
  }
  if (Number.isInteger(req.body.capacity)) {
    fields.push(`capacity = $${i++}`);
    values.push(req.body.capacity);
  }
  if ('notes' in req.body) {
    fields.push(`notes = $${i++}`);
    values.push(req.body.notes || null);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar.' });

  values.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE tables SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!rows.length) return res.status(404).json({ error: 'Mesa no encontrada.' });
  res.json(rows[0]);
});

router.delete('/tables/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM tables WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Mesa no encontrada.' });
  res.json({ ok: true });
});

/* ---------------------------------------------------------------
   BOARD — everything the seating-chart UI needs in one call
--------------------------------------------------------------- */
router.get('/board', async (req, res) => {
  const { rows: tables } = await pool.query('SELECT * FROM tables ORDER BY sort_order, name');
  const { rows: guests } = await pool.query(
    `SELECT g.id, g.name, g.status, g.table_id, g.rsvp_id, r.confirmed_by
     FROM guests g JOIN rsvps r ON r.id = g.rsvp_id
     WHERE g.status = 'accepted'
     ORDER BY g.name`
  );

  const byTable = new Map();
  const unassigned = [];
  for (const g of guests) {
    if (g.table_id) {
      if (!byTable.has(g.table_id)) byTable.set(g.table_id, []);
      byTable.get(g.table_id).push(g);
    } else {
      unassigned.push(g);
    }
  }

  res.json({
    tables: tables.map(t => ({ ...t, guests: byTable.get(t.id) || [] })),
    unassigned,
  });
});

module.exports = router;
