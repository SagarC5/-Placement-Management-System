import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const gmailUser = Deno.env.get("GMAIL_USER");
const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

if (!gmailUser || !gmailPassword) {
  throw new Error("Gmail credentials not configured");
}

const smtpClient = new SMTPClient({
  connection: {
    hostname: "smtp.gmail.com",
    port: 465,
    tls: true,
    auth: {
      username: gmailUser,
      password: gmailPassword,
    },
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "job_posting" | "resource_share" | "announcement";
  title: string;
  description?: string;
  department?: string | null;
  visibility?: string;
  postedBy: string;
  category?: string;
  companyName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, title, description, department, visibility, postedBy, category, companyName }: NotificationRequest = await req.json();

    console.log(`Sending ${type} notification for: ${title}`);

    // Get poster's profile
    const { data: posterProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", postedBy)
      .single();

    const posterName = posterProfile?.name || "Your TPO/Teacher";

    // Fetch students based on context
    let studentsQuery = supabase
      .from("profiles")
      .select("email, name, department, id");

    // Check if students have student role
    const { data: allProfiles } = await studentsQuery;
    
    if (!allProfiles) {
      throw new Error("Failed to fetch profiles");
    }

    // Filter to only students with student role
    const studentIds = allProfiles.map(p => p.id);
    const { data: studentRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "student")
      .in("user_id", studentIds);

    const validStudentIds = new Set(studentRoles?.map(r => r.user_id) || []);
    let students = allProfiles.filter(p => validStudentIds.has(p.id));

    // Filter by department if resource is department-specific
    if (type === "resource_share" && visibility === "department" && department) {
      students = students.filter(s => s.department === department);
      console.log(`Filtered to ${students.length} students in ${department} department`);
    }

    console.log(`Sending emails to ${students.length} students`);

    // Send emails in background
    const emailPromises = students.map(async (student) => {
      try {
        let emailContent = "";
        let subject = "";

        if (type === "job_posting") {
          subject = `New Job Posting: ${title}`;
          emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Job Opportunity Posted!</h2>
              <p>Hi ${student.name},</p>
              <p>A new job opportunity has been posted by ${posterName}:</p>
              <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2563eb;">${title}</h3>
                ${description ? `<p style="color: #666;">${description}</p>` : ""}
              </div>
              <p>Log in to your dashboard to view details and apply:</p>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/dashboard/student" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; margin: 20px 0;">
                View Job Details
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This is an automated notification from your placement system.
              </p>
            </div>
          `;
        } else if (type === "resource_share") {
          subject = `New Learning Resource: ${title}`;
          emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Resource Available!</h2>
              <p>Hi ${student.name},</p>
              <p>${posterName} has shared a new learning resource${visibility === "department" && department ? ` for ${department} department` : ""}:</p>
              <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2563eb;">${title}</h3>
                ${description ? `<p style="color: #666;">${description}</p>` : ""}
              </div>
              <p>Access this resource from your dashboard:</p>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/dashboard/student" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; margin: 20px 0;">
                View Resource
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This is an automated notification from your placement system.
              </p>
            </div>
          `;
        } else if (type === "announcement") {
          subject = `${companyName ? `${companyName} - ` : ""}${title}`;
          const categoryLabel = category === "placement_drive" ? "Placement Drive" :
                                category === "shortlisting" ? "Shortlisting/Results" :
                                category === "deadline" ? "Deadline Notice" : "Announcement";
          
          emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New ${categoryLabel}</h2>
              <p>Hi ${student.name},</p>
              <p>${posterName} has posted an important announcement:</p>
              <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${companyName ? `<p style="color: #2563eb; font-weight: 600; margin-bottom: 8px;">${companyName}</p>` : ""}
                <h3 style="margin-top: 0; color: #333;">${title}</h3>
                ${description ? `<p style="color: #666; white-space: pre-wrap;">${description}</p>` : ""}
              </div>
              <p>Log in to view full details:</p>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/dashboard/student" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; margin: 20px 0;">
                View Announcement
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This is an automated notification from your placement system.
              </p>
            </div>
          `;
        }

        await smtpClient.send({
          from: gmailUser!,
          to: student.email,
          subject: subject,
          content: emailContent,
          html: emailContent,
        });

        console.log(`Email sent to ${student.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${student.email}:`, error);
      }
    });

    // Wait for all emails to be sent
    await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: students.length,
        message: `Notifications sent to ${students.length} students` 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
