-- Nobel Conecta clubs and events production patch
-- Apply after docs/production_integrity_patch.sql.
-- It is idempotent and does not delete application data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members are viewable by everyone" ON public.club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON public.club_members;

CREATE POLICY "Club members are viewable by everyone" ON public.club_members
FOR SELECT
USING (true);

CREATE POLICY "Users can join clubs" ON public.club_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave clubs" ON public.club_members
FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins and organizers can update book clubs" ON public.book_clubs;
CREATE POLICY "Admins and organizers can update book clubs" ON public.book_clubs
FOR UPDATE
USING (auth.uid() = admin_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = admin_id OR public.is_admin(auth.uid()));

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

CREATE TABLE IF NOT EXISTS public.events (
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

CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_comments (
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

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Event participants are viewable by everyone" ON public.event_participants;
DROP POLICY IF EXISTS "Users can join events" ON public.event_participants;
DROP POLICY IF EXISTS "Users can leave events" ON public.event_participants;
DROP POLICY IF EXISTS "Event likes are viewable by everyone" ON public.event_likes;
DROP POLICY IF EXISTS "Users can like events" ON public.event_likes;
DROP POLICY IF EXISTS "Users can unlike events" ON public.event_likes;
DROP POLICY IF EXISTS "Event comments are viewable by everyone" ON public.event_comments;
DROP POLICY IF EXISTS "Users can comment on events" ON public.event_comments;
DROP POLICY IF EXISTS "Users admins can delete event comments" ON public.event_comments;

CREATE POLICY "Events are viewable by everyone" ON public.events
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage events" ON public.events
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Event participants are viewable by everyone" ON public.event_participants
FOR SELECT
USING (true);

CREATE POLICY "Users can join events" ON public.event_participants
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave events" ON public.event_participants
FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Event likes are viewable by everyone" ON public.event_likes
FOR SELECT
USING (true);

CREATE POLICY "Users can like events" ON public.event_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike events" ON public.event_likes
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Event comments are viewable by everyone" ON public.event_comments
FOR SELECT
USING (true);

CREATE POLICY "Users can comment on events" ON public.event_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users admins can delete event comments" ON public.event_comments
FOR DELETE
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

COMMIT;
