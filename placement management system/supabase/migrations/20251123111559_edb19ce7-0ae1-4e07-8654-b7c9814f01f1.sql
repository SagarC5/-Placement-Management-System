-- Create table for pre-registered students uploaded by TPO
CREATE TABLE public.pre_registered_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  parent_phone TEXT,
  batch TEXT,
  department TEXT,
  tenth_percentage NUMERIC,
  twelfth_percentage NUMERIC,
  cgpa NUMERIC,
  is_verified BOOLEAN DEFAULT FALSE,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pre_registered_students ENABLE ROW LEVEL SECURITY;

-- TPO can manage pre-registered students
CREATE POLICY "TPO can manage pre-registered students"
ON public.pre_registered_students
FOR ALL
USING (has_role(auth.uid(), 'tpo'::app_role));

-- Students can view their own pre-registration record
CREATE POLICY "Students can view own pre-registration"
ON public.pre_registered_students
FOR SELECT
USING (email = auth.jwt()->>'email' OR auth.uid()::text = id::text);

-- System can check email existence (needed for OTP verification)
CREATE POLICY "System can check email existence"
ON public.pre_registered_students
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pre_registered_students_updated_at
BEFORE UPDATE ON public.pre_registered_students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster email lookups
CREATE INDEX idx_pre_registered_students_email ON public.pre_registered_students(email);
CREATE INDEX idx_pre_registered_students_verified ON public.pre_registered_students(is_verified);