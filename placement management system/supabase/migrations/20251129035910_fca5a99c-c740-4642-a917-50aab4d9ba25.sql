-- Create feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('interview_experience', 'company_feedback', 'suggestions', 'issues', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'resolved')),
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Students can view all active feedback
CREATE POLICY "Everyone can view active feedback"
ON public.feedback
FOR SELECT
USING (status = 'active');

-- Students can insert their own feedback
CREATE POLICY "Students can create feedback"
ON public.feedback
FOR INSERT
WITH CHECK (auth.uid() = student_id);

-- Students can update their own feedback
CREATE POLICY "Students can update own feedback"
ON public.feedback
FOR UPDATE
USING (auth.uid() = student_id);

-- Students can delete their own feedback
CREATE POLICY "Students can delete own feedback"
ON public.feedback
FOR DELETE
USING (auth.uid() = student_id);

-- TPO and teachers can moderate all feedback
CREATE POLICY "TPO and teachers can moderate feedback"
ON public.feedback
FOR ALL
USING (has_role(auth.uid(), 'tpo'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_feedback_updated_at
BEFORE UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_feedback_student_id ON public.feedback(student_id);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);