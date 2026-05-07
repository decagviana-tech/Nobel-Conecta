-- Nobel Conecta production security patch
-- Apply this in Supabase SQL Editor after reviewing it against production.
-- It is idempotent and does not delete application data.

BEGIN;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'superadmin'));

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND role IN ('admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

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

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete any profile" ON public.profiles
FOR DELETE
USING (public.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.increment_points(UUID, INTEGER);

CREATE FUNCTION public.increment_points(user_id UUID, amount INTEGER)
RETURNS TABLE(points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'cannot change another user points';
  END IF;

  IF amount NOT IN (-10, -5, -2, 0, 2, 5, 10) THEN
    RAISE EXCEPTION 'invalid points amount';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  RETURN QUERY
  UPDATE public.profiles
  SET points = GREATEST(0, COALESCE(public.profiles.points, 0) + amount)
  WHERE id = user_id
  RETURNING public.profiles.points;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM PUBLIC;
-- Do not grant this function to authenticated clients.
-- docs/production_integrity_patch.sql moves production point awards to database triggers.
REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM authenticated;

DROP FUNCTION IF EXISTS public.redeem_reward(UUID, UUID, INTEGER, TEXT);

CREATE FUNCTION public.redeem_reward(
  p_reward_id UUID,
  p_user_id UUID,
  p_points_req INTEGER,
  p_redemption_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.rewards%ROWTYPE;
  v_profile_points INTEGER;
  v_redemption_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'users can only redeem rewards for themselves';
  END IF;

  SELECT *
  INTO v_reward
  FROM public.rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND OR NOT COALESCE(v_reward.is_active, false) THEN
    RAISE EXCEPTION 'reward is not available';
  END IF;

  IF v_reward.points_required IS DISTINCT FROM p_points_req THEN
    RAISE EXCEPTION 'reward points mismatch';
  END IF;

  IF v_reward.type IN ('gift', 'book') AND COALESCE(v_reward.stock, 0) <= 0 THEN
    RAISE EXCEPTION 'reward is out of stock';
  END IF;

  SELECT COALESCE(points, 0)
  INTO v_profile_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF v_profile_points < v_reward.points_required THEN
    RAISE EXCEPTION 'insufficient points';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET points = v_profile_points - v_reward.points_required
  WHERE id = p_user_id;

  IF v_reward.type IN ('gift', 'book') THEN
    UPDATE public.rewards
    SET stock = COALESCE(stock, 0) - 1
    WHERE id = p_reward_id;
  END IF;

  INSERT INTO public.redemptions (user_id, reward_id, status, redemption_code)
  VALUES (p_user_id, p_reward_id, 'pending', p_redemption_code)
  RETURNING id INTO v_redemption_id;

  RETURN v_redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, INTEGER, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins and users can insert safe notifications" ON public.notifications;

CREATE POLICY "Admins and users can insert safe notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

COMMIT;
