import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { skills } = await req.json();
    console.log('Fetching jobs for skills:', skills);

    if (!skills || skills.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No skills provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out invalid skills (malformed, too short, or containing special characters)
    const validSkills = skills.filter((skill: string) => {
      if (typeof skill !== 'string') return false;
      const cleaned = skill.trim();
      // Must be between 2-50 chars, alphanumeric with spaces/hyphens only
      return cleaned.length >= 2 && 
             cleaned.length <= 50 && 
             /^[a-zA-Z0-9\s\-\.]+$/.test(cleaned);
    });

    console.log('Valid skills after filtering:', validSkills);

    if (validSkills.length === 0) {
      console.log('No valid skills found, returning empty jobs array');
      return new Response(
        JSON.stringify({ jobs: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY not found');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map technical skills to job role keywords
    const technicalRoleMap: Record<string, string[]> = {
      'python': ['Python Developer', 'Python Engineer'],
      'machine learning': ['Machine Learning Engineer', 'ML Engineer'],
      'data science': ['Data Scientist', 'Data Analyst'],
      'java': ['Java Developer', 'Java Engineer'],
      'javascript': ['JavaScript Developer', 'Frontend Developer', 'Full Stack Developer'],
      'react': ['React Developer', 'Frontend Developer'],
      'node.js': ['Node.js Developer', 'Backend Developer'],
      'sql': ['Database Developer', 'Data Engineer'],
      'aws': ['Cloud Engineer', 'AWS Engineer', 'DevOps Engineer'],
      'docker': ['DevOps Engineer', 'Cloud Engineer'],
      'kubernetes': ['DevOps Engineer', 'Cloud Engineer'],
      'ai': ['AI Engineer', 'Machine Learning Engineer'],
      'deep learning': ['Deep Learning Engineer', 'AI Engineer'],
      'tensorflow': ['Machine Learning Engineer', 'AI Engineer'],
      'pytorch': ['Machine Learning Engineer', 'Deep Learning Engineer'],
    };

    // Find matching job roles based on skills
    const jobRoles = new Set<string>();
    validSkills.forEach((skill: string) => {
      const skillLower = skill.toLowerCase();
      Object.keys(technicalRoleMap).forEach(key => {
        if (skillLower.includes(key) || key.includes(skillLower)) {
          technicalRoleMap[key].forEach(role => jobRoles.add(role));
        }
      });
    });

    // If no specific roles found, use skills directly with common suffixes
    if (jobRoles.size === 0) {
      const topSkills = validSkills.slice(0, 3);
      topSkills.forEach((skill: string) => {
        jobRoles.add(`${skill} Developer`);
        jobRoles.add(`${skill} Engineer`);
      });
    }

    // Create search query with job roles
    const searchQuery = Array.from(jobRoles).slice(0, 3).join(' OR ');
    console.log('Search query:', searchQuery);

    // Call JSearch API
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(searchQuery)}&page=1&num_pages=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.error('JSearch API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      
      // Return empty jobs array instead of error to allow fallback to static jobs
      console.log('Returning empty jobs array due to API error');
      return new Response(
        JSON.stringify({ jobs: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('JSearch API response:', JSON.stringify(data).slice(0, 200));

    // Transform JSearch results to match our format
    const jobs = data.data?.map((job: any) => ({
      id: job.job_id,
      title: job.job_title,
      company: job.employer_name,
      location: job.job_city && job.job_country ? `${job.job_city}, ${job.job_country}` : job.job_country || 'Remote',
      description: job.job_description || '',
      apply_link: job.job_apply_link || job.job_google_link || '#',
      posted_date: job.job_posted_at_datetime_utc,
      employer_logo: job.employer_logo,
      job_employment_type: job.job_employment_type,
      required_skills: job.job_required_skills || [],
    })) || [];

    console.log(`Returning ${jobs.length} jobs`);

    return new Response(
      JSON.stringify({ jobs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-jsearch-jobs function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
