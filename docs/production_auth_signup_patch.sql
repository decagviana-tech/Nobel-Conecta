-- Nobel Conecta auth signup patch
-- Apply in Supabase SQL Editor if new signups fail with:
-- "Database error saving new user".

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_profile_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Supabase Auth creates profiles from an internal trigger without auth.uid().
    -- RLS still protects normal anonymous/client inserts.
    IF auth.uid() IS NULL THEN
      NEW.role := 'user';
      NEW.points := 0;
      RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'profiles can only be created by the current user or an admin';
    END IF;

    IF NOT public.is_admin(auth.uid()) THEN
      NEW.role := 'user';
      NEW.points := 0;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF auth.uid() = OLD.id AND NOT public.is_admin(auth.uid()) THEN
      IF NEW.role IS DISTINCT FROM OLD.role OR NEW.points IS DISTINCT FROM OLD.points THEN
        RAISE EXCEPTION 'role and points cannot be changed from the client';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  v_username := lower(regexp_replace(
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1),
      'leitor'
    ),
    '[^a-z0-9_]',
    '',
    'g'
  ));

  IF length(v_username) < 3 THEN
    v_username := 'leitor_' || substr(replace(NEW.id::TEXT, '-', ''), 1, 8);
  END IF;

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = v_username
      AND id <> NEW.id
  ) LOOP
    v_username := left(v_username, 12) || '_' || substr(replace(NEW.id::TEXT, '-', ''), 1, 6);
  END LOOP;

  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1),
    'Leitor Nobel'
  );

  INSERT INTO public.profiles (id, username, full_name, role, points)
  VALUES (NEW.id, v_username, v_full_name, 'user', 0)
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      full_name = EXCLUDED.full_name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';

COMMIT;
