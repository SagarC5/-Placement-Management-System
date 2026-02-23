-- Add visibility field to materials table
ALTER TABLE public.materials
ADD COLUMN visibility text DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'department'));

-- Update existing materials to have 'everyone' visibility
UPDATE public.materials SET visibility = 'everyone' WHERE visibility IS NULL;

-- Drop existing RLS policies for materials
DROP POLICY IF EXISTS "Everyone can view materials" ON public.materials;
DROP POLICY IF EXISTS "TPO/Teacher can manage materials" ON public.materials;

-- Create new RLS policies with department-based visibility
CREATE POLICY "Users can view materials based on visibility"
ON public.materials
FOR SELECT
USING (
  visibility = 'everyone'
  OR 
  (visibility = 'department' AND department IN (
    SELECT department FROM public.profiles WHERE id = auth.uid()
  ))
);

CREATE POLICY "TPO/Teacher can manage materials"
ON public.materials
FOR ALL
USING (has_role(auth.uid(), 'tpo'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (has_role(auth.uid(), 'tpo'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));