-- Create storage bucket for placement materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('placement-materials', 'placement-materials', true);

-- Create RLS policies for placement materials bucket
CREATE POLICY "Anyone can view placement materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'placement-materials');

CREATE POLICY "TPO/Teacher can upload placement materials"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'placement-materials' AND
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('tpo', 'teacher')
    )
  )
);

CREATE POLICY "TPO/Teacher can delete placement materials"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'placement-materials' AND
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('tpo', 'teacher')
    )
  )
);