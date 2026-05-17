-- ================================================================
-- WEDDING INVITATION — DATABASE SCHEMA
-- Julia & Benito · 14 de Junio de 2026
-- ================================================================
-- USAGE: Paste this entire script in:
--   Supabase Dashboard → SQL Editor → New Query → Run (F5)
-- ================================================================


-- ================================================================
-- TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS rsvps (
  id                UUID         PRIMARY KEY  DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ  NOT NULL     DEFAULT NOW(),
  confirmed_by      TEXT         NOT NULL,
  total_guests      INTEGER      NOT NULL     CHECK (total_guests BETWEEN 1 AND 10),
  phone             TEXT,
  email             TEXT,
  food_restrictions TEXT,
  comments          TEXT,
  reviewed          BOOLEAN      NOT NULL     DEFAULT FALSE,
  general_status    TEXT         NOT NULL     DEFAULT 'pending'
                                 CHECK (general_status IN ('pending', 'confirmed', 'cancelled'))
);

COMMENT ON TABLE  rsvps                   IS 'Confirmaciones de asistencia recibidas';
COMMENT ON COLUMN rsvps.confirmed_by      IS 'Nombre de quien confirma el grupo';
COMMENT ON COLUMN rsvps.total_guests      IS 'Número total de invitados en este grupo (1–10)';
COMMENT ON COLUMN rsvps.reviewed          IS 'Marcado como revisado por la novia en el panel admin';
COMMENT ON COLUMN rsvps.general_status    IS 'Estado general del grupo: pending | confirmed | cancelled';


CREATE TABLE IF NOT EXISTS guests (
  id         UUID        PRIMARY KEY  DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL     DEFAULT NOW(),
  rsvp_id    UUID        NOT NULL     REFERENCES rsvps(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL     DEFAULT 'accepted'
                         CHECK (status IN ('accepted', 'declined', 'pending'))
);

COMMENT ON TABLE  guests         IS 'Invitados individuales vinculados a cada RSVP';
COMMENT ON COLUMN guests.rsvp_id IS 'FK al grupo de confirmación padre';
COMMENT ON COLUMN guests.status  IS 'accepted | declined | pending';


-- Indexes for common admin queries
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_id     ON guests(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_guests_status       ON guests(status);
CREATE INDEX IF NOT EXISTS idx_rsvps_reviewed      ON rsvps(reviewed);
CREATE INDEX IF NOT EXISTS idx_rsvps_created_at    ON rsvps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvps_confirmed_by  ON rsvps(confirmed_by);


-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE rsvps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- DEMO POLICIES (GitHub Pages + anon key)
--
-- ⚠️  These allow the anon public key to perform ALL operations.
-- ⚠️  This is intentional for the demo: the invitation form needs
--     INSERT without login, and the admin panel uses the same key.
-- ⚠️  This is acceptable for a private wedding (~50–300 guests)
--     where the admin link is shared only with the bride.
-- ⚠️  See PRODUCTION POLICIES below for the secure upgrade path.
-- ================================================================

-- Public invitation form can INSERT rsvps
CREATE POLICY "demo_anon_insert_rsvps"
  ON rsvps FOR INSERT TO anon
  WITH CHECK (true);

-- Public invitation form can INSERT guests linked to their rsvp
CREATE POLICY "demo_anon_insert_guests"
  ON guests FOR INSERT TO anon
  WITH CHECK (true);

-- Admin panel can SELECT all rsvps (DEMO ONLY)
CREATE POLICY "demo_anon_select_rsvps"
  ON rsvps FOR SELECT TO anon
  USING (true);

-- Admin panel can SELECT all guests (DEMO ONLY)
CREATE POLICY "demo_anon_select_guests"
  ON guests FOR SELECT TO anon
  USING (true);

-- Admin panel can UPDATE rsvps (reviewed flag, status) (DEMO ONLY)
CREATE POLICY "demo_anon_update_rsvps"
  ON rsvps FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- Admin panel can UPDATE guest status (DEMO ONLY)
CREATE POLICY "demo_anon_update_guests"
  ON guests FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- Admin panel can DELETE rsvps (cascade deletes guests) (DEMO ONLY)
CREATE POLICY "demo_anon_delete_rsvps"
  ON rsvps FOR DELETE TO anon
  USING (true);

-- Admin panel can DELETE guests individually (DEMO ONLY)
CREATE POLICY "demo_anon_delete_guests"
  ON guests FOR DELETE TO anon
  USING (true);


-- ================================================================
-- PRODUCTION POLICIES (use after adding Supabase Auth to admin)
--
-- Steps to migrate:
--   1. Add Supabase Auth to admin.html (see README)
--   2. Create admin user: Supabase Dashboard → Auth → Users → Invite
--   3. Run the DROP statements below
--   4. Uncomment and run the CREATE POLICY statements below
-- ================================================================

/*
-- Step 3: Drop the overpermissive demo policies
DROP POLICY IF EXISTS "demo_anon_select_rsvps"   ON rsvps;
DROP POLICY IF EXISTS "demo_anon_select_guests"  ON guests;
DROP POLICY IF EXISTS "demo_anon_update_rsvps"   ON rsvps;
DROP POLICY IF EXISTS "demo_anon_update_guests"  ON guests;
DROP POLICY IF EXISTS "demo_anon_delete_rsvps"   ON rsvps;
DROP POLICY IF EXISTS "demo_anon_delete_guests"  ON guests;

-- Step 4a: Public invitation form keeps INSERT (stays public forever)
-- (demo_anon_insert_rsvps and demo_anon_insert_guests remain as-is,
-- just rename them for clarity if you want)

-- Step 4b: Only authenticated admin users can SELECT
CREATE POLICY "prod_auth_select_rsvps"
  ON rsvps FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "prod_auth_select_guests"
  ON guests FOR SELECT TO authenticated
  USING (true);

-- Step 4c: Only authenticated admin users can UPDATE
CREATE POLICY "prod_auth_update_rsvps"
  ON rsvps FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "prod_auth_update_guests"
  ON guests FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Step 4d: Only authenticated admin users can DELETE
CREATE POLICY "prod_auth_delete_rsvps"
  ON rsvps FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "prod_auth_delete_guests"
  ON guests FOR DELETE TO authenticated
  USING (true);
*/


-- ================================================================
-- HELPER VIEW — RSVP summary with guest counts
-- Useful for quick queries from the Supabase SQL editor
-- Example: SELECT * FROM rsvp_summary WHERE guests_accepted > 0;
-- ================================================================

CREATE OR REPLACE VIEW rsvp_summary AS
  SELECT
    r.id,
    r.created_at,
    r.confirmed_by,
    r.total_guests,
    r.phone,
    r.email,
    r.food_restrictions,
    r.comments,
    r.reviewed,
    r.general_status,
    COUNT(g.id) FILTER (WHERE g.status = 'accepted') AS guests_accepted,
    COUNT(g.id) FILTER (WHERE g.status = 'declined') AS guests_declined,
    COUNT(g.id) FILTER (WHERE g.status = 'pending')  AS guests_pending
  FROM rsvps r
  LEFT JOIN guests g ON g.rsvp_id = r.id
  GROUP BY r.id
  ORDER BY r.created_at DESC;

-- Quick stats query (run anytime):
-- SELECT
--   COUNT(*)                                                      AS total_rsvps,
--   SUM(guests_accepted)                                          AS total_attending,
--   SUM(guests_declined)                                          AS total_not_attending,
--   SUM(guests_pending)                                           AS total_pending,
--   COUNT(*) FILTER (WHERE reviewed = true)                       AS reviewed_count
-- FROM rsvp_summary;
