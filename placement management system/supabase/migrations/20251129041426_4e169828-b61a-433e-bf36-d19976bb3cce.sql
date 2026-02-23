-- Drop the existing policy
DROP POLICY IF EXISTS "Everyone can view active feedback" ON public.feedback;

-- Create new policy for students (can view non-issue feedback)
CREATE POLICY "Students can view non-issue feedback"
ON public.feedback
FOR SELECT
USING (
  status = 'active' 
  AND (
    -- TPO and teachers can see all feedback
    has_role(auth.uid(), 'tpo'::app_role) 
    OR has_role(auth.uid(), 'teacher'::app_role)
    -- Students can only see non-issue feedback
    OR (
      category IN ('interview_experience', 'company_feedback', 'suggestions', 'other')
    )
  )
);