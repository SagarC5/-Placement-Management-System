-- Create storage bucket for company images
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-images', 'company-images', true);

-- Create storage policies for company images
CREATE POLICY "Anyone can view company images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-images');

CREATE POLICY "TPO can upload company images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-images' 
  AND has_role(auth.uid(), 'tpo'::app_role)
);

CREATE POLICY "TPO can update company images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-images' 
  AND has_role(auth.uid(), 'tpo'::app_role)
);

CREATE POLICY "TPO can delete company images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-images' 
  AND has_role(auth.uid(), 'tpo'::app_role)
);

-- Add apply_link and image_path columns to tpo_jobs table
ALTER TABLE public.tpo_jobs
ADD COLUMN IF NOT EXISTS apply_link text,
ADD COLUMN IF NOT EXISTS image_path text;