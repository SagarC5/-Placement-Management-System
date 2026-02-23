-- Allow teachers to create announcements (only general and deadline categories)
CREATE POLICY "Teachers can create announcements"
ON public.announcements
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND 
  category IN ('general', 'deadline')
);

-- Allow teachers to view their own announcements
CREATE POLICY "Teachers can view own announcements"
ON public.announcements
FOR SELECT
USING (
  created_by = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role)
);