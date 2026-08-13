-- SEC-06: distributed rate limiting for the application-owned auth gateway.
--
-- This migration intentionally does not seed the shared secret. Configure a
-- different high-entropy AUTH_RATE_LIMIT_SECRET for each environment and store
-- only its SHA-256 digest in app_security.auth_rate_limit_config.

CREATE SCHEMA IF NOT EXISTS app_security;

REVOKE ALL ON SCHEMA app_security FROM PUBLIC;
REVOKE ALL ON SCHEMA app_security FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS app_security.auth_rate_limit_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret_hash bytea NOT NULL CHECK (octet_length(secret_hash) = 32),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS app_security.auth_rate_limits (
  scope text NOT NULL CHECK (scope ~ '^[a-z0-9-]{1,64}$'),
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_updated_at_idx
  ON app_security.auth_rate_limits (updated_at);

ALTER TABLE app_security.auth_rate_limit_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_security.auth_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app_security.auth_rate_limit_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app_security.auth_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_auth_rate_limit(
  p_secret text,
  p_scope text,
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_base_block_seconds integer DEFAULT 30,
  p_max_block_seconds integer DEFAULT 3600
)
RETURNS TABLE (
  allowed boolean,
  retry_after integer,
  remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  rate_now timestamptz := clock_timestamp();
  rate_row app_security.auth_rate_limits%ROWTYPE;
  next_count integer;
  block_seconds integer;
  window_ends_at timestamptz;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 32 OR NOT EXISTS (
    SELECT 1
    FROM app_security.auth_rate_limit_config config
    WHERE config.singleton = true
      AND config.secret_hash = public.digest(p_secret, 'sha256')
  ) THEN
    RAISE EXCEPTION 'Invalid rate-limit credentials' USING ERRCODE = '42501';
  END IF;

  IF p_scope IS NULL OR p_scope !~ '^[a-z0-9-]{1,64}$'
     OR p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
     OR p_action NOT IN ('check', 'consume', 'failure', 'success')
     OR p_limit NOT BETWEEN 1 AND 1000
     OR p_window_seconds NOT BETWEEN 1 AND 86400
     OR p_base_block_seconds NOT BETWEEN 1 AND 86400
     OR p_max_block_seconds NOT BETWEEN p_base_block_seconds AND 604800 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters' USING ERRCODE = '22023';
  END IF;

  -- Keep the limiter table bounded without adding a separate privileged job.
  -- Cleanup is deliberately sampled so normal authentication requests stay cheap.
  IF random() < 0.01 THEN
    DELETE FROM app_security.auth_rate_limits
    WHERE updated_at < rate_now - make_interval(days => 7);
  END IF;

  IF p_action = 'success' THEN
    DELETE FROM app_security.auth_rate_limits
    WHERE scope = p_scope AND key_hash = p_key_hash;

    RETURN QUERY SELECT true, 0, p_limit;
    RETURN;
  END IF;

  INSERT INTO app_security.auth_rate_limits (scope, key_hash)
  VALUES (p_scope, p_key_hash)
  ON CONFLICT (scope, key_hash) DO NOTHING;

  SELECT limits.*
  INTO rate_row
  FROM app_security.auth_rate_limits limits
  WHERE limits.scope = p_scope AND limits.key_hash = p_key_hash
  FOR UPDATE;

  IF rate_row.window_started_at <= rate_now - make_interval(secs => p_window_seconds) THEN
    rate_row.attempt_count := 0;
    rate_row.window_started_at := rate_now;
    rate_row.blocked_until := NULL;
  END IF;

  IF rate_row.blocked_until IS NOT NULL AND rate_row.blocked_until > rate_now THEN
    RETURN QUERY SELECT
      false,
      greatest(1, ceil(extract(epoch FROM rate_row.blocked_until - rate_now))::integer),
      0;
    RETURN;
  END IF;

  IF p_action = 'check' THEN
    UPDATE app_security.auth_rate_limits
    SET attempt_count = rate_row.attempt_count,
        window_started_at = rate_row.window_started_at,
        blocked_until = NULL,
        updated_at = rate_now
    WHERE scope = p_scope AND key_hash = p_key_hash;

    RETURN QUERY SELECT true, 0, greatest(0, p_limit - rate_row.attempt_count);
    RETURN;
  END IF;

  IF p_action = 'consume' THEN
    IF rate_row.attempt_count >= p_limit THEN
      window_ends_at := rate_row.window_started_at + make_interval(secs => p_window_seconds);

      UPDATE app_security.auth_rate_limits
      SET blocked_until = window_ends_at,
          updated_at = rate_now
      WHERE scope = p_scope AND key_hash = p_key_hash;

      RETURN QUERY SELECT
        false,
        greatest(1, ceil(extract(epoch FROM window_ends_at - rate_now))::integer),
        0;
      RETURN;
    END IF;

    next_count := rate_row.attempt_count + 1;

    UPDATE app_security.auth_rate_limits
    SET attempt_count = next_count,
        window_started_at = rate_row.window_started_at,
        blocked_until = NULL,
        updated_at = rate_now
    WHERE scope = p_scope AND key_hash = p_key_hash;

    RETURN QUERY SELECT true, 0, greatest(0, p_limit - next_count);
    RETURN;
  END IF;

  next_count := rate_row.attempt_count + 1;

  IF next_count >= p_limit THEN
    block_seconds := least(
      p_max_block_seconds,
      p_base_block_seconds * (2 ^ least(next_count - p_limit, 10))::integer
    );

    UPDATE app_security.auth_rate_limits
    SET attempt_count = next_count,
        window_started_at = rate_row.window_started_at,
        blocked_until = rate_now + make_interval(secs => block_seconds),
        updated_at = rate_now
    WHERE scope = p_scope AND key_hash = p_key_hash;

    RETURN QUERY SELECT false, block_seconds, 0;
    RETURN;
  END IF;

  UPDATE app_security.auth_rate_limits
  SET attempt_count = next_count,
      window_started_at = rate_row.window_started_at,
      blocked_until = NULL,
      updated_at = rate_now
  WHERE scope = p_scope AND key_hash = p_key_hash;

  RETURN QUERY SELECT true, 0, greatest(0, p_limit - next_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_auth_rate_limit(
  text, text, text, text, integer, integer, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.enforce_auth_rate_limit(
  text, text, text, text, integer, integer, integer, integer
) TO anon, authenticated;

COMMENT ON FUNCTION public.enforce_auth_rate_limit(
  text, text, text, text, integer, integer, integer, integer
) IS 'SEC-06: server-authenticated distributed limiter using only HMAC-pseudonymized client keys.';
