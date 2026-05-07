
-- SQL for Nobel Conecta Database Setup

-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  favorite_genres TEXT[] DEFAULT '{}',
  reading_now TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Posts table
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  book_title TEXT NOT NULL,
  book_author TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  images TEXT[] DEFAULT '{}',
  type TEXT DEFAULT 'review',
  title TEXT,
  club_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Likes table
CREATE TABLE public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts (id) ON DELETE CASCADE NOT NULL,
  UNIQUE(user_id, post_id)
);

-- 4. Comments table
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts (id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Book Clubs table
CREATE TABLE public.book_clubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  current_book TEXT NOT NULL,
  current_book_author TEXT NOT NULL,
  image_url TEXT NOT NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  member_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Messages table
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Giveaways table
CREATE TABLE public.giveaways (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  book_image_url TEXT NOT NULL,
  end_date DATE NOT NULL,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Giveaways are viewable by everyone" ON public.giveaways FOR SELECT USING (true);
CREATE POLICY "Admins can manage giveaways" ON public.giveaways FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- 8. Giveaway Participants table
CREATE TABLE public.giveaway_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID REFERENCES public.giveaways(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(giveaway_id, user_id)
);

ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Giveaway participation is viewable by everyone" ON public.giveaway_participants FOR SELECT USING (true);
CREATE POLICY "Users can participate in giveaways" ON public.giveaway_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. Notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for other tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for other tables
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete posts" ON public.posts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')) OR auth.uid() = user_id
);

CREATE POLICY "Book clubs are viewable by everyone" ON public.book_clubs FOR SELECT USING (true);
CREATE POLICY "Users can create book clubs" ON public.book_clubs FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "Admins and organizers can update book clubs" ON public.book_clubs FOR UPDATE USING (
  auth.uid() = admin_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
)
WITH CHECK (
  auth.uid() = admin_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "Admins and organizers can delete book clubs" ON public.book_clubs FOR DELETE USING (
  auth.uid() = admin_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE TABLE public.club_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members are viewable by everyone" ON public.club_members FOR SELECT USING (true);
CREATE POLICY "Users can join clubs" ON public.club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave clubs" ON public.club_members FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins and users can insert safe notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 10. Creative Space (Mural)
CREATE TABLE public.creative_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'poem',
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.creative_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.creative_posts (id) ON DELETE CASCADE NOT NULL,
  UNIQUE(user_id, post_id)
);

CREATE TABLE public.creative_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.creative_posts (id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Creative Space
ALTER TABLE public.creative_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creative posts are viewable by everyone" ON public.creative_posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own creative posts" ON public.creative_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own creative posts" ON public.creative_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins or owners can delete creative posts" ON public.creative_posts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')) OR auth.uid() = user_id
);

CREATE POLICY "Creative likes are viewable by everyone" ON public.creative_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own creative likes" ON public.creative_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own creative likes" ON public.creative_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Creative comments are viewable by everyone" ON public.creative_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own creative comments" ON public.creative_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own creative comments" ON public.creative_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own creative comments" ON public.creative_comments FOR DELETE USING (auth.uid() = user_id);

-- 11. Follows table
CREATE TABLE public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- 12. Rewards table
CREATE TABLE public.rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount', 'gift', 'book')),
  genre TEXT,
  image_url TEXT,
  stock INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rewards are viewable by everyone" ON public.rewards FOR SELECT USING (true);
CREATE POLICY "Admins can manage rewards" ON public.rewards FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- 11. Redemptions table
CREATE TABLE public.redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  redemption_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Shop Books table
CREATE TABLE public.shop_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  price TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions" ON public.redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create redemptions" ON public.redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update redemptions" ON public.redemptions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE POLICY "Shop books are viewable by everyone" ON public.shop_books FOR SELECT USING (true);
CREATE POLICY "Admins can manage shop books" ON public.shop_books FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  type TEXT DEFAULT 'upcoming' CHECK (type IN ('upcoming', 'past')),
  max_participants INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE public.event_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE public.event_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Event participants are viewable by everyone" ON public.event_participants FOR SELECT USING (true);
CREATE POLICY "Users can join events" ON public.event_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave events" ON public.event_participants FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE POLICY "Event likes are viewable by everyone" ON public.event_likes FOR SELECT USING (true);
CREATE POLICY "Users can like events" ON public.event_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike events" ON public.event_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Event comments are viewable by everyone" ON public.event_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment on events" ON public.event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users admins can delete event comments" ON public.event_comments FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Storage setup (Requires manual bucket creation: 'avatars', 'posts', 'rewards', 'giveaways')
-- You can run this in the SQL Editor to create buckets:
/*
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('posts', 'posts', true),
  ('rewards', 'rewards', true),
  ('giveaways', 'giveaways', true),
  ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id IN ('avatars', 'posts', 'rewards', 'giveaways', 'events') );
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id IN ('avatars', 'posts', 'rewards', 'giveaways', 'events') AND auth.role() = 'authenticated' );
*/

-- Cleanup script for common placeholder avatars
-- Run this if you want to clear the "woman photo" from existing profiles
/*
UPDATE public.profiles 
SET avatar_url = NULL 
WHERE avatar_url ILIKE '%1494790108377%' 
   OR avatar_url ILIKE '%1535713875002%' 
   OR avatar_url ILIKE '%1438761681033%';
*/

-- Production security hardening
-- For existing production databases, prefer running docs/production_security_patch.sql.
-- This block keeps new database setups aligned with the production patch.

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND role IN ('admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_profile_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'profiles can only be created by the current user or an admin';
    END IF;

    IF NOT public.is_admin(auth.uid()) THEN
      NEW.role := 'user';
      NEW.points := 0;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF auth.uid() = OLD.id AND NOT public.is_admin(auth.uid()) THEN
      IF NEW.role IS DISTINCT FROM OLD.role OR NEW.points IS DISTINCT FROM OLD.points THEN
        RAISE EXCEPTION 'role and points cannot be changed from the client';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_sensitive_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

DROP FUNCTION IF EXISTS public.increment_points(UUID, INTEGER);

CREATE FUNCTION public.increment_points(user_id UUID, amount INTEGER)
RETURNS TABLE(points INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'cannot change another user points';
  END IF;

  IF amount NOT IN (-10, -5, -2, 0, 2, 5, 10) THEN
    RAISE EXCEPTION 'invalid points amount';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  RETURN QUERY
  UPDATE public.profiles
  SET points = GREATEST(0, COALESCE(public.profiles.points, 0) + amount)
  WHERE id = user_id
  RETURNING public.profiles.points;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_points(UUID, INTEGER) FROM authenticated;

DROP FUNCTION IF EXISTS public.redeem_reward(UUID, UUID, INTEGER, TEXT);

CREATE FUNCTION public.redeem_reward(
  p_reward_id UUID,
  p_user_id UUID,
  p_points_req INTEGER,
  p_redemption_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.rewards%ROWTYPE;
  v_profile_points INTEGER;
  v_redemption_id UUID;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'users can only redeem rewards for themselves';
  END IF;

  SELECT *
  INTO v_reward
  FROM public.rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND OR NOT COALESCE(v_reward.is_active, false) THEN
    RAISE EXCEPTION 'reward is not available';
  END IF;

  IF v_reward.points_required IS DISTINCT FROM p_points_req THEN
    RAISE EXCEPTION 'reward points mismatch';
  END IF;

  IF v_reward.type IN ('gift', 'book') AND COALESCE(v_reward.stock, 0) <= 0 THEN
    RAISE EXCEPTION 'reward is out of stock';
  END IF;

  SELECT COALESCE(points, 0)
  INTO v_profile_points
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF v_profile_points < v_reward.points_required THEN
    RAISE EXCEPTION 'insufficient points';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET points = v_profile_points - v_reward.points_required
  WHERE id = p_user_id;

  IF v_reward.type IN ('gift', 'book') THEN
    UPDATE public.rewards
    SET stock = COALESCE(stock, 0) - 1
    WHERE id = p_reward_id;
  END IF;

  INSERT INTO public.redemptions (user_id, reward_id, status, redemption_code)
  VALUES (p_user_id, p_reward_id, 'pending', p_redemption_code)
  RETURNING id INTO v_redemption_id;

  RETURN v_redemption_id;
END;
$$;

-- Production integrity hardening
-- Points are awarded by database triggers tied to real actions instead of client-side RPC calls.

CREATE OR REPLACE FUNCTION public.apply_points_delta(
  p_user_id UUID,
  p_amount INTEGER,
  p_title TEXT DEFAULT 'Pontos Nobel!',
  p_content TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_points INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.profiles
  SET points = GREATEST(0, COALESCE(points, 0) + p_amount)
  WHERE id = p_user_id
  RETURNING points INTO v_new_points;

  IF p_amount > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, content, link, read)
    VALUES (
      p_user_id,
      'system',
      p_title,
      COALESCE(p_content, 'Voce ganhou +' || p_amount || ' pontos.'),
      '/rewards',
      false
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_points_delta(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.award_review_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.type, 'review') = 'review' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 10, 'Pontos Nobel!', 'Voce ganhou +10 pontos por sua resenha.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.type = 'club_thought' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 10, 'Pontos Nobel!', 'Voce ganhou +10 pontos por sua analise de clube.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND COALESCE(OLD.type, 'review') IN ('review', 'club_thought') THEN
    PERFORM public.apply_points_delta(OLD.user_id, -10);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_review_points_on_posts ON public.posts;
CREATE TRIGGER award_review_points_on_posts
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.award_review_points();

CREATE OR REPLACE FUNCTION public.award_creative_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 10, 'Pontos Nobel!', 'Voce ganhou +10 pontos por seu texto autoral.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_points_delta(OLD.user_id, -10);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_creative_points_on_posts ON public.creative_posts;
CREATE TRIGGER award_creative_points_on_posts
AFTER INSERT OR DELETE ON public.creative_posts
FOR EACH ROW
EXECUTE FUNCTION public.award_creative_points();

CREATE OR REPLACE FUNCTION public.award_comment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_points_delta(NEW.user_id, 2, 'Pontos Nobel!', 'Voce ganhou +2 pontos por comentar.');
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_points_delta(OLD.user_id, -2);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_comment_points_on_comments ON public.comments;
CREATE TRIGGER award_comment_points_on_comments
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.award_comment_points();

DROP TRIGGER IF EXISTS award_comment_points_on_creative_comments ON public.creative_comments;
CREATE TRIGGER award_comment_points_on_creative_comments
AFTER INSERT OR DELETE ON public.creative_comments
FOR EACH ROW
EXECUTE FUNCTION public.award_comment_points();

CREATE OR REPLACE FUNCTION public.award_giveaway_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_points_delta(NEW.user_id, 5, 'Pontos Nobel!', 'Voce ganhou +5 pontos por participar do sorteio.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_giveaway_points_on_participants ON public.giveaway_participants;
CREATE TRIGGER award_giveaway_points_on_participants
AFTER INSERT ON public.giveaway_participants
FOR EACH ROW
EXECUTE FUNCTION public.award_giveaway_points();

DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can create redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Admins can view all redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can view own redemptions and admins view all" ON public.redemptions;
DROP POLICY IF EXISTS "Admins can update redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Admins can create redemptions" ON public.redemptions;

CREATE POLICY "Users can view own redemptions and admins view all" ON public.redemptions
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can update redemptions" ON public.redemptions
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create redemptions" ON public.redemptions
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users admins and post owners can delete comments" ON public.comments;
CREATE POLICY "Users admins and post owners can delete comments" ON public.comments
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.creative_comments;
DROP POLICY IF EXISTS "Users admins and creative owners can delete comments" ON public.creative_comments;
CREATE POLICY "Users admins and creative owners can delete comments" ON public.creative_comments
FOR DELETE
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.creative_posts p
    WHERE p.id = creative_comments.post_id
      AND p.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.protect_message_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'message ownership fields cannot be changed';
  END IF;

  IF auth.uid() = OLD.sender_id THEN
    IF NEW.read IS DISTINCT FROM OLD.read THEN
      RAISE EXCEPTION 'message sender cannot change read status';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.receiver_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'message receiver cannot edit content';
    END IF;
    IF NEW.read IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'message receiver can only mark messages as read';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not allowed to update this message';
END;
$$;

DROP TRIGGER IF EXISTS protect_message_updates ON public.messages;
CREATE TRIGGER protect_message_updates
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.protect_message_updates();

DROP POLICY IF EXISTS "Users can update their messages safely" ON public.messages;
CREATE POLICY "Users can update their messages safely" ON public.messages
FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);
