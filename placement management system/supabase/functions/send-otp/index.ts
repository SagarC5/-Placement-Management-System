import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const gmailUser = Deno.env.get("GMAIL_USER")!;
const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

interface SendOTPRequest {
  email: string;
  name?: string;
  purpose?: "signup" | "reset";
  role?: "student" | "teacher" | "tpo";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, purpose = "signup", role = "student" }: SendOTPRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For signup, check if email is pre-registered by TPO
    if (purpose === "signup") {
      // Check appropriate table based on role
      if (role === "teacher") {
        const { data: preRegistered, error: preRegError } = await supabase
          .from("pre_registered_teachers")
          .select("email, name")
          .eq("email", email)
          .maybeSingle();

        if (preRegError) {
          console.error("Error checking teacher pre-registration:", preRegError);
        }

        if (!preRegistered) {
          return new Response(
            JSON.stringify({ 
              error: "This email is not registered by TPO as a teacher. Please contact placement office.",
              code: "EMAIL_NOT_PREREGISTERED"
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const { data: preRegistered, error: preRegError } = await supabase
          .from("pre_registered_students")
          .select("email, name")
          .eq("email", email)
          .maybeSingle();

        if (preRegError) {
          console.error("Error checking student pre-registration:", preRegError);
        }

        if (!preRegistered) {
          return new Response(
            JSON.stringify({ 
              error: "This email is not registered by TPO. Please contact placement office.",
              code: "EMAIL_NOT_PREREGISTERED"
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
    
    // For password reset, check if email exists in profiles
    
    if (purpose === "reset") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Email not found in our system" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Calculate expiry (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing unverified OTPs for this email
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("email", email)
      .eq("verified", false);

    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        email,
        otp,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP via email using Gmail SMTP
    const currentTime = new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    await smtpClient.send({
      from: gmailUser,
      to: email,
      subject: purpose === "reset" ? "Password Reset Code" : "Your Verification Code",
      content: "auto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">${purpose === "reset" ? "Password Reset" : "Email Verification"}</h1>
          <p>Hello${name ? ` ${name}` : ""},</p>
          <p>${purpose === "reset" ? "Your password reset code is:" : "Your verification code is:"}</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 12px;">Sent at: ${currentTime}</p>
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p style="color: #d9534f;"><strong>Important:</strong> If you receive multiple codes, use only the most recent one (check the timestamp above).</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Best regards,<br>The Team</p>
        </div>
      `,
    });

    console.log("OTP email sent successfully via Gmail SMTP");

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
