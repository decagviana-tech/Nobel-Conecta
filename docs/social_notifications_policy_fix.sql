-- Nobel Conecta social notification policy fix
-- Apply after docs/social_notifications_patch.sql.
-- Keeps arbitrary spam blocked, but allows inserts when a real social action exists.

BEGIN;

DROP POLICY IF EXISTS "Admins and users can insert safe notifications" ON public.notifications;

CREATE POLICY "Admins and users can insert safe notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR (
    type = 'like'
    AND EXISTS (
      SELECT 1
      FROM public.likes l
      JOIN public.posts p ON p.id = l.post_id
      WHERE l.user_id = auth.uid()
        AND p.user_id = notifications.user_id
    )
  )
  OR (
    type = 'like'
    AND EXISTS (
      SELECT 1
      FROM public.creative_likes l
      JOIN public.creative_posts p ON p.id = l.post_id
      WHERE l.user_id = auth.uid()
        AND p.user_id = notifications.user_id
    )
  )
  OR (
    type = 'comment'
    AND EXISTS (
      SELECT 1
      FROM public.comments c
      JOIN public.posts p ON p.id = c.post_id
      WHERE c.user_id = auth.uid()
        AND p.user_id = notifications.user_id
    )
  )
  OR (
    type = 'comment'
    AND EXISTS (
      SELECT 1
      FROM public.creative_comments c
      JOIN public.creative_posts p ON p.id = c.post_id
      WHERE c.user_id = auth.uid()
        AND p.user_id = notifications.user_id
    )
  )
  OR (
    type = 'follow'
    AND EXISTS (
      SELECT 1
      FROM public.follows f
      WHERE f.follower_id = auth.uid()
        AND f.following_id = notifications.user_id
    )
  )
  OR (
    type = 'message'
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.sender_id = auth.uid()
        AND m.receiver_id = notifications.user_id
    )
  )
);

COMMIT;
