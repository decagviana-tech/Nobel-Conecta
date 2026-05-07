-- Nobel Conecta points audit
-- Read-only query. Run in Supabase SQL Editor to compare current balances
-- with points earned from existing actions.

WITH earned AS (
  SELECT
    p.id AS user_id,
    COALESCE((
      SELECT COUNT(*) * 10
      FROM public.posts post
      WHERE post.user_id = p.id
        AND COALESCE(post.type, 'review') IN ('review', 'club_thought')
    ), 0)
    + COALESCE((
      SELECT COUNT(*) * 10
      FROM public.creative_posts cp
      WHERE cp.user_id = p.id
    ), 0)
    + COALESCE((
      SELECT COUNT(*) * 2
      FROM public.comments c
      WHERE c.user_id = p.id
    ), 0)
    + COALESCE((
      SELECT COUNT(*) * 2
      FROM public.creative_comments cc
      WHERE cc.user_id = p.id
    ), 0)
    + COALESCE((
      SELECT COUNT(*) * 5
      FROM public.giveaway_participants gp
      WHERE gp.user_id = p.id
    ), 0) AS earned_points
  FROM public.profiles p
)
SELECT
  p.username,
  p.full_name,
  COALESCE(p.points, 0) AS current_points,
  e.earned_points,
  e.earned_points - COALESCE(p.points, 0) AS difference
FROM public.profiles p
JOIN earned e ON e.user_id = p.id
WHERE e.earned_points <> COALESCE(p.points, 0)
ORDER BY ABS(e.earned_points - COALESCE(p.points, 0)) DESC, p.username;
