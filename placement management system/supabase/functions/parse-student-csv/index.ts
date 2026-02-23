import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StudentRecord {
  email: string;
  name?: string;
  parent_phone?: string;
  batch?: string;
  department?: string;
  tenth_percentage?: number;
  twelfth_percentage?: number;
  cgpa?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the uploaded file content
    const { csvContent } = await req.json();

    if (!csvContent || typeof csvContent !== "string") {
      return new Response(
        JSON.stringify({ error: "CSV content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV content
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must contain headers and at least one student record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get headers
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    // Validate required header
    if (!headers.includes("email")) {
      return new Response(
        JSON.stringify({ error: "CSV must contain 'email' column" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse student records
    const students: StudentRecord[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      
      if (values.length !== headers.length) {
        errors.push(`Line ${i + 1}: Column count mismatch`);
        continue;
      }

      const record: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        
        if (header === "email") {
          record.email = value.toLowerCase();
        } else if (header === "name") {
          record.name = value;
        } else if (header === "parent_phone" || header === "parent phone") {
          record.parent_phone = value;
        } else if (header === "batch") {
          record.batch = value;
        } else if (header === "department") {
          record.department = value;
        } else if (header === "tenth_percentage" || header === "10th %") {
          record.tenth_percentage = parseFloat(value) || null;
        } else if (header === "twelfth_percentage" || header === "12th %") {
          record.twelfth_percentage = parseFloat(value) || null;
        } else if (header === "cgpa") {
          record.cgpa = parseFloat(value) || null;
        }
      });

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(record.email)) {
        errors.push(`Line ${i + 1}: Invalid email format - ${record.email}`);
        continue;
      }

      students.push(record);
    }

    if (students.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No valid student records found",
          details: errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get TPO user ID from auth header
    const authHeader = req.headers.get("authorization");
    let uploadedBy = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      uploadedBy = user?.id || null;
    }

    // Insert students with uploaded_by field
    const studentsWithUploader = students.map(s => ({
      ...s,
      uploaded_by: uploadedBy
    }));

    const { data, error } = await supabase
      .from("pre_registered_students")
      .upsert(studentsWithUploader, { 
        onConflict: "email",
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error("Error inserting students:", error);
      return new Response(
        JSON.stringify({ error: "Failed to upload students", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: data?.length || 0,
        uploaded: data?.length || 0,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in parse-student-csv function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
