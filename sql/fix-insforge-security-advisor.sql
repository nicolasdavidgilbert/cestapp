-- ============================================================
-- fix-insforge-security-advisor.sql
-- Corrige 29 issues críticos + 2 de rendimiento detectados por
-- InsForge Backend Advisor.
--
-- Uso (desde raíz del proyecto):
--   npx @insforge/cli db query -- "$(cat sql/fix-insforge-security-advisor.sql)"
-- ============================================================

-- ============================================================
-- BLOQUE 1: RLS, FORCE RLS y aislamiento de particiones
-- ============================================================
-- Las particiones no se exponen directamente a clientes. Las lecturas
-- autenticadas pasan por la tabla padre y su política RLS.

ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_events FORCE ROW LEVEL SECURITY;
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_partition.partition_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_partition.partition_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
      v_partition.partition_name
    );
    EXECUTE format('DROP POLICY IF EXISTS project_admin_policy ON public.%I', v_partition.partition_name);
    EXECUTE format(
      'CREATE POLICY project_admin_policy ON public.%I FOR ALL TO project_admin USING (true) WITH CHECK (true)',
      v_partition.partition_name
    );
  END LOOP;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE public.user_activity_events_enriched FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_activity_events_enriched TO authenticated;

-- ============================================================
-- BLOQUE 2: Revocar EXECUTE de funciones trigger (8)
-- ============================================================
-- Solo se ejecutan automáticamente vía trigger. Nadie debe
-- poder invocarlas directamente.

REVOKE ALL ON FUNCTION public.audit_shopping_list_items_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_shopping_list_items_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.audit_products_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_products_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.audit_price_history_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_price_history_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.audit_shopping_lists_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_shopping_lists_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.audit_list_shares_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_list_shares_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.audit_list_invite_links_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_list_invite_links_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_created_by_on_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_created_by_on_products() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_created_by_on_price_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_created_by_on_price_history() FROM authenticated;

-- ============================================================
-- BLOQUE 3: DDL functions → solo project_admin (2)
-- ============================================================
-- El cron job de mantenimiento de particiones ejecuta como
-- postgres (superuser), por lo que bypasea estos permisos.
-- project_admin queda como respaldo para ejecución manual.

REVOKE ALL ON FUNCTION public.ensure_user_activity_partition(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_user_activity_partition(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_activity_partition(date) TO project_admin;

REVOKE ALL ON FUNCTION public.maintain_user_activity_partitions(integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.maintain_user_activity_partitions(integer, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.maintain_user_activity_partitions(integer, integer, integer) TO project_admin;

-- ============================================================
-- BLOQUE 4: Business functions → solo authenticated (5)
-- ============================================================
-- El frontend solo llama a estas funciones cuando el usuario
-- está autenticado (JWT con rol authenticated).

REVOKE ALL ON FUNCTION public.accept_list_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_list_invite(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.share_list_with_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_list_with_email(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_product_for_list(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_product_for_list(uuid, text, text, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.list_visible_products(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_visible_products(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_share_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_share_members(uuid) TO authenticated;
