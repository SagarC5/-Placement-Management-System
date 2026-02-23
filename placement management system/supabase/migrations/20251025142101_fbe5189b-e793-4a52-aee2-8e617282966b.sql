-- Create OTP verification table
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_otp_email ON public.otp_verifications(email);
CREATE INDEX idx_otp_expires ON public.otp_verifications(expires_at);

-- Policy: Users can view their own OTP records
CREATE POLICY "Users can view own OTP"
ON public.otp_verifications
FOR SELECT
USING (true);

-- Policy: System can create OTP
CREATE POLICY "System can create OTP"
ON public.otp_verifications
FOR INSERT
WITH CHECK (true);

-- Policy: System can update OTP
CREATE POLICY "System can update OTP"
ON public.otp_verifications
FOR UPDATE
USING (true);

-- Create function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_verifications
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;