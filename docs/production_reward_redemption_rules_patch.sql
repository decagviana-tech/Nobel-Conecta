BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS redemptions_redemption_code_unique
ON public.redemptions (redemption_code)
WHERE redemption_code IS NOT NULL;

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
  v_redemption_code TEXT;
  v_month_start TIMESTAMP WITH TIME ZONE;
  v_next_month_start TIMESTAMP WITH TIME ZONE;
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

  IF v_reward.type IN ('gift', 'book') THEN
    v_month_start := date_trunc('month', timezone('America/Sao_Paulo', now())) AT TIME ZONE 'America/Sao_Paulo';
    v_next_month_start := v_month_start + INTERVAL '1 month';

    IF EXISTS (
      SELECT 1
      FROM public.redemptions r
      JOIN public.rewards rew ON rew.id = r.reward_id
      WHERE r.user_id = p_user_id
        AND rew.type IN ('gift', 'book')
        AND r.status IN ('pending', 'completed')
        AND r.created_at >= v_month_start
        AND r.created_at < v_next_month_start
    ) THEN
      RAISE EXCEPTION 'monthly physical reward limit reached';
    END IF;
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

  IF v_reward.type = 'discount' THEN
    LOOP
      v_redemption_code := 'NOBEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.redemptions
        WHERE redemption_code = v_redemption_code
      );
    END LOOP;
  ELSE
    v_redemption_code := NULL;
  END IF;

  INSERT INTO public.redemptions (user_id, reward_id, status, redemption_code)
  VALUES (p_user_id, p_reward_id, 'pending', v_redemption_code)
  RETURNING id INTO v_redemption_id;

  RETURN v_redemption_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, INTEGER, TEXT) TO authenticated;

COMMIT;
