-- List sharing + realtime bootstrap for Cesta++
-- Run with InsForge CLI:
--   npx @insforge/cli db query -- "$(cat sql/list-sharing-realtime.sql)"

-- 0) Resolve caller id from JWT claims with safe fallbacks.
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  WITH claims AS (
    SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb AS jwt_claims
  )
  SELECT COALESCE(
    NULLIF(jwt_claims->>'user_id', ''),
    NULLIF(jwt_claims->>'userId', ''),
    NULLIF(jwt_claims->>'sub', ''),
    NULLIF(jwt_claims->>'uid', '')
  )::text
  FROM claims;
$$;

-- 1) Helper: check list ownership without recursive RLS evaluation.
CREATE OR REPLACE FUNCTION public.user_owns_list(target_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_lists sl
    WHERE sl.id = target_list_id
      AND sl.owner_id = requesting_user_id()
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_list(uuid) TO public;

-- 2) list_shares policies without circular dependency with shopping_lists.
DROP POLICY IF EXISTS list_shares_owner_manage ON list_shares;
DROP POLICY IF EXISTS list_shares_select ON list_shares;
DROP POLICY IF EXISTS list_shares_insert ON list_shares;
DROP POLICY IF EXISTS list_shares_delete ON list_shares;
DROP POLICY IF EXISTS list_shares_update ON list_shares;

CREATE POLICY list_shares_select
ON list_shares
FOR SELECT
TO public
USING (
  user_id = requesting_user_id()
  OR public.user_owns_list(list_id)
);

CREATE POLICY list_shares_insert
ON list_shares
FOR INSERT
TO public
WITH CHECK (
  user_id = requesting_user_id()
  OR public.user_owns_list(list_id)
);

CREATE POLICY list_shares_delete
ON list_shares
FOR DELETE
TO public
USING (
  user_id = requesting_user_id()
  OR public.user_owns_list(list_id)
);

CREATE POLICY list_shares_update
ON list_shares
FOR UPDATE
TO public
USING (
  public.user_owns_list(list_id)
)
WITH CHECK (
  public.user_owns_list(list_id)
);

-- 3) Let shared users read shopping_lists rows they are invited to.
DROP POLICY IF EXISTS shopping_lists_shared_select ON shopping_lists;
CREATE POLICY shopping_lists_shared_select
ON shopping_lists
FOR SELECT
TO public
USING (
  owner_id = requesting_user_id()
  OR EXISTS (
    SELECT 1
    FROM list_shares ls
    WHERE ls.list_id = shopping_lists.id
      AND ls.user_id = requesting_user_id()
  )
);

-- 4) Share links for inviting users via URL.
CREATE TABLE IF NOT EXISTS public.list_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  last_used_at timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS list_invite_links_token_key
  ON public.list_invite_links(token);
CREATE INDEX IF NOT EXISTS list_invite_links_list_id_idx
  ON public.list_invite_links(list_id);

ALTER TABLE public.list_invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_invite_links_select ON public.list_invite_links;
DROP POLICY IF EXISTS list_invite_links_insert ON public.list_invite_links;
DROP POLICY IF EXISTS list_invite_links_update ON public.list_invite_links;
DROP POLICY IF EXISTS list_invite_links_delete ON public.list_invite_links;

CREATE POLICY list_invite_links_select
ON public.list_invite_links
FOR SELECT
TO public
USING (
  public.user_owns_list(list_id)
);

CREATE POLICY list_invite_links_insert
ON public.list_invite_links
FOR INSERT
TO public
WITH CHECK (
  public.user_owns_list(list_id)
  AND created_by = requesting_user_id()
);

CREATE POLICY list_invite_links_update
ON public.list_invite_links
FOR UPDATE
TO public
USING (
  public.user_owns_list(list_id)
)
WITH CHECK (
  public.user_owns_list(list_id)
);

CREATE POLICY list_invite_links_delete
ON public.list_invite_links
FOR DELETE
TO public
USING (
  public.user_owns_list(list_id)
);

CREATE OR REPLACE FUNCTION public.accept_list_invite(invite_token uuid)
RETURNS TABLE (
  list_id uuid,
  list_name text,
  owner_id text,
  already_member boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id text;
  invite_list_id uuid;
  invite_list_name text;
  invite_owner_id text;
  inserted_share_id uuid;
BEGIN
  current_user_id := requesting_user_id();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para aceptar esta invitación';
  END IF;

  SELECT il.list_id, sl.name, sl.owner_id
    INTO invite_list_id, invite_list_name, invite_owner_id
  FROM public.list_invite_links il
  JOIN public.shopping_lists sl ON sl.id = il.list_id
  WHERE il.token = invite_token
    AND il.revoked_at IS NULL
    AND (il.expires_at IS NULL OR il.expires_at > now())
  LIMIT 1;

  IF invite_list_id IS NULL THEN
    RAISE EXCEPTION 'Enlace inválido o expirado';
  END IF;

  IF invite_owner_id = current_user_id THEN
    RETURN QUERY
    SELECT invite_list_id, invite_list_name, invite_owner_id, TRUE;
    RETURN;
  END IF;

  INSERT INTO public.list_shares (list_id, user_id)
  VALUES (invite_list_id, current_user_id)
  ON CONFLICT (list_id, user_id) DO NOTHING
  RETURNING id INTO inserted_share_id;

  UPDATE public.list_invite_links
  SET last_used_at = now()
  WHERE token = invite_token;

  RETURN QUERY
  SELECT invite_list_id, invite_list_name, invite_owner_id, inserted_share_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_list_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_list_invite(uuid) TO public;

CREATE OR REPLACE FUNCTION public.share_list_with_email(target_list_id uuid, target_email text)
RETURNS TABLE (
  shared_user_id text,
  shared_email text,
  already_shared boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id text;
  normalized_email text;
  found_user_id text;
  found_email text;
  inserted_share_id uuid;
BEGIN
  current_user_id := requesting_user_id();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para compartir esta lista';
  END IF;

  normalized_email := lower(trim(target_email));
  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Debes indicar un email válido';
  END IF;

  IF NOT public.user_owns_list(target_list_id) THEN
    RAISE EXCEPTION 'Solo el propietario puede compartir esta lista';
  END IF;

  SELECT u.id::text, u.email
    INTO found_user_id, found_email
  FROM auth.users u
  WHERE lower(u.email) = normalized_email
  LIMIT 1;

  IF found_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario registrado con ese email';
  END IF;

  IF found_user_id = current_user_id THEN
    RAISE EXCEPTION 'No necesitas compartir la lista contigo mismo';
  END IF;

  INSERT INTO public.list_shares (list_id, user_id)
  VALUES (target_list_id, found_user_id)
  ON CONFLICT (list_id, user_id) DO NOTHING
  RETURNING id INTO inserted_share_id;

  RETURN QUERY
  SELECT found_user_id, found_email, inserted_share_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.share_list_with_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_list_with_email(uuid, text) TO public;

CREATE OR REPLACE FUNCTION public.list_share_members(target_list_id uuid)
RETURNS TABLE (
  id uuid,
  list_id uuid,
  user_id text,
  shared_email text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    ls.id,
    ls.list_id,
    ls.user_id,
    u.email AS shared_email,
    u.profile->>'avatar_url' AS avatar_url
  FROM public.list_shares ls
  LEFT JOIN auth.users u ON u.id::text = ls.user_id
  WHERE ls.list_id = target_list_id
    AND public.user_owns_list(target_list_id)
  ORDER BY lower(u.email) NULLS LAST, ls.user_id;
$$;

REVOKE ALL ON FUNCTION public.list_share_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_share_members(uuid) TO public;

-- 5) Product visibility model:
--    - Global product catalog is private per owner.
--    - Shared lists can still expose product title/current_price for list rendering.
CREATE OR REPLACE FUNCTION public.user_can_access_list(target_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_lists sl
    WHERE sl.id = target_list_id
      AND (
        sl.owner_id = requesting_user_id()
        OR EXISTS (
          SELECT 1
          FROM public.list_shares ls
          WHERE ls.list_id = sl.id
            AND ls.user_id = requesting_user_id()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_list(uuid) TO public;

CREATE OR REPLACE FUNCTION public.list_visible_products(target_list_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  current_price numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.current_price
  FROM public.shopping_list_items sli
  JOIN public.products p ON p.id = sli.product_id
  WHERE sli.list_id = target_list_id
    AND public.user_can_access_list(target_list_id)
  GROUP BY p.id, p.title, p.current_price
  ORDER BY p.title;
$$;

REVOKE ALL ON FUNCTION public.list_visible_products(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_visible_products(uuid) TO public;

DROP FUNCTION IF EXISTS public.create_product_for_list(uuid, text, text, numeric);
CREATE OR REPLACE FUNCTION public.create_product_for_list(
  target_list_id uuid,
  product_title text,
  product_description text DEFAULT NULL,
  product_price numeric DEFAULT NULL
)
RETURNS TABLE (
  created_id uuid,
  title text,
  current_price numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id text;
  created_product_id uuid;
  normalized_title text;
BEGIN
  current_user_id := requesting_user_id();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para añadir productos';
  END IF;

  IF NOT public.user_can_access_list(target_list_id) THEN
    RAISE EXCEPTION 'No tienes permisos para añadir productos en esta lista';
  END IF;

  normalized_title := trim(product_title);
  IF normalized_title IS NULL OR normalized_title = '' THEN
    RAISE EXCEPTION 'El nombre del producto es obligatorio';
  END IF;

  INSERT INTO public.products (title, description, current_price, created_by)
  VALUES (normalized_title, NULLIF(trim(coalesce(product_description, '')), ''), product_price, current_user_id)
  RETURNING id INTO created_product_id;

  IF product_price IS NOT NULL THEN
    INSERT INTO public.price_history (product_id, price, created_by)
    VALUES (created_product_id, product_price, current_user_id);
  END IF;

  INSERT INTO public.shopping_list_items (list_id, product_id, quantity)
  VALUES (target_list_id, created_product_id, 1)
  ON CONFLICT (list_id, product_id)
  DO UPDATE SET quantity = public.shopping_list_items.quantity + 1;

  RETURN QUERY
  SELECT p.id, p.title, p.current_price
  FROM public.products p
  WHERE p.id = created_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_for_list(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_product_for_list(uuid, text, text, numeric) TO public;

CREATE OR REPLACE FUNCTION public.user_can_manage_product(target_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = target_product_id
      AND p.created_by = requesting_user_id()
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_manage_product(uuid) TO public;

DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;

CREATE POLICY products_select
ON public.products
FOR SELECT
TO public
USING (
  created_by = requesting_user_id()
);

CREATE POLICY products_insert
ON public.products
FOR INSERT
TO public
WITH CHECK (
  requesting_user_id() IS NOT NULL
  AND NULLIF(trim(created_by), '') IS NOT NULL
  AND created_by = requesting_user_id()
);

CREATE POLICY products_update
ON public.products
FOR UPDATE
TO public
USING (
  created_by = requesting_user_id()
)
WITH CHECK (
  created_by = requesting_user_id()
);

DROP POLICY IF EXISTS price_history_select ON public.price_history;
DROP POLICY IF EXISTS price_history_insert ON public.price_history;
DROP POLICY IF EXISTS price_history_update ON public.price_history;
DROP POLICY IF EXISTS price_history_delete ON public.price_history;

CREATE POLICY price_history_select
ON public.price_history
FOR SELECT
TO public
USING (
  public.user_can_manage_product(product_id)
);

CREATE POLICY price_history_insert
ON public.price_history
FOR INSERT
TO public
WITH CHECK (
  requesting_user_id() IS NOT NULL
  AND NULLIF(trim(created_by), '') IS NOT NULL
  AND public.user_can_manage_product(product_id)
  AND created_by = requesting_user_id()
);

CREATE POLICY price_history_update
ON public.price_history
FOR UPDATE
TO public
USING (
  public.user_can_manage_product(product_id)
)
WITH CHECK (
  public.user_can_manage_product(product_id)
);

CREATE POLICY price_history_delete
ON public.price_history
FOR DELETE
TO public
USING (
  public.user_can_manage_product(product_id)
);

ALTER TABLE public.products
  ALTER COLUMN created_by SET DEFAULT requesting_user_id(),
  ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE public.price_history
  ALTER COLUMN created_by SET DEFAULT requesting_user_id(),
  ALTER COLUMN created_by SET NOT NULL;

-- 6) Realtime channel patterns used by frontend.
UPDATE realtime.channels
SET enabled = TRUE,
    description = 'Realtime updates for list collaboration'
WHERE pattern = 'list:%';

INSERT INTO realtime.channels (pattern, description, enabled)
SELECT 'list:%', 'Realtime updates for list collaboration', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM realtime.channels WHERE pattern = 'list:%'
);

UPDATE realtime.channels
SET enabled = TRUE,
    description = 'Realtime updates for dashboard list visibility'
WHERE pattern = 'user:%:lists';

INSERT INTO realtime.channels (pattern, description, enabled)
SELECT 'user:%:lists', 'Realtime updates for dashboard list visibility', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM realtime.channels WHERE pattern = 'user:%:lists'
);

-- 7) Full activity tracking for advanced analytics.
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
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
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS user_activity_events_created_at_idx
  ON public.user_activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_events_actor_user_id_idx
  ON public.user_activity_events(actor_user_id);
CREATE INDEX IF NOT EXISTS user_activity_events_list_id_idx
  ON public.user_activity_events(list_id);
CREATE INDEX IF NOT EXISTS user_activity_events_product_id_idx
  ON public.user_activity_events(product_id);
CREATE INDEX IF NOT EXISTS user_activity_events_event_type_idx
  ON public.user_activity_events(event_type);

ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_activity_events_select ON public.user_activity_events;
CREATE POLICY user_activity_events_select
ON public.user_activity_events
FOR SELECT
TO public
USING (
  actor_user_id = requesting_user_id()
  OR (
    list_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.shopping_lists sl
      WHERE sl.id = user_activity_events.list_id
        AND sl.owner_id = requesting_user_id()
    )
  )
);

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
BEGIN
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
    metadata
  )
  VALUES (
    requesting_user_id(),
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
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_activity(text, uuid, uuid, uuid, uuid, text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.audit_shopping_list_items_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_user_activity(
      'list_item_added',
      NEW.list_id,
      NEW.id,
      NEW.product_id,
      NULL,
      NULL,
      NULL,
      NULL,
      to_jsonb(NEW),
      jsonb_build_object('quantity', NEW.quantity, 'checked', NEW.checked)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.checked IS DISTINCT FROM OLD.checked THEN
      PERFORM public.record_user_activity(
        CASE WHEN NEW.checked THEN 'list_item_checked' ELSE 'list_item_unchecked' END,
        NEW.list_id,
        NEW.id,
        NEW.product_id,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('checked', OLD.checked),
        jsonb_build_object('checked', NEW.checked),
        '{}'::jsonb
      );
    END IF;

    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      PERFORM public.record_user_activity(
        'list_item_quantity_changed',
        NEW.list_id,
        NEW.id,
        NEW.product_id,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('quantity', OLD.quantity),
        jsonb_build_object('quantity', NEW.quantity),
        jsonb_build_object('delta', NEW.quantity - OLD.quantity)
      );
    END IF;

    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      PERFORM public.record_user_activity(
        'list_item_product_changed',
        NEW.list_id,
        NEW.id,
        NEW.product_id,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('product_id', OLD.product_id),
        jsonb_build_object('product_id', NEW.product_id),
        '{}'::jsonb
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.record_user_activity(
      'list_item_removed',
      OLD.list_id,
      OLD.id,
      OLD.product_id,
      NULL,
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

CREATE OR REPLACE FUNCTION public.audit_products_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_user_activity(
      'product_created',
      NULL,
      NULL,
      NEW.id,
      NULL,
      NULL,
      NULL,
      NULL,
      jsonb_build_object(
        'title', NEW.title,
        'description', NEW.description,
        'current_price', NEW.current_price
      ),
      '{}'::jsonb
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description THEN
      PERFORM public.record_user_activity(
        'product_details_updated',
        NULL,
        NULL,
        NEW.id,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('title', OLD.title, 'description', OLD.description),
        jsonb_build_object('title', NEW.title, 'description', NEW.description),
        '{}'::jsonb
      );
    END IF;

    IF NEW.current_price IS DISTINCT FROM OLD.current_price THEN
      PERFORM public.record_user_activity(
        'product_price_updated',
        NULL,
        NULL,
        NEW.id,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('current_price', OLD.current_price),
        jsonb_build_object('current_price', NEW.current_price),
        '{}'::jsonb
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.record_user_activity(
      'product_deleted',
      NULL,
      NULL,
      OLD.id,
      NULL,
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

CREATE OR REPLACE FUNCTION public.audit_shopping_lists_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_user_activity(
      'list_created',
      NEW.id,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('name', NEW.name, 'owner_id', NEW.owner_id),
      '{}'::jsonb
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.record_user_activity(
        'list_renamed',
        NEW.id,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('name', OLD.name),
        jsonb_build_object('name', NEW.name),
        '{}'::jsonb
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.record_user_activity(
      'list_deleted',
      OLD.id,
      NULL,
      NULL,
      NULL,
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

CREATE OR REPLACE FUNCTION public.audit_list_shares_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_user_activity(
      'list_shared',
      NEW.list_id,
      NULL,
      NULL,
      NULL,
      NEW.user_id,
      NULL,
      NULL,
      jsonb_build_object('shared_user_id', NEW.user_id),
      '{}'::jsonb
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.record_user_activity(
      'list_unshared',
      OLD.list_id,
      NULL,
      NULL,
      NULL,
      OLD.user_id,
      NULL,
      jsonb_build_object('shared_user_id', OLD.user_id),
      NULL,
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_list_invite_links_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.record_user_activity(
      'invite_link_created',
      NEW.list_id,
      NULL,
      NULL,
      NULL,
      NULL,
      NEW.id,
      NULL,
      jsonb_build_object('expires_at', NEW.expires_at),
      '{}'::jsonb
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at AND NEW.revoked_at IS NOT NULL THEN
      PERFORM public.record_user_activity(
        'invite_link_revoked',
        NEW.list_id,
        NULL,
        NULL,
        NULL,
        NULL,
        NEW.id,
        jsonb_build_object('revoked_at', OLD.revoked_at),
        jsonb_build_object('revoked_at', NEW.revoked_at),
        '{}'::jsonb
      );
    END IF;

    IF NEW.last_used_at IS DISTINCT FROM OLD.last_used_at AND NEW.last_used_at IS NOT NULL THEN
      PERFORM public.record_user_activity(
        'invite_link_used',
        NEW.list_id,
        NULL,
        NULL,
        NULL,
        NULL,
        NEW.id,
        jsonb_build_object('last_used_at', OLD.last_used_at),
        jsonb_build_object('last_used_at', NEW.last_used_at),
        '{}'::jsonb
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.record_user_activity(
      'invite_link_deleted',
      OLD.list_id,
      NULL,
      NULL,
      NULL,
      NULL,
      OLD.id,
      to_jsonb(OLD),
      NULL,
      '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_shopping_list_items_changes ON public.shopping_list_items;
CREATE TRIGGER trg_audit_shopping_list_items_changes
AFTER INSERT OR UPDATE OR DELETE ON public.shopping_list_items
FOR EACH ROW
EXECUTE FUNCTION public.audit_shopping_list_items_changes();

DROP TRIGGER IF EXISTS trg_audit_products_changes ON public.products;
CREATE TRIGGER trg_audit_products_changes
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.audit_products_changes();

DROP TRIGGER IF EXISTS trg_audit_price_history_changes ON public.price_history;
CREATE TRIGGER trg_audit_price_history_changes
AFTER INSERT OR UPDATE OR DELETE ON public.price_history
FOR EACH ROW
EXECUTE FUNCTION public.audit_price_history_changes();

DROP TRIGGER IF EXISTS trg_audit_shopping_lists_changes ON public.shopping_lists;
CREATE TRIGGER trg_audit_shopping_lists_changes
AFTER INSERT OR UPDATE OR DELETE ON public.shopping_lists
FOR EACH ROW
EXECUTE FUNCTION public.audit_shopping_lists_changes();

DROP TRIGGER IF EXISTS trg_audit_list_shares_changes ON public.list_shares;
CREATE TRIGGER trg_audit_list_shares_changes
AFTER INSERT OR DELETE ON public.list_shares
FOR EACH ROW
EXECUTE FUNCTION public.audit_list_shares_changes();

DROP TRIGGER IF EXISTS trg_audit_list_invite_links_changes ON public.list_invite_links;
CREATE TRIGGER trg_audit_list_invite_links_changes
AFTER INSERT OR UPDATE OR DELETE ON public.list_invite_links
FOR EACH ROW
EXECUTE FUNCTION public.audit_list_invite_links_changes();

CREATE OR REPLACE VIEW public.user_activity_events_enriched
WITH (security_invoker = true) AS
SELECT
  e.*,
  sl.name AS list_name,
  p.title AS product_title
FROM public.user_activity_events e
LEFT JOIN public.shopping_lists sl ON sl.id = e.list_id
LEFT JOIN public.products p ON p.id = e.product_id;

NOTIFY pgrst, 'reload schema';
