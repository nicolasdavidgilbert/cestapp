-- Expose shared member emails to list owners without granting direct auth.users access.
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
