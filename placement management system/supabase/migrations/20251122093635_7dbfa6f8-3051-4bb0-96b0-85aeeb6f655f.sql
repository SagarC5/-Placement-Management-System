-- Add academic details to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tenth_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS twelfth_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS cgpa NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.tenth_percentage IS '10th standard percentage';
COMMENT ON COLUMN public.profiles.twelfth_percentage IS '12th standard percentage';
COMMENT ON COLUMN public.profiles.cgpa IS 'Current CGPA';