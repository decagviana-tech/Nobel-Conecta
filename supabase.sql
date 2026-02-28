
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
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
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

-- 8. Giveaway Participants table
CREATE TABLE public.giveaway_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID REFERENCES public.giveaways(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(giveaway_id, user_id)
);

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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can delete posts" ON public.posts FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR auth.uid() = user_id
);

CREATE POLICY "Book clubs are viewable by everyone" ON public.book_clubs FOR SELECT USING (true);
CREATE POLICY "Users can create book clubs" ON public.book_clubs FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "Admins and organizers can delete book clubs" ON public.book_clubs FOR DELETE USING (
  auth.uid() = admin_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

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
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

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

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 10. Rewards table
CREATE TABLE public.rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount', 'gift')),
  image_url TEXT,
  stock INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rewards are viewable by everyone" ON public.rewards FOR SELECT USING (true);
CREATE POLICY "Admins can manage rewards" ON public.rewards FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 11. Redemptions table
CREATE TABLE public.redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  redemption_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions" ON public.redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create redemptions" ON public.redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update redemptions" ON public.redemptions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Storage setup (Requires manual bucket creation: 'avatars', 'posts', 'rewards', 'giveaways')
-- You can run this in the SQL Editor to create buckets:
/*
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('posts', 'posts', true),
  ('rewards', 'rewards', true),
  ('giveaways', 'giveaways', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id IN ('avatars', 'posts', 'rewards', 'giveaways') );
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id IN ('avatars', 'posts', 'rewards', 'giveaways') AND auth.role() = 'authenticated' );
*/
