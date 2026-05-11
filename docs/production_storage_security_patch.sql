BEGIN;

-- Keep public read access for public app assets.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for app buckets" ON storage.objects;
CREATE POLICY "Public read access for app buckets"
ON storage.objects
FOR SELECT
USING (bucket_id IN ('avatars', 'posts', 'rewards', 'giveaways', 'events'));

-- Replace the broad "any authenticated user can upload anywhere" policy.
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload managed media" ON storage.objects;

-- User media must live under a folder named with auth.uid().
CREATE POLICY "Authenticated users can upload own media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Managed/public campaign assets are admin-only.
CREATE POLICY "Admins can upload managed media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('rewards', 'giveaways', 'events')
  AND public.is_admin(auth.uid())
);

COMMIT;
