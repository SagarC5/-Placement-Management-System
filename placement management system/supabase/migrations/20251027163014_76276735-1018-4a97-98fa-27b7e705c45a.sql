-- Add columns to profiles for storing parsed resume skills
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS resume_skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS resume_parsed_at TIMESTAMP WITH TIME ZONE;

-- Create job_recommendations table
CREATE TABLE IF NOT EXISTS public.job_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,
  job_source TEXT NOT NULL CHECK (job_source IN ('tpo', 'offcampus')),
  match_score NUMERIC NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  skill_match NUMERIC DEFAULT 0,
  test_performance NUMERIC DEFAULT 0,
  interview_performance NUMERIC DEFAULT 0,
  reasons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.job_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Students can view own recommendations"
ON public.job_recommendations
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "System can create recommendations"
ON public.job_recommendations
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "System can update recommendations"
ON public.job_recommendations
FOR UPDATE
USING (auth.uid() = student_id);

-- Create trigger for updated_at
CREATE TRIGGER update_job_recommendations_updated_at
BEFORE UPDATE ON public.job_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_recommendations_student_id ON public.job_recommendations(student_id);
CREATE INDEX IF NOT EXISTS idx_job_recommendations_match_score ON public.job_recommendations(match_score DESC);