-- Nobel Conecta - Supabase usage audit
-- Safe/read-only queries for Supabase SQL Editor.

-- 1) Overall database size. Free plan database limit is 500 MB.
SELECT
  pg_size_pretty(pg_database_size(current_database())) AS database_size,
  ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) AS database_mb,
  ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0) / 500.0 * 100, 2) AS percent_of_free_database_limit;

-- 2) Largest database tables and indexes.
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  ROUND(pg_total_relation_size(relid) / 1024.0 / 1024.0, 2) AS total_mb,
  pg_size_pretty(pg_relation_size(relid)) AS table_only_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS indexes_and_toast_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 25;

-- 3) Row counts for app tables.
SELECT 'profiles' AS table_name, COUNT(*) AS rows FROM public.profiles
UNION ALL SELECT 'posts', COUNT(*) FROM public.posts
UNION ALL SELECT 'comments', COUNT(*) FROM public.comments
UNION ALL SELECT 'likes', COUNT(*) FROM public.likes
UNION ALL SELECT 'creative_posts', COUNT(*) FROM public.creative_posts
UNION ALL SELECT 'creative_comments', COUNT(*) FROM public.creative_comments
UNION ALL SELECT 'creative_likes', COUNT(*) FROM public.creative_likes
UNION ALL SELECT 'book_clubs', COUNT(*) FROM public.book_clubs
UNION ALL SELECT 'club_members', COUNT(*) FROM public.club_members
UNION ALL SELECT 'giveaways', COUNT(*) FROM public.giveaways
UNION ALL SELECT 'giveaway_participants', COUNT(*) FROM public.giveaway_participants
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL SELECT 'messages', COUNT(*) FROM public.messages
UNION ALL SELECT 'rewards', COUNT(*) FROM public.rewards
UNION ALL SELECT 'redemptions', COUNT(*) FROM public.redemptions
ORDER BY rows DESC;

-- 4) Archived content counts. Archived rows still use a tiny amount of database space.
SELECT
  'posts' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) AS archived_rows
FROM public.posts
UNION ALL
SELECT
  'comments',
  COUNT(*),
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL)
FROM public.comments
UNION ALL
SELECT
  'creative_posts',
  COUNT(*),
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL)
FROM public.creative_posts
UNION ALL
SELECT
  'creative_comments',
  COUNT(*),
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL)
FROM public.creative_comments;

-- 5) Storage usage by bucket. Free plan Storage limit is 1 GB.
-- Supabase stores file size in storage.objects.metadata->>'size'.
SELECT
  bucket_id,
  COUNT(*) AS file_count,
  pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint), 0)) AS storage_size,
  ROUND(COALESCE(SUM((metadata->>'size')::bigint), 0) / 1024.0 / 1024.0, 2) AS storage_mb,
  ROUND(COALESCE(SUM((metadata->>'size')::bigint), 0) / 1024.0 / 1024.0 / 1024.0 * 100, 2) AS percent_of_free_storage_limit
FROM storage.objects
GROUP BY bucket_id
ORDER BY COALESCE(SUM((metadata->>'size')::bigint), 0) DESC;

-- 6) Largest stored files. Useful for finding uncompressed uploads.
SELECT
  bucket_id,
  name,
  pg_size_pretty(COALESCE((metadata->>'size')::bigint, 0)) AS file_size,
  ROUND(COALESCE((metadata->>'size')::bigint, 0) / 1024.0 / 1024.0, 2) AS file_mb,
  created_at,
  updated_at
FROM storage.objects
ORDER BY COALESCE((metadata->>'size')::bigint, 0) DESC
LIMIT 30;

-- 7) Recent uploads. Helpful to spot tests or accidental large files.
SELECT
  bucket_id,
  name,
  pg_size_pretty(COALESCE((metadata->>'size')::bigint, 0)) AS file_size,
  created_at
FROM storage.objects
ORDER BY created_at DESC
LIMIT 30;
