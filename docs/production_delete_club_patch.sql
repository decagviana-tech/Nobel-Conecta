-- Nobel Conecta explicit club deletion patch
-- Apply in Supabase SQL Editor before deploying the matching app code.
-- Deletes a club only when the current user is an admin or the club founder.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_book_club(p_club_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT admin_id
  INTO v_admin_id
  FROM public.book_clubs
  WHERE id = p_club_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'club not found';
  END IF;

  IF v_admin_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'only the club founder or an admin can delete this club';
  END IF;

  UPDATE public.posts
  SET club_id = NULL
  WHERE club_id = p_club_id;

  DELETE FROM public.book_clubs
  WHERE id = p_club_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_book_club(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_book_club(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
