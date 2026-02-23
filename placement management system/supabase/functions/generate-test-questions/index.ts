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
    const { jobRole, difficulty = 'medium', count = 10 } = await req.json();
    
    if (!jobRole) {
      throw new Error('Job role is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create system prompt based on job role
    const systemPrompt = `You are an expert test question generator. Generate ${count} multiple-choice questions for a ${jobRole} position.

Mix the questions as follows:
- 60% role-specific technical questions related to ${jobRole}
- 40% aptitude questions (logical reasoning, quantitative aptitude, verbal ability)

Difficulty level: ${difficulty}

CRITICAL: Return ONLY valid JSON without any markdown formatting, code blocks, or extra text.
Format:
{
  "questions": [
    {
      "question": "question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correct_answer": "exact option text that is correct",
      "type": "technical" or "aptitude",
      "difficulty": "${difficulty}"
    }
  ]
}`;

    console.log('Generating questions for:', jobRole, difficulty);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate ${count} diverse questions for ${jobRole} at ${difficulty} level. Include both technical and aptitude questions. Ensure questions are unique each time.` 
          }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('AI Response:', content);

    // Clean the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const questionsData = JSON.parse(cleanedContent);
    
    if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
      throw new Error('Invalid questions format from AI');
    }

    // Validate questions
    const validQuestions = questionsData.questions.filter((q: any) => 
      q.question && 
      q.options && 
      Array.isArray(q.options) && 
      q.options.length === 4 &&
      q.correct_answer &&
      q.type &&
      q.difficulty
    );

    if (validQuestions.length === 0) {
      throw new Error('No valid questions generated');
    }

    console.log(`Generated ${validQuestions.length} valid questions`);

    return new Response(
      JSON.stringify({ questions: validQuestions }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error: any) {
    console.error('Error in generate-test-questions:', error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Failed to generate questions',
        details: error?.toString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});