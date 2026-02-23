import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  email: string;
  otp: string;
  name?: string;
  department?: string;
  role?: string;
  purpose?: "signup" | "reset";
  tenthPercentage?: number;
  twelfthPercentage?: number;
  cgpa?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp, name, department, role, purpose = "signup", tenthPercentage, twelfthPercentage, cgpa }: VerifyOTPRequest = await req.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: "Email and OTP are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching OTP:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to verify OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "No OTP found for this email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if OTP has expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "OTP has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check attempt limit
    if (otpRecord.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many failed attempts. Please request a new OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify OTP (trim and compare as strings)
    const storedOtp = String(otpRecord.otp).trim();
    const providedOtp = String(otp).trim();
    
    console.log(`Comparing OTPs - Stored: "${storedOtp}", Provided: "${providedOtp}"`);
    
    if (storedOtp !== providedOtp) {
      // Increment attempts
      await supabase
        .from("otp_verifications")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

      console.log(`Invalid OTP attempt ${otpRecord.attempts + 1}/5 for email: ${email}`);
      
      const remainingAttempts = 5 - (otpRecord.attempts + 1);
      return new Response(
        JSON.stringify({ 
          error: remainingAttempts > 0 
            ? `Invalid OTP. ${remainingAttempts} attempts remaining. Please check your email for the most recent code.`
            : "Too many failed attempts. Please request a new OTP."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`OTP verified successfully for email: ${email}`);

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

    // If this is a signup, create the user and assign role
    if (purpose === "signup" && name && role) {
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.some(u => u.email === email);

      if (userExists) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists. Please login instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user with Supabase Auth (using service role bypasses RLS)
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name,
          department,
        },
      });

      if (signUpError) {
        console.error("Error creating user:", signUpError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Assign role using service role (bypasses RLS)
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: signUpData.user.id,
        role,
      });

      if (roleError) {
        console.error("Error assigning role:", roleError);
        // Don't fail the whole operation if role assignment fails
      }

      // Update profile
      const profileData: any = {
        name,
        department,
        temp_password_used: false,
      };

      // Add academic details if provided (for students)
      if (tenthPercentage !== undefined) profileData.tenth_percentage = tenthPercentage;
      if (twelfthPercentage !== undefined) profileData.twelfth_percentage = twelfthPercentage;
      if (cgpa !== undefined) profileData.cgpa = cgpa;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileData)
        .eq("id", signUpData.user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // Mark OTP as verified only after successful user creation
      await supabase
        .from("otp_verifications")
        .update({ verified: true })
        .eq("id", otpRecord.id);

    } else if (purpose === "reset") {
      // For password reset, find the existing user and update their password
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const user = existingUser?.users?.find(u => u.email === email);

      if (user) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: tempPassword }
        );

        if (updateError) {
          console.error("Error updating password:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update password" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Mark temp password as not used
        await supabase
          .from("profiles")
          .update({ temp_password_used: false })
          .eq("id", user.id);

        // Mark OTP as verified only after successful password reset
        await supabase
          .from("otp_verifications")
          .update({ verified: true })
          .eq("id", otpRecord.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP verified successfully",
        tempPassword 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
