/**
 * Seed de demostración (Argentina): ~100 invitados confirmados repartidos
 * en 15 mesas ("fogones") para la boda vaquera de Martina & Facundo.
 * Borra los datos existentes de rsvps/guests/tables y los vuelve a crear.
 * Uso: npm run seed
 */
require('dotenv').config();
const crypto = require('crypto');
const { pool, initSchema } = require('./db');

const FIRST_NAMES = [
  'Martina', 'Santiago', 'Sofía', 'Mateo', 'Valentina', 'Facundo', 'Catalina', 'Tomás', 'Josefina', 'Lucas',
  'Delfina', 'Franco', 'Pilar', 'Bautista', 'Julieta', 'Agustín', 'Camila', 'Ignacio', 'Milagros', 'Joaquín',
  'Rocío', 'Nicolás', 'Agostina', 'Máximo', 'Micaela', 'Federico', 'Guadalupe', 'Emiliano', 'Antonella', 'Gonzalo',
  'Florencia', 'Matías', 'Victoria', 'Ramiro', 'Candela', 'Thiago', 'Abril', 'Ezequiel', 'Morena', 'Benjamín',
  'Luciana', 'Cruz', 'Malena', 'Gaspar', 'Guillermina', 'Baltazar', 'Ariadna', 'Dante', 'Renata', 'Simón',
  'Azul', 'Lautaro', 'Zoe', 'Bruno', 'Constanza', 'Valentino', 'Elena', 'Segundo', 'Amparo', 'Ciro',
];

const LAST_NAMES = [
  'Gómez', 'Rodríguez', 'Fernández', 'López', 'García', 'Martínez', 'Pérez', 'González', 'Sánchez', 'Romero',
  'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera',
  'Suárez', 'Ibáñez', 'Godoy', 'Molina', 'Ortiz', 'Núñez', 'Domínguez', 'Rojas', 'Silva', 'Aguirre',
  'Funes', 'Duarte', 'Quiroga', 'Lezcano', 'Coria', 'Bazán', 'Ledesma', 'Cabrera', 'Paz', 'Villalba',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Group-size distribution weighted towards couples/small families,
// with a few singles and a few larger families — mirrors a real guest list.
const GROUP_SIZE_WEIGHTS = [1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6];

function buildGroups(targetTotal) {
  const groups = [];
  let remaining = targetTotal;
  while (remaining > 0) {
    let size = pick(GROUP_SIZE_WEIGHTS);
    if (size > remaining) size = remaining;
    const lastName = pick(LAST_NAMES);
    const names = Array.from({ length: size }, () => `${pick(FIRST_NAMES)} ${lastName}`);
    groups.push({
      confirmed_by: names[0],
      lastName,
      guestNames: names,
    });
    remaining -= size;
  }
  return groups;
}

const FOOD_NOTES = [
  null, null, null, null, null,
  'Vegetariano', 'Sin gluten', 'Alergia a mariscos', 'Vegano', 'Sin lactosa',
];
const COMMENTS = [
  null, null, null, null,
  '¡No nos lo perderíamos por nada!',
  'Llegaremos un día antes, ¿hay recomendación de hotel?',
  'Con mucho gusto ahí estaremos.',
  '¿Hay servicio de transporte desde el hotel?',
];

async function seed() {
  await initSchema();

  console.log('Borrando datos existentes...');
  await pool.query('DELETE FROM guests');
  await pool.query('DELETE FROM rsvps');
  await pool.query('DELETE FROM tables');

  console.log('Creando 15 mesas (fogones)...');
  const CAPACITY_PER_TABLE = 8;
  const tableIds = [];
  for (let n = 1; n <= 15; n++) {
    const id = crypto.randomUUID();
    tableIds.push(id);
    await pool.query(
      `INSERT INTO tables (id, name, capacity, sort_order) VALUES ($1, $2, $3, $4)`,
      [id, `Fogón ${n}`, CAPACITY_PER_TABLE, n]
    );
  }

  console.log('Generando ~100 invitados confirmados en grupos familiares...');
  const groups = buildGroups(100);

  // Assign whole groups to tables greedily, keeping families together,
  // but leave a handful of guests unseated to demo the "sin mesa" workflow.
  const capacityLeft = new Map(tableIds.map(id => [id, CAPACITY_PER_TABLE]));
  const UNSEAT_TARGET = 12; // guests intentionally left without a table
  let unseated = 0;

  for (const group of groups) {
    const rsvpId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO rsvps (id, confirmed_by, total_guests, phone, email, food_restrictions, comments, reviewed, general_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')`,
      [
        rsvpId,
        group.confirmed_by,
        group.guestNames.length,
        `+54 9 11 ${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`,
        `${group.confirmed_by.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        pick(FOOD_NOTES),
        pick(COMMENTS),
        Math.random() > 0.25,
      ]
    );

    // Decide whether this group stays unassigned (small chance, only while under target).
    const leaveUnseated = unseated < UNSEAT_TARGET && Math.random() < 0.15
      && group.guestNames.length <= (UNSEAT_TARGET - unseated);

    let targetTable = null;
    if (!leaveUnseated) {
      targetTable = shuffle(tableIds).find(id => capacityLeft.get(id) >= group.guestNames.length);
    }

    for (const name of group.guestNames) {
      const guestId = crypto.randomUUID();
      let tableId = null;
      if (targetTable) {
        tableId = targetTable;
        capacityLeft.set(targetTable, capacityLeft.get(targetTable) - 1);
      } else {
        unseated++;
      }
      await pool.query(
        `INSERT INTO guests (id, rsvp_id, name, status, table_id) VALUES ($1, $2, $3, 'accepted', $4)`,
        [guestId, rsvpId, name, tableId]
      );
    }
  }

  const totalGuests = groups.reduce((sum, g) => sum + g.guestNames.length, 0);
  console.log(`Listo: ${groups.length} confirmaciones, ${totalGuests} invitados, ${unseated} sin mesa asignada todavía.`);
  await pool.end();
}

seed().catch(err => {
  console.error('Error al sembrar datos:', err);
  process.exit(1);
});
