import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching placement resources for:', companyName);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if resources already exist for this company
    const { data: existing } = await supabase
      .from('online_resources')
      .select('*')
      .eq('company_name', companyName)
      .limit(10);

    if (existing && existing.length > 0) {
      console.log('Found existing resources:', existing.length);
      return new Response(
        JSON.stringify({ resources: existing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate common placement resource links
    const resources = [
      {
        title: `${companyName} Interview Experience`,
        source: 'GeeksforGeeks',
        url: `https://www.geeksforgeeks.org/${companyName.toLowerCase().replace(/\s+/g, '-')}-interview-experience/`,
        description: `Collection of interview experiences and questions for ${companyName}`,
        company_name: companyName,
      },
      {
        title: `${companyName} Coding Questions`,
        source: 'LeetCode',
        url: `https://leetcode.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}/`,
        description: `Practice coding problems frequently asked at ${companyName}`,
        company_name: companyName,
      },
      {
        title: `${companyName} Interview Questions`,
        source: 'InterviewBit',
        url: `https://www.interviewbit.com/${companyName.toLowerCase().replace(/\s+/g, '-')}-interview-questions/`,
        description: `Comprehensive interview preparation guide for ${companyName}`,
        company_name: companyName,
      },
      {
        title: `${companyName} Company Reviews`,
        source: 'Glassdoor',
        url: `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(companyName)}`,
        description: `Read employee reviews and salary information for ${companyName}`,
        company_name: companyName,
      },
      {
        title: `${companyName} Technical Questions`,
        source: 'PrepInsta',
        url: `https://prepinsta.com/${companyName.toLowerCase().replace(/\s+/g, '-')}-interview-questions/`,
        description: `Practice technical questions commonly asked at ${companyName}`,
        company_name: companyName,
      },
    ];

    // Insert resources into database for future use
    const { error: insertError } = await supabase
      .from('online_resources')
      .insert(resources);

    if (insertError) {
      console.error('Error inserting resources:', insertError);
      // Continue anyway, we'll return the resources
    }

    console.log('Generated and stored resources:', resources.length);

    return new Response(
      JSON.stringify({ resources }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching placement resources:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});