BEGIN;

DROP POLICY IF EXISTS "Admins and users can insert safe notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- User-triggered notifications should be created by SECURITY DEFINER RPCs/triggers,
-- not by arbitrary direct inserts from the browser.
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

COMMIT;
