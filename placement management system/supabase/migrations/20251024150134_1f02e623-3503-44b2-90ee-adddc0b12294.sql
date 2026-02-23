-- Create enum types
CREATE TYPE app_role AS ENUM ('student', 'tpo', 'teacher');
CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'shortlisted', 'rejected', 'accepted');
CREATE TYPE material_type AS ENUM ('pdf', 'link', 'video');

-- User profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT,
  batch TEXT,
  phone TEXT,
  resume_path TEXT,
  skills TEXT[] DEFAULT '{}',
  temp_password_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- TPO jobs table
CREATE TABLE public.tpo_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  deadline TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.tpo_jobs(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ats_score NUMERIC(5,2),
  ats_details JSONB DEFAULT '{}',
  status application_status DEFAULT 'pending',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, student_id)
);

-- Off-campus jobs table
CREATE TABLE public.offcampus_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  role TEXT NOT NULL,
  apply_link TEXT,
  skills_required TEXT[] DEFAULT '{}',
  description TEXT,
  location TEXT,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock tests table
CREATE TABLE public.mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  duration_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mock test results table
CREATE TABLE public.mock_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_id UUID REFERENCES public.mock_tests(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(5,2),
  answers JSONB DEFAULT '{}',
  duration_sec INTEGER,
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat logs table
CREATE TABLE public.chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  source TEXT DEFAULT 'openai',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role,
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type material_type NOT NULL,
  file_path TEXT,
  company_id UUID,
  department TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interactive interviews table
CREATE TABLE public.interactive_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  history JSONB DEFAULT '[]',
  overall_feedback TEXT,
  final_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ATS scores history table
CREATE TABLE public.ats_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID,
  score NUMERIC(5,2),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpo_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offcampus_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactive_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ats_scores ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "TPO can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'tpo'));

-- TPO jobs policies
CREATE POLICY "Everyone can view jobs" ON public.tpo_jobs FOR SELECT USING (true);
CREATE POLICY "TPO can manage jobs" ON public.tpo_jobs FOR ALL USING (public.has_role(auth.uid(), 'tpo'));

-- Applications policies
CREATE POLICY "Students can view own applications" ON public.applications FOR SELECT 
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'tpo') OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can create applications" ON public.applications FOR INSERT 
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "TPO can update applications" ON public.applications FOR UPDATE 
  USING (public.has_role(auth.uid(), 'tpo'));

-- Off-campus jobs policies
CREATE POLICY "Everyone can view offcampus jobs" ON public.offcampus_jobs FOR SELECT USING (true);
CREATE POLICY "TPO can manage offcampus jobs" ON public.offcampus_jobs FOR ALL USING (public.has_role(auth.uid(), 'tpo'));

-- Mock tests policies
CREATE POLICY "Everyone can view mock tests" ON public.mock_tests FOR SELECT USING (true);
CREATE POLICY "TPO/Teacher can manage tests" ON public.mock_tests FOR ALL 
  USING (public.has_role(auth.uid(), 'tpo') OR public.has_role(auth.uid(), 'teacher'));

-- Mock results policies
CREATE POLICY "Students can view own results" ON public.mock_results FOR SELECT 
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can create results" ON public.mock_results FOR INSERT 
  WITH CHECK (auth.uid() = student_id);

-- Chat logs policies
CREATE POLICY "Students can view own chats" ON public.chat_logs FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can create chats" ON public.chat_logs FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Announcements policies
CREATE POLICY "Users can view relevant announcements" ON public.announcements FOR SELECT USING (
  role IS NULL OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND user_roles.role = announcements.role)
);
CREATE POLICY "TPO/Teacher can create announcements" ON public.announcements FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'tpo') OR public.has_role(auth.uid(), 'teacher'));

-- Materials policies
CREATE POLICY "Users can view materials" ON public.materials FOR SELECT USING (true);
CREATE POLICY "TPO/Teacher can manage materials" ON public.materials FOR ALL 
  USING (public.has_role(auth.uid(), 'tpo') OR public.has_role(auth.uid(), 'teacher'));

-- Interactive interviews policies
CREATE POLICY "Students can view own interviews" ON public.interactive_interviews FOR SELECT 
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can create interviews" ON public.interactive_interviews FOR INSERT 
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can update own interviews" ON public.interactive_interviews FOR UPDATE 
  USING (auth.uid() = student_id);

-- ATS scores policies
CREATE POLICY "Students can view own scores" ON public.ats_scores FOR SELECT 
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'tpo'));
CREATE POLICY "System can create scores" ON public.ats_scores FOR INSERT 
  WITH CHECK (auth.uid() = student_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tpo_jobs_updated_at BEFORE UPDATE ON public.tpo_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();