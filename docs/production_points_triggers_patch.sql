-- Nobel Conecta points trigger repair patch
-- Apply in Supabase SQL Editor if real actions are saved but points/notifications do not update.
-- Idempotent: recreates point triggers and repairs @marciaviana once if her visible balance is below earned actions.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_points_delta(
  p_user_id UUID,
  p_amount INTEGER,
  p_title TEXT DEFAULT 'Pontos Nobel!',
  p_content TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_points INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET points = GREATEST(0, COALESCE(points, 0) + p_amount)
  WHERE id = p_user_id
  RETURNING points INTO v_new_points;

  IF p_amount > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, content, link, read)
    VALUES (
      p_user_id,
      'system',
      p_title,
      COALESCE(p_content, 'Voce ganhou +' || p_amount || ' pontos.'),
      '/rewards',
      false
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_points_delta(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.award_review_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.type, 'review') = 'review' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 10, 'Pontos Nobel!', 'Voce ganhou +10 pontos por sua resenha.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.type = 'club_thought' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 10, 'Pontos Nobel!', 'Voce ganhou +10 pontos por sua analise de clube.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND COALESCE(OLD.type, 'review') IN ('review', 'club_thought') THEN
    PERFORM public.apply_points_delta(OLD.user_id, -10);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_review_points_on_posts ON public.posts;
CREATE TRIGGER award_review_points_on_posts
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.award_review_points();

CREATE OR REPLACE FUNCTION public.award_creative_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 10, 'Pontos Nobel!', 'Voce ganhou +10 pontos por seu texto autoral.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_points_delta(OLD.user_id, -10);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_creative_points_on_posts ON public.creative_posts;
CREATE TRIGGER award_creative_points_on_posts
AFTER INSERT OR DELETE ON public.creative_posts
FOR EACH ROW
EXECUTE FUNCTION public.award_creative_points();

CREATE OR REPLACE FUNCTION public.award_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 2, 'Pontos Nobel!', 'Voce ganhou +2 pontos por comentar.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_points_delta(OLD.user_id, -2);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_comment_points_on_comments ON public.comments;
CREATE TRIGGER award_comment_points_on_comments
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.award_comment_points();

DROP TRIGGER IF EXISTS award_comment_points_on_creative_comments ON public.creative_comments;
CREATE TRIGGER award_comment_points_on_creative_comments
AFTER INSERT OR DELETE ON public.creative_comments
FOR EACH ROW
EXECUTE FUNCTION public.award_comment_points();

CREATE OR REPLACE FUNCTION public.award_giveaway_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_points_delta(NEW.user_id, 5, 'Pontos Nobel!', 'Voce ganhou +5 pontos por participar do sorteio.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_giveaway_points_on_participants ON public.giveaway_participants;
CREATE TRIGGER award_giveaway_points_on_participants
AFTER INSERT ON public.giveaway_participants
FOR EACH ROW
EXECUTE FUNCTION public.award_giveaway_points();

DO $$
DECLARE
  v_user_id UUID;
  v_current_points INTEGER;
  v_earned_points INTEGER;
  v_delta INTEGER;
BEGIN
  SELECT id, COALESCE(points, 0)
  INTO v_user_id, v_current_points
  FROM public.profiles
  WHERE username = 'marciaviana';

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE((SELECT COUNT(*) * 10 FROM public.posts WHERE user_id = v_user_id AND COALESCE(type, 'review') IN ('review', 'club_thought')), 0)
    + COALESCE((SELECT COUNT(*) * 10 FROM public.creative_posts WHERE user_id = v_user_id), 0)
    + COALESCE((SELECT COUNT(*) * 2 FROM public.comments WHERE user_id = v_user_id), 0)
    + COALESCE((SELECT COUNT(*) * 2 FROM public.creative_comments WHERE user_id = v_user_id), 0)
    + COALESCE((SELECT COUNT(*) * 5 FROM public.giveaway_participants WHERE user_id = v_user_id), 0)
  INTO v_earned_points;

  v_delta := GREATEST(0, v_earned_points - v_current_points);

  IF v_delta > 0 THEN
    PERFORM public.apply_points_delta(
      v_user_id,
      v_delta,
      'Pontos Nobel corrigidos!',
      'Corrigimos seu saldo pelos pontos das interacoes ja realizadas.'
    );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
