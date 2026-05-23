-- Nobel Conecta public launch hardening
-- Generated after live Supabase advisor review on 2026-05-23.
-- Scope: tighten exposed RPC/storage/log/redemption surfaces without deleting data.

BEGIN;

-- 1) Logs: keep client telemetry, but only for signed-in users and only for
-- their own user_id when present. This removes the public WITH CHECK (true).
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.app_logs;
DROP POLICY IF EXISTS "Authenticated users can insert own logs" ON public.app_logs;
CREATE POLICY "Authenticated users can insert own logs"
ON public.app_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2) Redemptions must be created by the redeem_reward RPC, so users cannot
-- create rows directly and bypass points/stock validation.
DROP POLICY IF EXISTS "Usuários podem resgatar" ON public.redemptions;
DROP POLICY IF EXISTS "Users can create redemptions" ON public.redemptions;

-- 3) Notifications should be created by RPCs/triggers or admins, not arbitrary
-- direct inserts from the browser.
DROP POLICY IF EXISTS "Inserir Notificações" ON public.notifications;
DROP POLICY IF EXISTS "Admins and users can insert safe notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- 4) Storage: remove legacy broad policies. Public buckets can still serve
-- public URLs, but these policies no longer allow arbitrary uploads, updates,
-- deletes, or object listing through the Storage API.
DROP POLICY IF EXISTS "storage_public_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_public_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_public_delete" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de perfil são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de posts são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Events" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for app buckets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários logados podem enviar fotos de perfil" ON storage.objects;
DROP POLICY IF EXISTS "Usuários logados podem enviar fotos de posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Events" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Events" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Events" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload managed media" ON storage.objects;

CREATE POLICY "Authenticated users can upload own media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can upload managed media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('rewards', 'giveaways', 'events')
  AND public.is_admin(auth.uid())
);

-- 5) RPC/function execute grants. Trigger/internal functions should not be
-- directly callable through /rest/v1/rpc.
REVOKE ALL ON FUNCTION public.apply_points_delta(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_comment_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_creative_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_giveaway_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_review_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_archive_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;

-- Frontend-facing RPCs remain available to signed-in users only. The functions
-- themselves still enforce owner/admin checks.
REVOKE ALL ON FUNCTION public.archive_comment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_comment(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_creative_comment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_creative_comment(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_creative_post(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_creative_post(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_post(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_post(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_book_club(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_book_club(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_creative_comment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_creative_comment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_creative_like(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_creative_like(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_follow(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_follow(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_message(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_post_comment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_post_comment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_post_like(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_post_like(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_reward(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(UUID, UUID, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.reopen_giveaway_round(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_giveaway_round(UUID, DATE) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_comment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_comment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_creative_comment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_creative_comment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_creative_post(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_creative_post(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_post(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_post(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.run_giveaway_raffle(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_giveaway_raffle(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.send_due_giveaway_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_due_giveaway_reminders() TO authenticated;

-- Keep is_admin callable because several existing RLS policies reference it
-- from public-role policies. Removing anon execute here can break anonymous
-- public reads until those policies are consolidated.
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated;

COMMIT;
