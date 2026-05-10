BEGIN;

WITH duplicate_pending_coupons AS (
  SELECT
    r.id,
    r.user_id,
    rew.points_required,
    row_number() OVER (
      PARTITION BY r.user_id, r.reward_id
      ORDER BY r.created_at DESC, r.id DESC
    ) AS row_number
  FROM public.redemptions r
  JOIN public.rewards rew ON rew.id = r.reward_id
  WHERE rew.type = 'discount'
    AND r.status = 'pending'
    AND r.redemption_code IS NOT NULL
),
cancelled AS (
  UPDATE public.redemptions r
  SET status = 'cancelled'
  FROM duplicate_pending_coupons d
  WHERE r.id = d.id
    AND d.row_number > 1
  RETURNING d.user_id, d.points_required
),
refunds AS (
  SELECT user_id, sum(points_required)::INTEGER AS points_to_refund
  FROM cancelled
  GROUP BY user_id
)
UPDATE public.profiles p
SET points = COALESCE(p.points, 0) + refunds.points_to_refund
FROM refunds
WHERE p.id = refunds.user_id;

COMMIT;
