-- Extend announcements table for full announcement module
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';

-- Create announcement_recipients table
CREATE TABLE IF NOT EXISTS public.announcement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(announcement_id, student_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcement_recipients
CREATE POLICY "TPO can manage recipients"
ON public.announcement_recipients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tpo'::app_role));

CREATE POLICY "Students can view own recipient status"
ON public.announcement_recipients
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update announcements policies
DROP POLICY IF EXISTS "TPO/Teacher can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Users can view relevant announcements" ON public.announcements;

CREATE POLICY "TPO can manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tpo'::app_role));

CREATE POLICY "Everyone can view announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (true);