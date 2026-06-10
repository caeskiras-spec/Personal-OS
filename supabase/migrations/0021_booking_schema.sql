-- 0021_booking_schema.sql
-- Adds: booking_links, availability_rules, meetings tables
-- + btree_gist extension for overlap exclusion constraint
-- All idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS)

-- ── Extension ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── booking_links ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_links (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug             text        NOT NULL,
  title            text        NOT NULL DEFAULT 'Запись на встречу',
  duration_minutes int         NOT NULL DEFAULT 30,
  buffer_minutes   int         NOT NULL DEFAULT 0,
  timezone         text        NOT NULL DEFAULT 'Europe/Moscow',
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_links_slug_unique UNIQUE (slug)
);

ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bl_own_select" ON public.booking_links;
CREATE POLICY "bl_own_select" ON public.booking_links
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bl_own_insert" ON public.booking_links;
CREATE POLICY "bl_own_insert" ON public.booking_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bl_own_update" ON public.booking_links;
CREATE POLICY "bl_own_update" ON public.booking_links
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bl_own_delete" ON public.booking_links;
CREATE POLICY "bl_own_delete" ON public.booking_links
  FOR DELETE USING (auth.uid() = user_id);

-- ── availability_rules ─────────────────────────────────────────────────────────
-- weekday: 0=Mon … 6=Sun (ISO week convention)
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id    uuid NOT NULL REFERENCES public.booking_links(id) ON DELETE CASCADE,
  weekday    int  NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time   time NOT NULL
);

ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ar_own_select" ON public.availability_rules;
CREATE POLICY "ar_own_select" ON public.availability_rules
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ar_own_insert" ON public.availability_rules;
CREATE POLICY "ar_own_insert" ON public.availability_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ar_own_update" ON public.availability_rules;
CREATE POLICY "ar_own_update" ON public.availability_rules
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ar_own_delete" ON public.availability_rules;
CREATE POLICY "ar_own_delete" ON public.availability_rules
  FOR DELETE USING (auth.uid() = user_id);

-- ── meetings ───────────────────────────────────────────────────────────────────
-- Exclusion constraint prevents double-booking at DB level.
-- Requires btree_gist (enabled above).
CREATE TABLE IF NOT EXISTS public.meetings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id        uuid        REFERENCES public.booking_links(id) ON DELETE SET NULL,
  guest_name     text        NOT NULL,
  guest_phone    text,
  guest_telegram text,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  status         text        NOT NULL DEFAULT 'confirmed',
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Prevent two non-cancelled meetings from overlapping for the same owner
  CONSTRAINT meetings_no_overlap EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status <> 'cancelled')
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mt_own_select" ON public.meetings;
CREATE POLICY "mt_own_select" ON public.meetings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mt_own_insert" ON public.meetings;
CREATE POLICY "mt_own_insert" ON public.meetings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mt_own_update" ON public.meetings;
CREATE POLICY "mt_own_update" ON public.meetings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mt_own_delete" ON public.meetings;
CREATE POLICY "mt_own_delete" ON public.meetings
  FOR DELETE USING (auth.uid() = user_id);
