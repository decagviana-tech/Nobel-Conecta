-- Nobel Conecta production integrity patch
-- Apply this in Supabase SQL Editor after the previous security/social patches.
-- It is idempotent and does not delete application data.

BEGIN;

-- Direct point changes must not be callable by normal authenticated clients.
-- Points are awarded by the triggers below when the real action exists.
REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM authenticated;

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

  IF TG_OP = 'DELETE' AND COALESCE(OLD.type, 'review') = 'review' THEN
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

-- Redemptions must be created through public.redeem_reward so points and stock are atomic.
DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can create redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can view own redemptions and admins view all" ON public.redemptions;
DROP POLICY IF EXISTS "Admins can update redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Admins can create redemptions" ON public.redemptions;

CREATE POLICY "Users can view own redemptions and admins view all" ON public.redemptions
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can update redemptions" ON public.redemptions
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create redemptions" ON public.redemptions
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Match comment moderation policies to the UI: comment author, post owner, or admin.
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users admins and post owners can delete comments" ON public.comments;
CREATE POLICY "Users admins and post owners can delete comments" ON public.comments
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.creative_comments;
DROP POLICY IF EXISTS "Users admins and creative owners can delete comments" ON public.creative_comments;
CREATE POLICY "Users admins and creative owners can delete comments" ON public.creative_comments
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.creative_posts p
    WHERE p.id = creative_comments.post_id
      AND p.user_id = auth.uid()
  )
);

-- Messages need updates for "read" and sender edits, but receivers must not edit content.
CREATE OR REPLACE FUNCTION public.protect_message_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'message ownership fields cannot be changed';
  END IF;

  IF auth.uid() = OLD.sender_id THEN
    IF NEW.read IS DISTINCT FROM OLD.read THEN
      RAISE EXCEPTION 'message sender cannot change read status';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.receiver_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'message receiver cannot edit content';
    END IF;
    IF NEW.read IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'message receiver can only mark messages as read';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not allowed to update this message';
END;
$$;

DROP TRIGGER IF EXISTS protect_message_updates ON public.messages;
CREATE TRIGGER protect_message_updates
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_message_updates();

DROP POLICY IF EXISTS "Users can update their messages safely" ON public.messages;
CREATE POLICY "Users can update their messages safely" ON public.messages
FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

COMMIT;
