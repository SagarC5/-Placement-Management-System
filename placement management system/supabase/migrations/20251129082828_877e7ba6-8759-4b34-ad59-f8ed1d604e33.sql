-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, name, email)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'User') as name,
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;