-- ================================================================
-- WEDDING RSVP + SEATING — DATABASE SCHEMA (Railway / Postgres)
-- Julia & Erick · 31 de Octubre de 2026
-- ================================================================
-- IDs are generated in application code (crypto.randomUUID()),
-- so no Postgres extension (pgcrypto/uuid-ossp) is required.
-- This file is executed automatically on server boot (see db.js).
-- ================================================================

CREATE TABLE IF NOT EXISTS tables (
  id         UUID        PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       TEXT        NOT NULL,
  capacity   INTEGER     NOT NULL DEFAULT 8 CHECK (capacity BETWEEN 1 AND 20),
  sort_order INTEGER     NOT NULL DEFAULT 0,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS rsvps (
  id                UUID        PRIMARY KEY,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_by      TEXT        NOT NULL,
  total_guests      INTEGER     NOT NULL CHECK (total_guests BETWEEN 1 AND 10),
  phone             TEXT,
  email             TEXT,
  food_restrictions TEXT,
  comments          TEXT,
  reviewed          BOOLEAN     NOT NULL DEFAULT FALSE,
  general_status    TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (general_status IN ('pending', 'confirmed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS guests (
  id         UUID        PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rsvp_id    UUID        NOT NULL REFERENCES rsvps(id) ON DELETE CASCADE,
  table_id   UUID        REFERENCES tables(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'accepted'
                CHECK (status IN ('accepted', 'declined', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_guests_rsvp_id    ON guests(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_guests_table_id   ON guests(table_id);
CREATE INDEX IF NOT EXISTS idx_guests_status      ON guests(status);
CREATE INDEX IF NOT EXISTS idx_rsvps_reviewed     ON rsvps(reviewed);
CREATE INDEX IF NOT EXISTS idx_rsvps_created_at   ON rsvps(created_at DESC);
