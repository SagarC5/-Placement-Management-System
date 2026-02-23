import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeText } = await req.json();
    
    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: "Resume text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Parsing resume with Lovable AI");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Use Lovable AI (OpenAI GPT-5) to extract skills from resume
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert resume parser specializing in skill extraction. Your task is to identify and extract ALL skills from resumes with high accuracy.

Extract:
- Technical skills (programming languages, frameworks, tools, software)
- Soft skills (leadership, communication, problem-solving)
- Domain knowledge (industry-specific expertise)
- Certifications and methodologies (Agile, Scrum, Six Sigma)
- Languages spoken
- Design and creative skills

Be thorough and precise. Include variations (e.g., "JavaScript" and "JS", "Machine Learning" and "ML").`
          },
          {
            role: "user",
            content: `Extract all skills from this resume:\n\n${resumeText}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_skills",
            description: "Extract all technical and professional skills from a resume",
            parameters: {
              type: "object",
              properties: {
                skills: {
                  type: "array",
                  items: { type: "string" },
                  description: "Comprehensive list of all skills identified in the resume, including technical skills, soft skills, tools, languages, frameworks, methodologies, and domain expertise"
                }
              },
              required: ["skills"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_skills" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log("AI response:", JSON.stringify(aiData));

    // Extract skills from tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let skills: string[] = [];

    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      skills = args.skills || [];
    }

    // Clean and validate skills
    skills = skills
      .filter(skill => {
        // Filter out malformed skills
        if (!skill || typeof skill !== 'string') return false;
        if (skill.length < 2 || skill.length > 50) return false;
        if (skill.includes('[') || skill.includes('=') || skill.includes('{')) return false;
        return true;
      })
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);

    console.log("Cleaned skills:", skills);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Update profile with parsed skills
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        resume_skills: skills,
        resume_parsed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      throw updateError;
    }

    console.log("Successfully updated profile with skills");

    return new Response(
      JSON.stringify({ skills, success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-resume function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
