-- Nobel Conecta raffle integrity patch
-- Apply in Supabase SQL Editor before deploying the matching app code.
-- Guarantees a giveaway can be drawn only once, notifies the winner atomically,
-- lets admins create a new round from an ended giveaway, and sends due-date reminders.

BEGIN;

CREATE OR REPLACE FUNCTION public.run_giveaway_raffle(p_giveaway_id UUID)
RETURNS TABLE (
  winner_id UUID,
  winner_username TEXT,
  winner_full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giveaway public.giveaways%ROWTYPE;
  v_winner_id UUID;
  v_winner_username TEXT;
  v_winner_full_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'only admins can run giveaways';
  END IF;

  SELECT *
  INTO v_giveaway
  FROM public.giveaways
  WHERE id = p_giveaway_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway not found';
  END IF;

  IF v_giveaway.winner_id IS NOT NULL THEN
    RAISE EXCEPTION 'giveaway already has a winner';
  END IF;

  SELECT gp.user_id, p.username, p.full_name
  INTO v_winner_id, v_winner_username, v_winner_full_name
  FROM public.giveaway_participants gp
  JOIN public.profiles p ON p.id = gp.user_id
  WHERE gp.giveaway_id = p_giveaway_id
  ORDER BY random()
  LIMIT 1;

  IF v_winner_id IS NULL THEN
    RAISE EXCEPTION 'giveaway has no participants';
  END IF;

  UPDATE public.giveaways
  SET winner_id = v_winner_id,
      is_active = false
  WHERE id = p_giveaway_id;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    v_winner_id,
    'giveaway',
    'Voce ganhou o sorteio!',
    'Parabens! Voce foi sorteado(a). Entre em contato com a Nobel Petropolis para retirar seu premio.',
    '/giveaways',
    false
  );

  winner_id := v_winner_id;
  winner_username := v_winner_username;
  winner_full_name := v_winner_full_name;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.run_giveaway_raffle(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_giveaway_raffle(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_giveaway_round(
  p_giveaway_id UUID,
  p_end_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original public.giveaways%ROWTYPE;
  v_new_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'only admins can reopen giveaways';
  END IF;

  SELECT *
  INTO v_original
  FROM public.giveaways
  WHERE id = p_giveaway_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'giveaway not found';
  END IF;

  INSERT INTO public.giveaways (
    title,
    description,
    book_image_url,
    end_date,
    is_active
  )
  VALUES (
    v_original.title,
    v_original.description,
    v_original.book_image_url,
    p_end_date,
    true
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  SELECT
    p.id,
    'giveaway',
    'Sorteio Nobel reaberto!',
    'Uma nova rodada do sorteio "' || v_original.title || '" foi aberta. Participe pelo aplicativo.',
    '/giveaways',
    false
  FROM public.profiles p;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_giveaway_round(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_giveaway_round(UUID, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_due_giveaway_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  WITH due_giveaways AS (
    SELECT id, title, end_date
    FROM public.giveaways
    WHERE is_active = true
      AND winner_id IS NULL
      AND end_date = CURRENT_DATE
  ),
  recipients AS (
    SELECT
      p.id AS user_id,
      g.id AS giveaway_id,
      g.title,
      'Sorteio termina hoje'::TEXT AS notification_title,
      'Hoje e o ultimo dia do sorteio "' || g.title || '". Hora de conferir os participantes.' AS notification_content
    FROM due_giveaways g
    JOIN public.profiles p ON p.role IN ('admin', 'superadmin')

    UNION

    SELECT
      gp.user_id,
      g.id AS giveaway_id,
      g.title,
      'Sorteio Nobel termina hoje'::TEXT AS notification_title,
      'O sorteio "' || g.title || '" termina hoje. Boa sorte!' AS notification_content
    FROM due_giveaways g
    JOIN public.giveaway_participants gp ON gp.giveaway_id = g.id
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, content, link, read)
    SELECT
      r.user_id,
      'giveaway',
      r.notification_title,
      r.notification_content,
      '/giveaways',
      false
    FROM recipients r
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = r.user_id
        AND n.type = 'giveaway'
        AND n.title = r.notification_title
        AND n.content = r.notification_content
        AND n.link = '/giveaways'
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_count FROM inserted;

  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_due_giveaway_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_due_giveaway_reminders() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
