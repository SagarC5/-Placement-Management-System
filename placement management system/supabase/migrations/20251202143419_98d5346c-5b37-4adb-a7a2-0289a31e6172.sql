-- Ensure placement-materials bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('placement-materials', 'placement-materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policy for public read access
CREATE POLICY "Public read access for placement materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'placement-materials');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload placement materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'placement-materials' AND auth.role() = 'authenticated');

-- Create policy for owners to delete their files
CREATE POLICY "Users can delete own placement materials"
ON storage.objects FOR DELETE
USING (bucket_id = 'placement-materials' AND auth.uid()::text = (storage.foldername(name))[1]);