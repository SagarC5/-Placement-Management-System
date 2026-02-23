import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fixed TPO credentials
const TPO_EMAIL = "abhilashkotian0@gmail.com";
const TPO_PASSWORD = "abhilash07";
const TPO_NAME = "TPO Admin";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if TPO user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingTpo = existingUsers.users.find(u => u.email === TPO_EMAIL);

    if (existingTpo) {
      // Check if role exists
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("*")
        .eq("user_id", existingTpo.id)
        .eq("role", "tpo")
        .single();

      if (!existingRole) {
        // Add TPO role
        await supabaseAdmin.from("user_roles").insert({
          user_id: existingTpo.id,
          role: "tpo",
        });
      }

      // Check if profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", existingTpo.id)
        .single();

      if (!existingProfile) {
        await supabaseAdmin.from("profiles").insert({
          id: existingTpo.id,
          name: TPO_NAME,
          email: TPO_EMAIL,
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "TPO account already exists", userId: existingTpo.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new TPO user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: TPO_EMAIL,
      password: TPO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: TPO_NAME },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    // Create profile
    await supabaseAdmin.from("profiles").insert({
      id: newUser.user.id,
      name: TPO_NAME,
      email: TPO_EMAIL,
    });

    // Add TPO role
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role: "tpo",
    });

    return new Response(
      JSON.stringify({ success: true, message: "TPO account created successfully", userId: newUser.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error seeding TPO:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
