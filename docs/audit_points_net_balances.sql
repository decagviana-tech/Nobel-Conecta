-- Nobel Conecta net points audit
-- Read-only query. Compares current balance with earned points minus redemptions.

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
),
spent AS (
  SELECT
    r.user_id,
    COALESCE(SUM(rew.points_required), 0)::INTEGER AS spent_points
  FROM public.redemptions r
  JOIN public.rewards rew ON rew.id = r.reward_id
  WHERE r.status <> 'cancelled'
  GROUP BY r.user_id
),
expected AS (
  SELECT
    p.id AS user_id,
    e.earned_points,
    COALESCE(s.spent_points, 0) AS spent_points,
    GREATEST(0, e.earned_points - COALESCE(s.spent_points, 0)) AS expected_points
  FROM public.profiles p
  JOIN earned e ON e.user_id = p.id
  LEFT JOIN spent s ON s.user_id = p.id
)
SELECT
  p.username,
  p.full_name,
  COALESCE(p.points, 0) AS current_points,
  e.earned_points,
  e.spent_points,
  e.expected_points,
  e.expected_points - COALESCE(p.points, 0) AS difference
FROM public.profiles p
JOIN expected e ON e.user_id = p.id
WHERE e.expected_points <> COALESCE(p.points, 0)
ORDER BY ABS(e.expected_points - COALESCE(p.points, 0)) DESC, p.username;
