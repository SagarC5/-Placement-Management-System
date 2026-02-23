import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobRecommendation {
  job_id: string;
  job_source: 'offcampus';
  company_name: string;
  role: string;
  match_score: number;
  skill_match: number;
  test_performance: number;
  interview_performance: number;
  reasons: string[];
  skills_required?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting job recommendation generation");

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("Fetching student data for:", user.id);

    // Get student profile with skills
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("resume_skills, department")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    // Get mock test performance
    const { data: mockResults } = await supabase
      .from("mock_results")
      .select("score")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const avgMockScore = mockResults && mockResults.length > 0
      ? mockResults.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / mockResults.length
      : 0;

    // Get interview performance
    const { data: interviews } = await supabase
      .from("interactive_interviews")
      .select("final_score")
      .eq("student_id", user.id)
      .not("final_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    const avgInterviewScore = interviews && interviews.length > 0
      ? interviews.reduce((sum, i) => sum + (Number(i.final_score) || 0), 0) / interviews.length
      : 0;

    console.log("Student data:", {
      skills: profile?.resume_skills?.length || 0,
      avgMockScore,
      avgInterviewScore
    });

    // Get offcampus jobs only (TPO jobs shown in separate On-Campus Jobs tab)
    const { data: offcampusJobs } = await supabase
      .from("offcampus_jobs")
      .select("id, role, company_name, skills_required");

    const recommendations: JobRecommendation[] = [];
    // Clean and validate student skills
    const studentSkills = (profile?.resume_skills || [])
      .filter((skill: any) => {
        if (!skill || typeof skill !== 'string') return false;
        if (skill.includes('[') || skill.includes('=') || skill.includes('{')) return false;
        return skill.length > 1;
      })
      .map((s: string) => s.toLowerCase().trim());

    // Process offcampus jobs only
    if (offcampusJobs) {
      for (const job of offcampusJobs) {
        const jobSkills = (job.skills_required || []).map((s: string) => s.toLowerCase());
        const skillMatch = calculateSkillMatch(studentSkills, jobSkills);
        
        const reasons: string[] = [];
        if (jobSkills.length === 0) {
          reasons.push("Open to all candidates");
        } else if (skillMatch > 70) {
          reasons.push("Strong skill match");
        } else if (skillMatch > 40) {
          reasons.push("Good skill match");
        }
        if (avgMockScore > 70) reasons.push("Excellent test performance");
        if (avgInterviewScore > 70) reasons.push("Strong interview performance");

        const matchScore = (skillMatch * 0.5) + (avgMockScore * 0.25) + (avgInterviewScore * 0.25);

        // Lower threshold to 15 to include more jobs
        if (matchScore >= 15) {
          recommendations.push({
            job_id: job.id,
            job_source: 'offcampus',
            company_name: job.company_name,
            role: job.role,
            match_score: Math.round(matchScore),
            skill_match: Math.round(skillMatch),
            test_performance: Math.round(avgMockScore),
            interview_performance: Math.round(avgInterviewScore),
            reasons,
            skills_required: jobSkills
          });
        }
      }
    }

    // Sort by match score
    recommendations.sort((a, b) => b.match_score - a.match_score);

    // Clear old recommendations and insert new ones
    await supabase
      .from("job_recommendations")
      .delete()
      .eq("student_id", user.id);

    if (recommendations.length > 0) {
      const { error: insertError } = await supabase
        .from("job_recommendations")
        .insert(
          recommendations.map(rec => ({
            student_id: user.id,
            job_id: rec.job_id,
            job_source: rec.job_source,
            match_score: rec.match_score,
            skill_match: rec.skill_match,
            test_performance: rec.test_performance,
            interview_performance: rec.interview_performance,
            reasons: rec.reasons
          }))
        );

      if (insertError) {
        console.error("Error inserting recommendations:", insertError);
        throw insertError;
      }
    }

    console.log(`Generated ${recommendations.length} recommendations`);

    return new Response(
      JSON.stringify({
        success: true,
        count: recommendations.length,
        recommendations: recommendations.slice(0, 10)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateSkillMatch(studentSkills: string[], jobSkills: string[]): number {
  // If job has no required skills, treat it as open to all candidates (50% match)
  if (jobSkills.length === 0 || studentSkills.length === 0) return 50;
  
  let matches = 0;
  for (const jobSkill of jobSkills) {
    if (studentSkills.some(s => s.includes(jobSkill) || jobSkill.includes(s))) {
      matches++;
    }
  }
  
  return (matches / jobSkills.length) * 100;
}
