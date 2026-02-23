-- Create table for pre-registered teachers
CREATE TABLE IF NOT EXISTS public.pre_registered_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  department text,
  phone text,
  is_verified boolean DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pre_registered_teachers ENABLE ROW LEVEL SECURITY;

-- TPO can manage pre-registered teachers
CREATE POLICY "TPO can manage pre-registered teachers"
ON public.pre_registered_teachers
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tpo'::app_role));

-- System can check email existence for teacher signup
CREATE POLICY "System can check teacher email existence"
ON public.pre_registered_teachers
FOR SELECT
TO authenticated
USING (true);

-- Teachers can view their own pre-registration
CREATE POLICY "Teachers can view own pre-registration"
ON public.pre_registered_teachers
FOR SELECT
TO authenticated
USING (email = (auth.jwt() ->> 'email'::text) OR (auth.uid())::text = (id)::text);

-- Add trigger for updated_at
CREATE TRIGGER update_pre_registered_teachers_updated_at
BEFORE UPDATE ON public.pre_registered_teachers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();