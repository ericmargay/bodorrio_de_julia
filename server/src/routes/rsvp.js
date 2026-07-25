const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

const STATUSES = new Set(['accepted', 'declined', 'pending']);

router.post('/', async (req, res) => {
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
      `INSERT INTO rsvps (id, confirmed_by, total_guests, phone, email, food_restrictions, comments, general_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')`,
      [rsvpId, confirmed_by.trim(), guests.length, phone || null, email || null, food_restrictions || null, comments || null]
    );

    for (const g of guests) {
      await client.query(
        `INSERT INTO guests (id, rsvp_id, name, status) VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), rsvpId, g.name.trim(), g.status || 'accepted']
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: rsvpId, ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al guardar RSVP:', err);
    res.status(500).json({ error: 'No se pudo guardar la confirmación. Intenta de nuevo.' });
  } finally {
    client.release();
  }
});

module.exports = router;
