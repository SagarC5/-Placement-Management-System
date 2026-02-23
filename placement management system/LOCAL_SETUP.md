# Local Development Setup Guide

## Prerequisites
- Node.js (v18 or higher)
- A Supabase account and project

## Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

## Step 2: Seed TPO Account (IMPORTANT!)

After setting up your database, you must seed the fixed TPO account. Call the `seed-tpo` edge function:

```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/seed-tpo" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Or from your browser console when running the app:
```javascript
const { data, error } = await supabase.functions.invoke('seed-tpo');
console.log(data);
```

**Fixed TPO Credentials:**
- Email: `abhilashkotian0@gmail.com`
- Password: `abhilash07`

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Fill in your Supabase credentials in `.env`:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard/project/sbefcdqeaqnyeanqpqyt/settings/api)
   - Copy your **Project URL** → `VITE_SUPABASE_URL`
   - Copy your **anon/public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Set your **Project ID** → `VITE_SUPABASE_PROJECT_ID=sbefcdqeaqnyeanqpqyt`

## Step 3: Set Up Database Schema

Run all migration files from `supabase/migrations/` in your Supabase SQL Editor:
1. Go to [SQL Editor](https://supabase.com/dashboard/project/sbefcdqeaqnyeanqpqyt/sql)
2. Copy and run each migration file in chronological order (oldest first)

## Step 4: Configure Edge Function Secrets (Optional)

If you're using specific features, add these secrets in your Supabase dashboard:

1. Go to [Edge Functions Settings](https://supabase.com/dashboard/project/sbefcdqeaqnyeanqpqyt/functions)
2. Add required secrets based on features you need:

### Email Features (OTP & Notifications)
- `GMAIL_USER` - Your Gmail address
- `GMAIL_APP_PASSWORD` - [Generate Gmail App Password](https://myaccount.google.com/apppasswords)

### AI Features (Chatbot, Interview, Resume Parsing)
- `OPENAI_API_KEY` - [OpenAI API Key](https://platform.openai.com/api-keys)
- `GEMINI_API_KEY` - [Google AI Studio](https://makersuite.google.com/app/apikey)
- `ELEVENLABS_API_KEY` - [ElevenLabs](https://elevenlabs.io/)

### Job Search
- `RAPIDAPI_KEY` - [RapidAPI Key](https://rapidapi.com/)

### Internal Supabase Keys
- `SUPABASE_SERVICE_ROLE_KEY` - Get from project settings API page
- `SUPABASE_ANON_KEY` - Same as publishable key
- `SUPABASE_URL` - Your project URL

## Step 5: Deploy Edge Functions (Optional)

If you modified edge functions, deploy them to your Supabase project:
```bash
npx supabase functions deploy
```

## Step 6: Run Locally
```bash
npm run dev
```

Your app will be available at `http://localhost:8080`

## Troubleshooting

### Authentication Issues
- Make sure email confirmation is disabled in [Auth Settings](https://supabase.com/dashboard/project/sbefcdqeaqnyeanqpqyt/auth/providers)
- Check that RLS policies are properly configured

### Database Connection Issues
- Verify your `.env` credentials are correct
- Ensure all migrations have been run
- Check Supabase project status

### Edge Function Errors
- Verify all required secrets are set
- Check function logs in Supabase dashboard
- Ensure functions are deployed

## Feature-Specific Setup

### Email (OTP & Notifications)
Requires: `GMAIL_USER`, `GMAIL_APP_PASSWORD`

### AI Chatbot
Requires: `OPENAI_API_KEY` or `GEMINI_API_KEY`

### AI Interview
Requires: `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`

### Job Search
Requires: `RAPIDAPI_KEY`

### Resume Parsing
Requires: `LOVABLE_API_KEY` or `OPENAI_API_KEY`
