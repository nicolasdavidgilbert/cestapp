-- Improve audit scalability and analytical usefulness.
-- Safe to run multiple times.
-- Usage:
--   npx @insforge/cli db query -- "$(cat sql/improve-activity-audit.sql)"

BEGIN;

-- 1) If audit table is still a regular table, rename to legacy for migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_activity_events'
      AND c.relkind = 'r'
  ) AND to_regclass('public.user_activity_events_legacy') IS NULL THEN
    ALTER TABLE public.user_activity_events RENAME TO user_activity_events_legacy;
  END IF;
END;
$$;

-- 2) Partitioned table for long-term scale.
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ingested_at timestamp with time zone NOT NULL DEFAULT now(),
  actor_user_id text,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'db_trigger',
  list_id uuid,
  item_id uuid,
  product_id uuid,
  price_history_id uuid,
  target_user_id text,
  invite_link_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_version smallint NOT NULL DEFAULT 2
) PARTITION BY RANGE (created_at);

ALTER TABLE public.user_activity_events
  ADD COLUMN IF NOT EXISTS ingested_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.user_activity_events
  ADD COLUMN IF NOT EXISTS event_version smallint NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_activity_events_pk'
      AND conrelid = 'public.user_activity_events'::regclass
  ) THEN
    ALTER TABLE public.user_activity_events
      ADD CONSTRAINT user_activity_events_pk PRIMARY KEY (created_at, id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_activity_events_event_type_not_empty'
      AND conrelid = 'public.user_activity_events'::regclass
  ) THEN
    ALTER TABLE public.user_activity_events
      ADD CONSTRAINT user_activity_events_event_type_not_empty
      CHECK (length(btrim(event_type)) > 0);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_activity_events_metadata_object'
      AND conrelid = 'public.user_activity_events'::regclass
  ) THEN
    ALTER TABLE public.user_activity_events
      ADD CONSTRAINT user_activity_events_metadata_object
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;
END;
$$;

-- 3) Partition management helpers.
CREATE OR REPLACE FUNCTION public.ensure_user_activity_partition(p_month_start date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start timestamp with time zone := date_trunc('month', p_month_start::timestamp with time zone);
  v_end timestamp with time zone := v_start + interval '1 month';
  v_partition_name text := format('user_activity_events_%s', to_char(v_start, 'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.user_activity_events FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    v_start,
    v_end
  );
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_partition_name);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_partition_name);
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
    v_partition_name
  );
  EXECUTE format('DROP POLICY IF EXISTS project_admin_policy ON public.%I', v_partition_name);
  EXECUTE format(
    'CREATE POLICY project_admin_policy ON public.%I FOR ALL TO project_admin USING (true) WITH CHECK (true)',
    v_partition_name
  );

  RETURN v_partition_name;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_activity_events_default
  PARTITION OF public.user_activity_events DEFAULT;

CREATE OR REPLACE FUNCTION public.maintain_user_activity_partitions(
  p_months_back integer DEFAULT 1,
  p_months_ahead integer DEFAULT 6,
  p_retention_months integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_month date := date_trunc('month', now())::date;
  v_month date;
  v_created integer := 0;
  v_dropped integer := 0;
  v_cutoff date;
  v_part record;
  v_part_month date;
BEGIN
  v_month := (v_current_month - make_interval(months => GREATEST(p_months_back, 0)))::date;
  WHILE v_month <= (v_current_month + make_interval(months => GREATEST(p_months_ahead, 0)))::date LOOP
    PERFORM public.ensure_user_activity_partition(v_month);
    v_created := v_created + 1;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;

  IF p_retention_months IS NOT NULL AND p_retention_months > 0 THEN
    v_cutoff := (v_current_month - make_interval(months => p_retention_months))::date;

    FOR v_part IN
      SELECT c.relname AS partition_name
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND p.relname = 'user_activity_events'
        AND c.relname ~ '^user_activity_events_[0-9]{4}_[0-9]{2}$'
    LOOP
      v_part_month := to_date(
        substring(v_part.partition_name FROM '([0-9]{4}_[0-9]{2})$'),
        'YYYY_MM'
      );

      IF v_part_month < v_cutoff THEN
        EXECUTE format('DROP TABLE IF EXISTS public.%I', v_part.partition_name);
        v_dropped := v_dropped + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'created_or_checked_partitions', v_created,
    'dropped_old_partitions', v_dropped,
    'retention_months', p_retention_months
  );
END;
$$;

-- 4) Ensure partitions for legacy data months and near future.
DO $$
DECLARE
  v_min_month date;
  v_max_month date;
  v_month date;
BEGIN
  IF to_regclass('public.user_activity_events_legacy') IS NOT NULL THEN
    SELECT
      date_trunc('month', min(created_at))::date,
      date_trunc('month', max(created_at))::date
    INTO v_min_month, v_max_month
    FROM public.user_activity_events_legacy;

    IF v_min_month IS NOT NULL THEN
      v_month := v_min_month;
      WHILE v_month <= (v_max_month + interval '1 month')::date LOOP
        PERFORM public.ensure_user_activity_partition(v_month);
        v_month := (v_month + interval '1 month')::date;
      END LOOP;
    END IF;
  END IF;
END;
$$;

SELECT public.maintain_user_activity_partitions(1, 6, NULL);

-- 5) Migrate existing rows from legacy table (if present).
DO $$
BEGIN
  IF to_regclass('public.user_activity_events_legacy') IS NOT NULL THEN
    INSERT INTO public.user_activity_events (
      id,
      created_at,
      ingested_at,
      actor_user_id,
      event_type,
      event_source,
      list_id,
      item_id,
      product_id,
      price_history_id,
      target_user_id,
      invite_link_id,
      old_data,
      new_data,
      metadata,
      event_version
    )
    SELECT
      id,
      created_at,
      created_at,
      actor_user_id,
      event_type,
      event_source,
      list_id,
      item_id,
      product_id,
      price_history_id,
      target_user_id,
      invite_link_id,
      old_data,
      new_data,
      metadata,
      1
    FROM public.user_activity_events_legacy
    ON CONFLICT (created_at, id) DO NOTHING;
  END IF;
END;
$$;

-- 6) Analytical indexes.
CREATE INDEX IF NOT EXISTS user_activity_events_created_at_idx
  ON public.user_activity_events (created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_event_type_created_at_idx
  ON public.user_activity_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_actor_created_at_idx
  ON public.user_activity_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_list_created_at_idx
  ON public.user_activity_events (list_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_product_created_at_idx
  ON public.user_activity_events (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_metadata_gin_idx
  ON public.user_activity_events USING gin (metadata);

-- 7) RLS policies tuned for real access paths.
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_activity_events_select ON public.user_activity_events;
CREATE POLICY user_activity_events_select
ON public.user_activity_events
FOR SELECT
TO authenticated
USING (
  actor_user_id = requesting_user_id()
  OR (list_id IS NOT NULL AND user_can_access_list(list_id))
  OR (product_id IS NOT NULL AND user_can_access_product(product_id))
);

DROP POLICY IF EXISTS project_admin_policy ON public.user_activity_events;
CREATE POLICY project_admin_policy
ON public.user_activity_events
FOR ALL
TO project_admin
USING (true)
WITH CHECK (true);

-- 7b) Partitions are internal implementation details.
-- Authenticated reads go through the parent so its RLS policy is always applied.
REVOKE ALL PRIVILEGES ON TABLE public.user_activity_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_activity_events TO authenticated;

DO $$
DECLARE
  v_partition record;
BEGIN
  FOR v_partition IN
    SELECT child.relname AS partition_name
    FROM pg_catalog.pg_inherits inheritance
    JOIN pg_catalog.pg_class parent ON parent.oid = inheritance.inhparent
    JOIN pg_catalog.pg_class child ON child.oid = inheritance.inhrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = child.relnamespace
    WHERE namespace.nspname = 'public'
      AND parent.relname = 'user_activity_events'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      v_partition.partition_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',
      v_partition.partition_name
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
      v_partition.partition_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS project_admin_policy ON public.%I',
      v_partition.partition_name
    );
    EXECUTE format(
      'CREATE POLICY project_admin_policy ON public.%I FOR ALL TO project_admin USING (true) WITH CHECK (true)',
      v_partition.partition_name
    );
  END LOOP;
END;
$$;

-- 8) Record function enriched with system metadata.
CREATE OR REPLACE FUNCTION public.record_user_activity(
  p_event_type text,
  p_list_id uuid DEFAULT NULL,
  p_item_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_price_history_id uuid DEFAULT NULL,
  p_target_user_id text DEFAULT NULL,
  p_invite_link_id uuid DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id text := requesting_user_id();
  v_metadata jsonb;
BEGIN
  IF p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RETURN;
  END IF;

  v_metadata := jsonb_strip_nulls(
    COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'audit_version', 2,
      'txid', txid_current(),
      'captured_at', now(),
      'actor_user_id', v_actor_user_id
    )
  );

  INSERT INTO public.user_activity_events (
    actor_user_id,
    event_type,
    event_source,
    list_id,
    item_id,
    product_id,
    price_history_id,
    target_user_id,
    invite_link_id,
    old_data,
    new_data,
    metadata,
    event_version
  )
  VALUES (
    v_actor_user_id,
    p_event_type,
    'db_trigger',
    p_list_id,
    p_item_id,
    p_product_id,
    p_price_history_id,
    p_target_user_id,
    p_invite_link_id,
    p_old_data,
    p_new_data,
    v_metadata,
    2
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_activity(text, uuid, uuid, uuid, uuid, text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC;

-- 9) Avoid noisy price history updates when price did not change.
CREATE OR REPLACE FUNCTION public.audit_price_history_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_user_activity(
      'price_history_added',
      NULL,
      NULL,
      NEW.product_id,
      NEW.id,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('price', NEW.price, 'created_at', NEW.created_at),
      '{}'::jsonb
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.price IS DISTINCT FROM OLD.price THEN
      PERFORM public.record_user_activity(
        'price_history_updated',
        NULL,
        NULL,
        NEW.product_id,
        NEW.id,
        NULL,
        NULL,
        jsonb_build_object('price', OLD.price),
        jsonb_build_object('price', NEW.price),
        '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.record_user_activity(
      'price_history_deleted',
      NULL,
      NULL,
      OLD.product_id,
      OLD.id,
      NULL,
      NULL,
      to_jsonb(OLD),
      NULL,
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 10) Enriched analytics view.
DROP VIEW IF EXISTS public.user_activity_events_enriched;
CREATE VIEW public.user_activity_events_enriched
WITH (security_invoker = true) AS
SELECT
  e.*,
  date_trunc('day', e.created_at) AS event_day,
  date_trunc('month', e.created_at) AS event_month,
  sl.name AS list_name,
  p.title AS product_title
FROM public.user_activity_events e
LEFT JOIN public.shopping_lists sl ON sl.id = e.list_id
LEFT JOIN public.products p ON p.id = e.product_id;

REVOKE ALL PRIVILEGES ON TABLE public.user_activity_events_enriched FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_activity_events_enriched TO authenticated;

-- 11) Monthly automatic partition maintenance (no data pruning by default).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE command = 'SELECT public.maintain_user_activity_partitions(1, 6, NULL);'
    ) THEN
      PERFORM cron.schedule(
        '0 3 1 * *',
        'SELECT public.maintain_user_activity_partitions(1, 6, NULL);'
      );
    END IF;
  END IF;
END;
$$;

-- 12) Drop legacy table once migrated.
DROP TABLE IF EXISTS public.user_activity_events_legacy;

NOTIFY pgrst, 'reload schema';

COMMIT;
