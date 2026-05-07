-- Nobel Conecta social notifications patch
-- Apply after docs/production_security_patch.sql.
-- These RPCs validate that the social action exists before creating a notification.

BEGIN;

DROP FUNCTION IF EXISTS public.notify_post_like(UUID);
CREATE FUNCTION public.notify_post_like(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_actor_username TEXT;
  v_book_title TEXT;
BEGIN
  SELECT p.user_id, actor.username, p.book_title
  INTO v_recipient, v_actor_username, v_book_title
  FROM public.likes l
  JOIN public.posts p ON p.id = l.post_id
  JOIN public.profiles actor ON actor.id = l.user_id
  WHERE l.post_id = p_post_id
    AND l.user_id = auth.uid();

  IF NOT FOUND OR v_recipient = auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    v_recipient,
    'like',
    'Nova curtida!',
    '@' || v_actor_username || ' curtiu sua resenha de "' || COALESCE(v_book_title, 'um livro') || '".',
    '/?search=' || COALESCE(v_book_title, ''),
    FALSE
  );

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.notify_post_comment(UUID);
CREATE FUNCTION public.notify_post_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_actor_username TEXT;
  v_book_title TEXT;
  v_comment TEXT;
BEGIN
  SELECT p.user_id, actor.username, p.book_title, c.content
  INTO v_recipient, v_actor_username, v_book_title, v_comment
  FROM public.comments c
  JOIN public.posts p ON p.id = c.post_id
  JOIN public.profiles actor ON actor.id = c.user_id
  WHERE c.id = p_comment_id
    AND c.user_id = auth.uid();

  IF NOT FOUND OR v_recipient = auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    v_recipient,
    'comment',
    'Novo comentario!',
    '@' || v_actor_username || ' comentou na sua resenha: "' || LEFT(COALESCE(v_comment, ''), 80) || '".',
    '/?search=' || COALESCE(v_book_title, ''),
    FALSE
  );

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.notify_creative_like(UUID);
CREATE FUNCTION public.notify_creative_like(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_actor_username TEXT;
  v_title TEXT;
BEGIN
  SELECT p.user_id, actor.username, p.title
  INTO v_recipient, v_actor_username, v_title
  FROM public.creative_likes l
  JOIN public.creative_posts p ON p.id = l.post_id
  JOIN public.profiles actor ON actor.id = l.user_id
  WHERE l.post_id = p_post_id
    AND l.user_id = auth.uid();

  IF NOT FOUND OR v_recipient = auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    v_recipient,
    'like',
    'Nova curtida!',
    '@' || v_actor_username || ' curtiu seu texto: "' || COALESCE(v_title, 'Sem titulo') || '".',
    '/creative',
    FALSE
  );

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.notify_creative_comment(UUID);
CREATE FUNCTION public.notify_creative_comment(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_actor_username TEXT;
  v_comment TEXT;
BEGIN
  SELECT p.user_id, actor.username, c.content
  INTO v_recipient, v_actor_username, v_comment
  FROM public.creative_comments c
  JOIN public.creative_posts p ON p.id = c.post_id
  JOIN public.profiles actor ON actor.id = c.user_id
  WHERE c.id = p_comment_id
    AND c.user_id = auth.uid();

  IF NOT FOUND OR v_recipient = auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    v_recipient,
    'comment',
    'Novo comentario!',
    '@' || v_actor_username || ' comentou no seu texto: "' || LEFT(COALESCE(v_comment, ''), 80) || '".',
    '/creative',
    FALSE
  );

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.notify_follow(UUID);
CREATE FUNCTION public.notify_follow(p_following_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_username TEXT;
BEGIN
  SELECT actor.username
  INTO v_actor_username
  FROM public.follows f
  JOIN public.profiles actor ON actor.id = f.follower_id
  WHERE f.follower_id = auth.uid()
    AND f.following_id = p_following_id;

  IF NOT FOUND OR p_following_id = auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    p_following_id,
    'follow',
    'Voce tem um novo seguidor!',
    '@' || v_actor_username || ' comecou a te seguir.',
    '/profile/' || auth.uid(),
    FALSE
  );

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.notify_message(UUID);
CREATE FUNCTION public.notify_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_actor_username TEXT;
  v_content TEXT;
BEGIN
  SELECT m.receiver_id, actor.username, m.content
  INTO v_recipient, v_actor_username, v_content
  FROM public.messages m
  JOIN public.profiles actor ON actor.id = m.sender_id
  WHERE m.id = p_message_id
    AND m.sender_id = auth.uid();

  IF NOT FOUND OR v_recipient = auth.uid() THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, read)
  VALUES (
    v_recipient,
    'message',
    'Nova mensagem!',
    '@' || v_actor_username || ' te enviou uma mensagem: "' || LEFT(COALESCE(v_content, ''), 80) || '".',
    '/messages/' || auth.uid(),
    FALSE
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_post_like(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_post_comment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_creative_like(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_creative_comment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_follow(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_message(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.notify_post_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_post_comment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_creative_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_creative_comment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_follow(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_message(UUID) TO authenticated;

COMMIT;
