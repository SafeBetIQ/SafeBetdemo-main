import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ResetPasswordRequest {
  staff_email: string;
  new_password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminUser || (adminUser.role !== 'casino_admin' && adminUser.role !== 'super_admin')) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Only casino admins can reset passwords." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { staff_email, new_password }: ResetPasswordRequest = await req.json();

    if (!staff_email || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: staff_email, new_password" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters long" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: staffUser, error: staffError } = await supabase
      .from('staff')
      .select('id, email, first_name, last_name, casino_id')
      .eq('email', staff_email)
      .single();

    if (staffError || !staffUser) {
      return new Response(
        JSON.stringify({ error: "Staff member not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (adminUser.role === 'casino_admin') {
      const { data: adminStaff } = await supabase
        .from('staff')
        .select('casino_id')
        .eq('email', user.email)
        .single();

      if (adminStaff && adminStaff.casino_id !== staffUser.casino_id) {
        return new Response(
          JSON.stringify({ error: "Cannot reset password for staff from another casino" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const targetAuthUser = authUsers?.users?.find((u: any) => u.email === staff_email);

    if (!targetAuthUser) {
      return new Response(
        JSON.stringify({ error: "User not found in authentication system" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetAuthUser.id,
      { password: new_password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Password reset successfully for ${staffUser.first_name} ${staffUser.last_name}`,
        staff_id: staffUser.id,
        staff_email: staffUser.email
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in reset-staff-password:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
