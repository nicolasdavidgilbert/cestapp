-- ============================================================
-- fix-secdefiner-searchpath.sql
-- Corrige 9 issues "Dangerous SECURITY DEFINER function" del
-- InsForge Backend Advisor.
--
-- Estrategia:
--   - Todas las funciones deben seguir siendo SECURITY DEFINER
--     (necesitan leer auth.users, bypassear RLS, y leer JWT
--     via requesting_user_id)
--   - Se cualifica schema de TODAS las referencias,
--     incluyendo requesting_user_id() → public.requesting_user_id()
--   - Se vacía el search_path para eliminar riesgo de hijacking
--     (pg_catalog se busca siempre, y todo lo demás está
--     cualificado)
--   - Se mantienen los GRANT actuales (public para helpers
--     RLS, authenticated para funciones de negocio)
-- ============================================================

-- Funciones afectadas:
--   RLS helpers (callable by public):
--     1. user_owns_list(uuid)
--     2. user_can_access_list(uuid)
--     3. user_can_access_product(uuid)
--     4. user_can_manage_product(uuid)
--   Business (callable by authenticated):
--     5. accept_list_invite(uuid)
--     6. create_product_for_list(uuid, text, text, numeric)
--     7. list_visible_products(uuid)
--     8. share_list_with_email(uuid, text)
--     9. list_share_members(uuid)

-- ============================================================
-- RLS HELPERS (callable by public)
-- ============================================================

-- 1) user_owns_list
CREATE OR REPLACE FUNCTION public.user_owns_list(target_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_lists sl
    WHERE sl.id = target_list_id
      AND sl.owner_id = public.requesting_user_id()
  );
$$;

-- 2) user_can_access_list
CREATE OR REPLACE FUNCTION public.user_can_access_list(target_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_lists sl
    WHERE sl.id = target_list_id
      AND (
        sl.owner_id = public.requesting_user_id()
        OR EXISTS (
          SELECT 1
          FROM public.list_shares ls
          WHERE ls.list_id = sl.id
            AND ls.user_id = public.requesting_user_id()
        )
      )
  );
$$;

-- 3) user_can_access_product
CREATE OR REPLACE FUNCTION public.user_can_access_product(target_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = target_product_id
      AND p.created_by = public.requesting_user_id()
  )
  OR EXISTS (
    SELECT 1
    FROM public.shopping_list_items sli
    JOIN public.shopping_lists sl ON sl.id = sli.list_id
    WHERE sli.product_id = target_product_id
      AND (
        sl.owner_id = public.requesting_user_id()
        OR EXISTS (
          SELECT 1
          FROM public.list_shares ls
          WHERE ls.list_id = sl.id
            AND ls.user_id = public.requesting_user_id()
        )
      )
  );
$$;

-- 4) user_can_manage_product
CREATE OR REPLACE FUNCTION public.user_can_manage_product(target_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = target_product_id
      AND p.created_by = public.requesting_user_id()
  );
$$;

-- ============================================================
-- BUSINESS FUNCTIONS (callable by authenticated)
-- ============================================================

-- 5) accept_list_invite
CREATE OR REPLACE FUNCTION public.accept_list_invite(invite_token uuid)
RETURNS TABLE (
  list_id uuid,
  list_name text,
  owner_id text,
  already_member boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id text;
  invite_list_id uuid;
  invite_list_name text;
  invite_owner_id text;
  inserted_share_id uuid;
BEGIN
  current_user_id := public.requesting_user_id();

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
  ON CONFLICT ON CONSTRAINT list_shares_list_id_user_id_key DO NOTHING
  RETURNING id INTO inserted_share_id;

  UPDATE public.list_invite_links
  SET last_used_at = now()
  WHERE token = invite_token;

  RETURN QUERY
  SELECT invite_list_id, invite_list_name, invite_owner_id, inserted_share_id IS NULL;
END;
$$;

-- 6) create_product_for_list
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
SET search_path = ''
AS $$
DECLARE
  current_user_id text;
  created_product_id uuid;
  normalized_title text;
BEGIN
  current_user_id := public.requesting_user_id();

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

-- 7) list_visible_products
CREATE OR REPLACE FUNCTION public.list_visible_products(target_list_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  current_price numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.title, p.current_price
  FROM public.shopping_list_items sli
  JOIN public.products p ON p.id = sli.product_id
  WHERE sli.list_id = target_list_id
    AND public.user_can_access_list(target_list_id)
  GROUP BY p.id, p.title, p.current_price
  ORDER BY p.title;
$$;

-- 8) share_list_with_email
CREATE OR REPLACE FUNCTION public.share_list_with_email(target_list_id uuid, target_email text)
RETURNS TABLE (
  shared_user_id text,
  shared_email text,
  already_shared boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id text;
  normalized_email text;
  found_user_id text;
  found_email text;
  inserted_share_id uuid;
BEGIN
  current_user_id := public.requesting_user_id();

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

-- 9) list_share_members
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
SET search_path = ''
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
