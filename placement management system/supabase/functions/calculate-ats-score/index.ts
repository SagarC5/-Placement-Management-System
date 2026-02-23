import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ATS_SYSTEM_PROMPT = `You are an ATS scoring engine.

INPUTS:
1. Extracted Resume Text
2. Job Description (JD) text — may be empty

TASKS:
1. Clean and structure the resume text.
2. Identify:
   - Skills
   - Tools/Technologies
   - Education
   - Projects
   - Work Experience
   - Certifications
   - Contact Information

3. Extract keywords from the Job Description:
   - Technical skills
   - Tools
   - Software
   - Cloud platforms
   - Programming languages
   - Soft skills
   - Role-specific keywords

4. Perform Keyword Matching:
   - Identify MATCHED keywords (resume ∩ JD)
   - Identify MISSING keywords (JD − resume)
   - Identify EXTRA skills in resume (resume − JD)

5. Generate ATS Scores:
   If JD is provided:
      - Skill Match Score (50%)
      - Experience Relevance Score (20%)
      - Education Match Score (15%)
      - Keyword Match Score (10%)
      - Formatting/Readability Score (5%)
   If JD is empty:
      - Provide a resume-only ATS score.

6. Provide Actionable Resume Suggestions:
   - How to improve skill match
   - Missing important keywords
   - Improve formatting for ATS
   - Improve bullet points
   - Missing sections (if any)

RULES:
- Only use information from the resume + JD.
- Do NOT hallucinate skills that are not present.
- Provide realistic, ATS-style scoring.
- If no JD is provided, skip JD-based scoring and generate a generic ATS score.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: "Resume text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calculating ATS score with comprehensive analysis");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const userPrompt = jobDescription 
      ? `Analyze this resume against the provided job description and return comprehensive ATS scoring.

Resume Content:
${resumeText}

Job Description:
${jobDescription}`
      : `Analyze this resume and provide a comprehensive ATS score (no specific job description provided, use generic ATS scoring).

Resume Content:
${resumeText}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ATS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "calculate_ats_score",
            description: "Calculate comprehensive ATS score for a resume",
            parameters: {
              type: "object",
              properties: {
                ats_score: {
                  type: "number",
                  description: "Overall ATS score from 0-100"
                },
                section_scores: {
                  type: "object",
                  properties: {
                    skills: { type: "number", description: "Skill match score (0-50)" },
                    experience: { type: "number", description: "Experience relevance score (0-20)" },
                    education: { type: "number", description: "Education match score (0-15)" },
                    keyword_match: { type: "number", description: "Keyword match score (0-10)" },
                    formatting: { type: "number", description: "Formatting/readability score (0-5)" }
                  },
                  required: ["skills", "experience", "education", "keyword_match", "formatting"]
                },
                matched_keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "Keywords found in both resume and JD"
                },
                missing_keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "Important keywords missing from resume"
                },
                extra_keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "Additional skills in resume not in JD"
                },
                resume_summary: {
                  type: "object",
                  properties: {
                    skills: { type: "array", items: { type: "string" } },
                    education: { type: "array", items: { type: "string" } },
                    experience: { type: "array", items: { type: "string" } },
                    projects: { type: "array", items: { type: "string" } },
                    certifications: { type: "array", items: { type: "string" } }
                  }
                },
                analysis_summary: {
                  type: "string",
                  description: "Short summary of the analysis"
                },
                improvement_tips: {
                  type: "array",
                  items: { type: "string" },
                  description: "Actionable tips to improve the resume"
                }
              },
              required: ["ats_score", "section_scores", "matched_keywords", "missing_keywords", "extra_keywords", "resume_summary", "analysis_summary", "improvement_tips"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "calculate_ats_score" } }
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
    console.log("AI response received");

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let atsScore = null;

    if (toolCall?.function?.arguments) {
      atsScore = JSON.parse(toolCall.function.arguments);
    }

    console.log("ATS Score calculated:", atsScore?.ats_score);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user && atsScore) {
        // Store ATS score
        await supabase
          .from("ats_scores")
          .insert({
            student_id: user.id,
            score: atsScore.ats_score,
            details: atsScore
          });
      }
    }

    return new Response(
      JSON.stringify({ success: true, atsScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in calculate-ats-score function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
