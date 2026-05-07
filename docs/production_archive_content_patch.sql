-- Nobel Conecta - Content archiving patch
-- Run this in Supabase SQL Editor.
-- Goal: hide user content without permanently deleting it, while keeping points consistent.

BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

ALTER TABLE public.creative_posts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

ALTER TABLE public.creative_comments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_archived_at ON public.posts(archived_at);
CREATE INDEX IF NOT EXISTS idx_comments_archived_at ON public.comments(archived_at);
CREATE INDEX IF NOT EXISTS idx_creative_posts_archived_at ON public.creative_posts(archived_at);
CREATE INDEX IF NOT EXISTS idx_creative_comments_archived_at ON public.creative_comments(archived_at);

CREATE OR REPLACE FUNCTION public.protect_archive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_archive_update', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
    OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
    OR NEW.archive_reason IS DISTINCT FROM OLD.archive_reason THEN
    RAISE EXCEPTION 'Use the archive/restore RPC for content visibility changes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_posts_archive_columns ON public.posts;
CREATE TRIGGER protect_posts_archive_columns
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.protect_archive_columns();

DROP TRIGGER IF EXISTS protect_comments_archive_columns ON public.comments;
CREATE TRIGGER protect_comments_archive_columns
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.protect_archive_columns();

DROP TRIGGER IF EXISTS protect_creative_posts_archive_columns ON public.creative_posts;
CREATE TRIGGER protect_creative_posts_archive_columns
BEFORE UPDATE ON public.creative_posts
FOR EACH ROW
EXECUTE FUNCTION public.protect_archive_columns();

DROP TRIGGER IF EXISTS protect_creative_comments_archive_columns ON public.creative_comments;
CREATE TRIGGER protect_creative_comments_archive_columns
BEFORE UPDATE ON public.creative_comments
FOR EACH ROW
EXECUTE FUNCTION public.protect_archive_columns();

CREATE OR REPLACE FUNCTION public.archive_post(p_post_id UUID, p_reason TEXT DEFAULT 'user_removed')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.posts%ROWTYPE;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_post
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.user_id <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only the author or an admin can archive this post';
  END IF;

  IF v_post.archived_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);

  UPDATE public.posts
  SET archived_at = NOW(),
      archived_by = v_actor,
      archive_reason = p_reason
  WHERE id = p_post_id
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(v_post.type, 'review') IN ('review', 'club_thought') THEN
    PERFORM public.apply_points_delta(v_post.user_id, -10, 'Pontos ajustados', 'Conteudo arquivado: -10 pontos.');
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_comment(p_comment_id UUID, p_reason TEXT DEFAULT 'user_removed')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.comments%ROWTYPE;
  v_post_owner UUID;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_comment
  FROM public.comments
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  SELECT user_id INTO v_post_owner
  FROM public.posts
  WHERE id = v_comment.post_id;

  IF v_comment.user_id <> v_actor AND v_post_owner <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only the comment author, post author, or an admin can archive this comment';
  END IF;

  IF v_comment.archived_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);

  UPDATE public.comments
  SET archived_at = NOW(),
      archived_by = v_actor,
      archive_reason = p_reason
  WHERE id = p_comment_id
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.apply_points_delta(v_comment.user_id, -2, 'Pontos ajustados', 'Comentario arquivado: -2 pontos.');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_creative_post(p_post_id UUID, p_reason TEXT DEFAULT 'user_removed')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.creative_posts%ROWTYPE;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_post
  FROM public.creative_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creative post not found';
  END IF;

  IF v_post.user_id <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only the author or an admin can archive this creative post';
  END IF;

  IF v_post.archived_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);

  UPDATE public.creative_posts
  SET archived_at = NOW(),
      archived_by = v_actor,
      archive_reason = p_reason
  WHERE id = p_post_id
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.apply_points_delta(v_post.user_id, -10, 'Pontos ajustados', 'Texto arquivado: -10 pontos.');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_creative_comment(p_comment_id UUID, p_reason TEXT DEFAULT 'user_removed')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.creative_comments%ROWTYPE;
  v_post_owner UUID;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_comment
  FROM public.creative_comments
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creative comment not found';
  END IF;

  SELECT user_id INTO v_post_owner
  FROM public.creative_posts
  WHERE id = v_comment.post_id;

  IF v_comment.user_id <> v_actor AND v_post_owner <> v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only the comment author, post author, or an admin can archive this creative comment';
  END IF;

  IF v_comment.archived_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);

  UPDATE public.creative_comments
  SET archived_at = NOW(),
      archived_by = v_actor,
      archive_reason = p_reason
  WHERE id = p_comment_id
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.apply_points_delta(v_comment.user_id, -2, 'Pontos ajustados', 'Comentario arquivado: -2 pontos.');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.posts%ROWTYPE;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only admins can restore archived posts';
  END IF;

  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;
  IF v_post.archived_at IS NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);
  UPDATE public.posts
  SET archived_at = NULL,
      archived_by = NULL,
      archive_reason = NULL
  WHERE id = p_post_id
    AND archived_at IS NOT NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(v_post.type, 'review') IN ('review', 'club_thought') THEN
    PERFORM public.apply_points_delta(v_post.user_id, 10, 'Pontos restaurados', 'Conteudo restaurado: +10 pontos.');
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.comments%ROWTYPE;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only admins can restore archived comments';
  END IF;

  SELECT * INTO v_comment FROM public.comments WHERE id = p_comment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF v_comment.archived_at IS NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);
  UPDATE public.comments
  SET archived_at = NULL,
      archived_by = NULL,
      archive_reason = NULL
  WHERE id = p_comment_id
    AND archived_at IS NOT NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.apply_points_delta(v_comment.user_id, 2, 'Pontos restaurados', 'Comentario restaurado: +2 pontos.');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_creative_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post public.creative_posts%ROWTYPE;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only admins can restore archived creative posts';
  END IF;

  SELECT * INTO v_post FROM public.creative_posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creative post not found';
  END IF;
  IF v_post.archived_at IS NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);
  UPDATE public.creative_posts
  SET archived_at = NULL,
      archived_by = NULL,
      archive_reason = NULL
  WHERE id = p_post_id
    AND archived_at IS NOT NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.apply_points_delta(v_post.user_id, 10, 'Pontos restaurados', 'Texto restaurado: +10 pontos.');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_creative_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.creative_comments%ROWTYPE;
  v_actor UUID := auth.uid();
  v_rows INTEGER;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'Only admins can restore archived creative comments';
  END IF;

  SELECT * INTO v_comment FROM public.creative_comments WHERE id = p_comment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creative comment not found';
  END IF;
  IF v_comment.archived_at IS NULL THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.allow_archive_update', 'on', true);
  UPDATE public.creative_comments
  SET archived_at = NULL,
      archived_by = NULL,
      archive_reason = NULL
  WHERE id = p_comment_id
    AND archived_at IS NOT NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN TRUE;
  END IF;

  PERFORM public.apply_points_delta(v_comment.user_id, 2, 'Pontos restaurados', 'Comentario restaurado: +2 pontos.');

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_post(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_comment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_creative_post(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_creative_comment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_post(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_comment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_creative_post(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_creative_comment(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.archive_post(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_creative_post(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_creative_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_comment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_creative_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_creative_comment(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
