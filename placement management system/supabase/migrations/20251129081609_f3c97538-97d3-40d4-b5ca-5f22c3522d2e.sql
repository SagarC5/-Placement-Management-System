-- Update RLS policy to allow TPO to view mock test results
DROP POLICY IF EXISTS "Students can view own results" ON public.mock_results;

CREATE POLICY "Students can view own results"
ON public.mock_results
FOR SELECT
USING (
  auth.uid() = student_id 
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'tpo'::app_role)
);